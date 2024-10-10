import fs from 'fs/promises';
import f from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import axios from 'axios';
import FormData from 'form-data';
import urljoin from "url-join";

class DspaceClient {
    constructor() {
        this.serverBaseUrl = "http://localhost:5000";
    }

    async upload(localPath, remotePath) {
        try {
            //localPath = this.#normalizePath(localPath);
            //remotePath = this.#normalizePath(remotePath);

            console.log("remote",remotePath);
            console.log("local",localPath);

            const stat = await fs.stat(localPath);

            const prefix = 'root\\';
            if (!remotePath.startsWith(prefix)) {
                remotePath = prefix + remotePath;
            }

            const form = new FormData();
            const url = urljoin(this.serverBaseUrl,"/upload");

            //handling a file upload
            if (stat.isFile()) {
                const directoryStructure = {
                    id: uuid(),
                    name: path.basename(localPath),
                    type: "file",
                    path: remotePath,
                    size: stat.size
                };

                form.append("directoryStructure", JSON.stringify(directoryStructure));
                
                const fileStream = f.createReadStream(localPath);
                form.append("files", fileStream, path.basename(localPath));

            }//handling a folder upload
            //need to be modified to handle large files which cause multer issues on backend.
            //solution : we send each file individually with its file record. each record will be recursively inserted into the directory structure hence forming the complete directory structure naturally
            else if (stat.isDirectory()) {
                let filePaths = [];
                //we are adding the file paths while generating the directory structure
                //todo : maybe we can add file identifiers that correspond with the file to differentiate items with the same name at the same path
                const directoryStructure = await this.#getDirectoryStructure(localPath, remotePath, filePaths);

                form.append("directoryStructure",JSON.stringify(directoryStructure));

                for(const filePath of filePaths){
                    form.append("files",f.createReadStream(filePath),path.basename(filePath));
                }
            } else {
                throw new Error("Provided path is neither a file nor a folder");
            }
            
            const response = await axios.post(url, form, {
                headers: {
                    ...form.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (!response) {
                throw new Error("Failed to reach server");
            }

            console.log("Resource uploaded successfully",response.data);
        } catch (error) {
            this.#error("Error in upload()", error);
        }
    }

    async retrieve(identifier) {
        try {
            const url = urljoin(this.serverBaseUrl,"/retrieve",identifier);
            
            const response = await axios.get(url, { responseType: 'arraybuffer' });

            const contentDisposition = response.headers['content-disposition'];
            let filename = "default";
            if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            //remember to modify this path
            const downloadPath = path.join("C:\\Users\\MI\\Desktop\\Dspace\\Dpace client\\downloads",filename);
            fs.writeFile(downloadPath, response.data);

            console.log("Resource retrieved successfully");
        } catch (error) {
            this.#error("Error in retrieve()", error);
        }
    }
    

    async delete(identifier) {
        try {
            const url = urljoin(this.serverBaseUrl, "/delete", identifier);
            const response = await axios.delete(url);
        } catch (error) {
            this.#error("Error in delete()", error);
        }
    }
    
    async getUserDirectory(identifier) {
        try {
            const url = urljoin(this.serverBaseUrl, "/directory", identifier);
            const response = await axios.get(url);
            console.log(response.data);
        } catch (error) {
            console.error("Error in getUserDirectory()", error);
        }
    }

    //directory path is the local absolute path of the target folder
    //filePaths is an array that will collect file paths
    async #getDirectoryStructure(localPath, remotePath, filePaths = []) {
        try {
            const childrenStructure = await this.#generateChildrenStructure(localPath, remotePath, filePaths);

            return {
                id:uuid(),
                name: path.basename(localPath),
                type: 'directory',
                path: remotePath,
                children: childrenStructure
            };
        } catch (error) {
            this.#error('Error in getDirectoryStructure()', error);
        }
    }

    async #generateChildrenStructure(directoryPath, parentPath, filePaths) {
        try {
            const items = await fs.readdir(directoryPath);
            const itemRecords = [];

            for (const itemName of items) {
                const itemPath = path.join(directoryPath, itemName);
                const itemStat = await fs.stat(itemPath);
                const currentPath = path.join(parentPath, itemName);

                const itemRecord = {
                    id:uuid(),
                    name: itemName,
                    type: itemStat.isDirectory() ? 'directory' : 'file',
                    path: currentPath,
                    ...(itemStat.isFile() && { size: itemStat.size })
                };

                if (itemStat.isDirectory()) {
                    itemRecord.children = await this.#generateChildrenStructure(itemPath, currentPath, filePaths);
                    itemRecord.size = 0;
                } else {
                    itemRecord.size = itemStat.size;
                    filePaths.push(itemPath);
                }

                itemRecords.push(itemRecord);
            }

            return itemRecords;
        } catch (error) {
            this.#error('Error generating children structure', error);
        }
    }

    #normalizePath(inputPath) {
        let formattedPath = inputPath.replace(/^[\/\\]+|[\/\\]+$/g, '');
    
        formattedPath = formattedPath.replace(/[\/\\]+/g, '\\\\');
    
        return formattedPath;
    }

    #error(message, error) {
        const formattedError = `
            Message: ${message}
            Error Name: ${error.name || 'N/A'}
            Error Message: ${error.message || 'N/A'}
            Stack Trace: ${error.stack || 'N/A'}
            Complete Error : ${error}
        `;
        
        console.error(formattedError);
    }
    
     
}

export default DspaceClient;

//const localPath = 'C:\\Users\\MI\\Desktop\\Dspace\\testing directory\\Christmas_Tree_8_Angel.mp4';
//const remotePath = "root\\meow\\Christmas_Tree_8_Angel.mp4";

const localPath = 'C:\\Users\\MI\\Desktop\\Dspace\\Dspace\\Dspace 3.0';
const remotePath = "root\\aalu\\Dspace 3.0";

(async () => {
    try {
        const client = new DspaceClient();
        await client.upload(localPath, remotePath);
        //await client.delete("edfe0daa-f5aa-4948-be86-a21e1945d6c2");
        //const p1 = await client.retrieve("10dacc91-9ead-4eda-86e1-4efcd8bbad20");
        //const p2= await client.retrieve("cce4548c-ed21-4f87-b13e-adc7f637ae3d");
        //const p3 = await client.retrieve("1934a78a-f50f-4a82-88a7-7c985653f27e");
        //await Promise.all([p1,p2,p3]);
        //await client.getUserDirectory();
    } catch (err) {
        console.error('Test failed', err);
    }
})();
