import fs from 'fs/promises';
import f from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';

class DspaceClient {
    constructor() {
        this.serverBaseUrl = "http://localhost:5000";
    }

    async upload(localPath, remotePath) {
        try {
            console.log("local", JSON.stringify(localPath));
            console.log("remote", JSON.stringify(remotePath));

            const prefix = 'root\\';
            if (!remotePath.startsWith(prefix)) {
                remotePath = path.join(prefix, remotePath);
            }

            const stat = await fs.stat(localPath);

            if (stat.isFile()) {
                await this.#uploadFile(localPath, remotePath);
            }else if(stat.isDirectory()) {
                const filePaths = [];
                await this.#generateFilePaths(localPath, filePaths);

                for (const filePath of filePaths) {
                    const relativePath = path.relative(localPath, filePath);
                    const fileRemotePath = path.join(remotePath, relativePath);
                    await this.#uploadFile(filePath, fileRemotePath);
                }
            } else {
                throw new Error("Provided path is neither a file nor a folder");
            }
        } catch (error) {
            this.#error("Error in upload()", error);
        }
    }

    async #uploadFile(filePath, remotePath) {
        try {
            console.log("local", JSON.stringify(filePath));
            console.log("remote", JSON.stringify(remotePath));

            const stat = await fs.stat(filePath);

            const directoryStructure = {
                id: uuid(),
                name: path.basename(filePath),
                type: "file",
                path: remotePath,
                size: stat.size
            };

            const form = new FormData();
            form.append("directoryStructure", JSON.stringify(directoryStructure));
            const fileStream = f.createReadStream(filePath);
            form.append("files", fileStream, path.basename(filePath));

            const url = `${this.serverBaseUrl}/upload`;
            const response = await axios.post(url, form, {
                headers: {
                    ...form.getHeaders()
                }
            });

            if (!response) {
                throw new Error("Failed to reach server");
            }

            console.log(`Resource uploaded successfully: ${directoryStructure.name}`, response.data);
        } catch (error) {
            this.#error("Error in #uploadFile()", error);
        }
    }

    async retrieve(identifier) {
        try {
            const url = `${this.serverBaseUrl}/retrieve/${identifier}`;
            const response = await axios.get(url, { responseType: 'arraybuffer' });

            const contentDisposition = response.headers['content-disposition'];
            let filename = "default";
            if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            const downloadPath = path.join("C:\\Users\\MI\\Desktop\\Dspace\\Dpace client\\downloads", filename);
            await fs.writeFile(downloadPath, response.data);

            console.log("Resource retrieved successfully");
        } catch (error) {
            this.#error("Error in retrieve()", error);
        }
    }

    async delete(identifier) {
        try {
            const url = `${this.serverBaseUrl}/delete/${identifier}`;
            await axios.delete(url);
        } catch (error) {
            this.#error("Error in delete()", error);
        }
    }

    async getUserDirectory() {
        try {
            const url = `${this.serverBaseUrl}/directory`;
            const response = await axios.get(url);
            console.log(JSON.stringify(response.data, null, 3));
        } catch (error) {
            this.#error("Error in getUserDirectory()", error);
        }
    }

    async #generateFilePaths(directoryPath, filePaths) {
        const items = await fs.readdir(directoryPath);

        for (const itemName of items) {
            const itemPath = path.join(directoryPath, itemName);
            const itemStat = await fs.stat(itemPath);

            if (itemStat.isDirectory() && itemName != "node_modules") {
                await this.#generateFilePaths(itemPath, filePaths);
            }else if(itemStat.isFile()){
                filePaths.push(itemPath);
            }
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

// Example usage:
//const localPath = 'C:\\Users\\MI\\Desktop\\Dspace\\Dspace\\Dspace 3.0';
//const remotePath = "root\\aalu\\Dspace 3.0";

//const localPath = "C:\\Users\\MI\\Desktop\\Dspace\\testing directory";
//const remotePath = "root\\meow\\chow\\testing directory";

const localPath = "C:\\Users\\MI\\Desktop\\web development";
const remotePath = "root\\momo\\chow\\web development";


//C:\\Users\\MI\\Desktop\\Dspace\\testing directory

(async () => {
    try {
        const client = new DspaceClient();
        //await client.upload(localPath, remotePath);
        //await client.delete("fc6a649f-403c-404e-9446-e1ba791af7ff");
        await client.retrieve("343d8893-918b-4371-a537-23c57dbfb24e");
        // await client.getUserDirectory();
    } catch (err) {
        console.error('Test failed', err);
    }
})();
