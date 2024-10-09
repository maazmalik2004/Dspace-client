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
            const stat = await fs.stat(localPath);

            const prefix = 'root\\';
            if (!remotePath.startsWith(prefix)) {
                remotePath = prefix + remotePath;
            }

            const form = new FormData();
            const url = `${this.serverBaseUrl}/upload`;

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
            else if (stat.isDirectory()) {
                let filePaths = [];
                //we are adding the file paths while generating the directory structure
                //todo : maybe we can add file identifiers that correspond with the file to differentiate items with the same name at the same path
                const directoryStructure = await this.getDirectoryStructure(localPath, remotePath, filePaths);

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
                }
            });

            if (!response) {
                throw new Error("Failed to reach server");
            }

            console.log(response.data);
        } catch (error) {
            console.error("Error in upload()", error);
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
                    filename = matches[1].replace(/['"]/g, ''); // Remove quotes
                }
            }

            const downloadPath = path.join("C:\\Users\\MI\\Desktop\\Dspace\\Dpace client\\downloads",filename);
            fs.writeFile(downloadPath, response.data);
        } catch (error) {
            console.error("Error in retrieve()", error);
        }
    }
    

    async delete(identifier) {
        try {
            const url = urljoin(this.serverBaseUrl, "/delete", identifier);
            const response = await axios.delete(url);
            console.log(response.data);
        } catch (error) {
            console.error("Error in delete()", error.message);
        }
    }
    
    async getUserDirectory(identifier) {
        try {
            const url = urljoin(this.serverBaseUrl, "/directory", identifier);
            const response = await axios.get(url);
            console.log(response.data);
        } catch (error) {
            console.error("Error in getUserDirectory()", error.message);
        }
    }

    //directory path is the local absolute path of the target folder
    //filePaths is an array that will collect file paths
    async getDirectoryStructure(localPath, remotePath, filePaths = []) {
        try {
            const childrenStructure = await this.generateChildrenStructure(localPath, remotePath, filePaths);

            return {
                id:uuid(),
                name: path.basename(localPath),
                type: 'directory',
                path: remotePath,
                children: childrenStructure
            };
        } catch (error) {
            console.error('Error in getDirectoryStructure()', error);
        }
    }

    async generateChildrenStructure(directoryPath, parentPath, filePaths) {
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
                    itemRecord.children = await this.generateChildrenStructure(itemPath, currentPath, filePaths);
                    itemRecord.size = 0;
                } else {
                    itemRecord.size = itemStat.size;
                    filePaths.push(itemPath);
                }

                itemRecords.push(itemRecord);
            }

            return itemRecords;
        } catch (err) {
            console.error('Error generating children structure:', err);
            throw err;
        }
    }
}

//const localPath = 'C:\\Users\\MI\\Desktop\\Dspace\\testing directory\\Christmas_Tree_8_Angel.mp4';
//const remotePath = "root\\meow\\Christmas_Tree_8_Angel.mp4";

const localPath = 'C:\\Users\\MI\\Desktop\\Dspace\\testing directory';
const remotePath = "meow\\bark\\choco\\testing directory";

(async () => {
    try {
        const client = new DspaceClient();
        //await client.upload(localPath, remotePath);
        //const structure = await client.getDirectoryStructure(localPath, remotePath);
        //console.log(JSON.stringify(structure, null, 2));
        //await client.delete("fb1f2586-6d16-4ef5-821f-07e897641a48");
        //await client.retrieve("9dd5ca9a-2281-421f-810d-d75bb7b34a66");
        await client.getUserDirectory("0ac453b6-3e18-4ea2-a3d5-0c2f229c2dd0");
    } catch (err) {
        console.error('Test failed', err);
    }
})();
