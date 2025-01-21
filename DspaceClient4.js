import fs from 'fs/promises';
import f from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';

class DspaceClient {
    #serverBaseUrl

    constructor() {
        this.#serverBaseUrl = "http://localhost:5001";
    }

    #normalizePath(inputPath) {
        // Remove leading and trailing slashes
        let normalized = inputPath.replace(/^[/\\]+|[/\\]+$/g, '');
        // Replace forward slashes with backslashes and ensure proper escaping
        normalized = normalized.replace(/[/\\]+/g, '\\');
        return normalized;
    }

    async upload(localPath, remotePath) {
        try {
            const normalizedLocalPath = this.#normalizePath(localPath);
            const normalizedRemotePath = this.#normalizePath(remotePath);

            console.log("local", JSON.stringify(normalizedLocalPath));
            console.log("remote", JSON.stringify(normalizedRemotePath));

            const prefix = 'root';
            const fullRemotePath = prefix + '\\' + normalizedRemotePath;

            const stat = await fs.stat(normalizedLocalPath);

            let netUploadTime = 0;
            if (stat.isFile()) {
                netUploadTime = netUploadTime + await this.#uploadFile(normalizedLocalPath, fullRemotePath);
            } else if(stat.isDirectory()) {
                const filePaths = [];
                await this.#generateFilePaths(normalizedLocalPath, filePaths);

                for (const filePath of filePaths) {
                    const relativePath = this.#normalizePath(path.relative(normalizedLocalPath, filePath));
                    const fileRemotePath = this.#normalizePath(path.join(fullRemotePath, relativePath));
                    netUploadTime = netUploadTime + await this.#uploadFile(filePath, fileRemotePath);
                }

                console.log("net upload time ", netUploadTime);
            } else {
                throw new Error("Provided path is neither a file nor a folder");
            }
        } catch (error) {
            this.#error("Error in upload()", error);
        }
    }

    async #uploadFile(filePath, remotePath) {
        try {
            const normalizedLocalPath = this.#normalizePath(filePath);
            const normalizedRemotePath = this.#normalizePath(remotePath);

            console.log("local", JSON.stringify(normalizedLocalPath));
            console.log("remote", JSON.stringify(normalizedRemotePath));

            const stat = await fs.stat(normalizedLocalPath);

            const directoryStructure = {
                id: uuid(),
                name: path.basename(normalizedLocalPath),
                type: "file",
                path: normalizedRemotePath,
                size: stat.size
            };

            const form = new FormData();
            form.append("directoryStructure", JSON.stringify(directoryStructure));
            const fileStream = f.createReadStream(normalizedLocalPath);
            form.append("files", fileStream, path.basename(normalizedLocalPath));

            const url = `${this.#serverBaseUrl}/upload`;
            const response = await axios.post(url, form, {
                headers: {
                    ...form.getHeaders()
                }
            });

            if (!response) {
                throw new Error("Failed to reach server");
            }

            console.log(`Resource uploaded successfully: ${directoryStructure.name}`, response.data);

            if(response.uploadTime) return response.uploadTime;
        } catch (error) {
            this.#error("Error in #uploadFile()", error);
        }
    }

    async retrieve(identifier) {
        try {
            const url = `${this.#serverBaseUrl}/retrieve/${identifier}`;
            const response = await axios.get(url, { responseType: 'arraybuffer' });

            const contentDisposition = response.headers['content-disposition'];
            let filename = "default";
            if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            const downloadPath = this.#normalizePath(path.join("c:\\Users\\Maaz Malik\\Downloads", filename));
            await fs.writeFile(downloadPath, response.data);

            console.log("Resource retrieved successfully");
        } catch (error) {
            this.#error("Error in retrieve()", error);
        }
    }

    async #generateFilePaths(directoryPath, filePaths) {
        const normalizedDirectoryPath = this.#normalizePath(directoryPath);
        const items = await fs.readdir(normalizedDirectoryPath);

        for (const itemName of items) {
            const itemPath = this.#normalizePath(path.join(normalizedDirectoryPath, itemName));
            const itemStat = await fs.stat(itemPath);

            if (itemStat.isDirectory() && itemName != "node_modules") {
                await this.#generateFilePaths(itemPath, filePaths);
            } else if(itemStat.isFile()) {
                filePaths.push(itemPath);
            }
        }
    }

    async delete(identifier) {
        try {
            const url = `${this.#serverBaseUrl}/delete/${identifier}`;
            await axios.delete(url);
        } catch (error) {
            this.#error("Error in delete()", error);
        }
    }

    #error(message, error) {
        const formattedError = `
            Message: ${message}
            Error Name: ${error.name || 'N/A'}
            Error Message: ${error.message || 'N/A'}
            Stack Trace: ${error.stack || 'N/A'}
            Complete Error: ${error}
        `;
        
        console.error(formattedError);
    }
}

export default DspaceClient;