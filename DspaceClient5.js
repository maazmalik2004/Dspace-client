import fs from 'fs/promises';
import f from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';
import os from 'os';


class DspaceClient {
    #serverBaseUrl;
    #defaultDownloadPath;

    constructor(serverUrl = 'http://localhost:5000') {
        if (!serverUrl) {
            throw new Error('Server URL is required');
        }
        this.#serverBaseUrl = serverUrl.replace(/\/+$/, '');
        this.#defaultDownloadPath = this.#normalizePath(path.join(os.homedir(), 'Downloads'));
    }

    #normalizePath(inputPath) {
        if (!inputPath) return '';
        let normalized = inputPath.replace(/^[/\\]+|[/\\]+$/g, '');
        normalized = normalized.replace(/[/\\]+/g, '\\');
        return normalized;
    }

    #calculateStats(sizeInBytes, timeInMillis) {
        const throughputMbps = (sizeInBytes * 8 / 1000000) / (timeInMillis / 1000);
        return {
            timeInMillis,
            throughputMbps: throughputMbps.toFixed(2),
            sizeInMB: (sizeInBytes / 1000000).toFixed(2)
        };
    }

    #logStats(operation, stats) {
        console.log(`
${operation} Statistics:
- Time taken: ${stats.timeInMillis}ms
- File size: ${stats.sizeInMB} MB
- Throughput: ${stats.throughputMbps} Mbps
        `);
    }

    async upload(localPath, remotePath) {
        try {
            if (!localPath || !remotePath) {
                throw new Error('Both local path and remote path are required');
            }

            const normalizedLocalPath = this.#normalizePath(localPath);
            const normalizedRemotePath = this.#normalizePath(remotePath);
            const fullRemotePath = `root\\${normalizedRemotePath}`;

            const stat = await fs.stat(normalizedLocalPath);
            let totalSize = 0;
            let totalTime = 0;

            if (stat.isFile()) {
                const result = await this.#uploadFile(normalizedLocalPath, fullRemotePath);
                totalSize += result.size;
                totalTime += result.time;
            } else if (stat.isDirectory()) {
                const filePaths = [];
                await this.#generateFilePaths(normalizedLocalPath, filePaths);

                for (const filePath of filePaths) {
                    const relativePath = this.#normalizePath(path.relative(normalizedLocalPath, filePath));
                    const fileRemotePath = this.#normalizePath(path.join(fullRemotePath, relativePath));
                    const result = await this.#uploadFile(filePath, fileRemotePath);
                    totalSize += result.size;
                    totalTime += result.time;
                }
            } else {
                throw new Error('Provided path is neither a file nor a folder');
            }

            const stats = this.#calculateStats(totalSize, totalTime);
            this.#logStats('Upload', stats);
            return stats;

        } catch (error) {
            this.#error('Error in upload()', error);
            throw error;
        }
    }

    async #uploadFile(filePath, remotePath) {
        try {
            const normalizedLocalPath = this.#normalizePath(filePath);
            const normalizedRemotePath = this.#normalizePath(remotePath);
            const stat = await fs.stat(normalizedLocalPath);

            const directoryStructure = {
                id: uuid(),
                name: path.basename(normalizedLocalPath),
                type: 'file',
                path: normalizedRemotePath,
                size: stat.size
            };

            const form = new FormData();
            form.append('directoryStructure', JSON.stringify(directoryStructure));
            form.append('files', f.createReadStream(normalizedLocalPath), path.basename(normalizedLocalPath));

            const startTime = Date.now();
            const response = await axios.post(`${this.#serverBaseUrl}/upload`, form, {
                headers: {
                    ...form.getHeaders()
                }
            });
            const endTime = Date.now();

            if (!response) {
                throw new Error('Failed to reach server');
            }

            const timeTaken = endTime - startTime;
            const stats = this.#calculateStats(stat.size, timeTaken);
            this.#logStats(`Upload - ${directoryStructure.name}`, stats);

            return { size: stat.size, time: timeTaken };
        } catch (error) {
            this.#error('Error in #uploadFile()', error);
            throw error;
        }
    }

    async retrieve(identifier) {
        try {
            if (!identifier) {
                throw new Error('Identifier is required');
            }

            const startTime = Date.now();
            const response = await axios.get(`${this.#serverBaseUrl}/retrieve/${identifier}`, {
                responseType: 'arraybuffer'
            });
            const endTime = Date.now();

            const filename = this.#extractFilename(response.headers['content-disposition']) || 'default';
            const downloadPath = path.join(this.#defaultDownloadPath, filename);
            
            await fs.writeFile(downloadPath, response.data);
            
            const stats = this.#calculateStats(response.data.length, endTime - startTime);
            this.#logStats('Download', stats);

            return { path: downloadPath, stats };
        } catch (error) {
            this.#error('Error in retrieve()', error);
            throw error;
        }
    }

    async delete(identifier) {
        try {
            if (!identifier) {
                throw new Error('Identifier is required');
            }

            await axios.delete(`${this.#serverBaseUrl}/delete/${identifier}`);
            console.log('Resource deleted successfully');
        } catch (error) {
            this.#error('Error in delete()', error);
            throw error;
        }
    }

    async getUserDirectory() {
        try {
            const url = `${this.#serverBaseUrl}/directory`;
            const response = await axios.get(url);
            // console.log(JSON.stringify(response.data, null, 3));
            console.log(response.data)
            return response.data.userDirectory
        } catch (error) {
            this.#error("Error in getUserDirectory()", error);
        }
    }


    async #generateFilePaths(directoryPath, filePaths) {
        const normalizedDirectoryPath = this.#normalizePath(directoryPath);
        const items = await fs.readdir(normalizedDirectoryPath);

        for (const itemName of items) {
            if (itemName === 'node_modules') continue;
            
            const itemPath = this.#normalizePath(path.join(normalizedDirectoryPath, itemName));
            const itemStat = await fs.stat(itemPath);

            if (itemStat.isDirectory()) {
                await this.#generateFilePaths(itemPath, filePaths);
            } else if (itemStat.isFile()) {
                filePaths.push(itemPath);
            }
        }
    }

    #extractFilename(contentDisposition) {
        if (!contentDisposition) return null;
        
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        return matches && matches[1] ? matches[1].replace(/['"]/g, '') : null;
    }

    #error(message, error) {
        const formattedError = `
            Message: ${message}
            Error Name: ${error.name || 'N/A'}
            Error Message: ${error.message || 'N/A'}
            Stack Trace: ${error.stack || 'N/A'}
        `;
        
        console.error(formattedError);
    }
}

export default DspaceClient;