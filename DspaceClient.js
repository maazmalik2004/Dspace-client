import path from 'path';
import url from 'url';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import {
	v4 as uuidv4
} from 'uuid';

class DspaceClient {
	constructor() {
		this.serverBaseUrl = "http://localhost:5000";
	}

	async uploadFile(filePath) {
		try {
			filePath = this.removeTrailingSlashes(path.normalize(filePath));
			const fileStat = await fs.promises.stat(filePath);

			const directoryStructure = {
				jobId: uuidv4(),
				name: path.basename(filePath),
				type: "file",
				path: filePath,
				size: fileStat.size,
				uploadedAt: this.getUniqueDateTimeLabel(),
				modifiedAt: this.getUniqueDateTimeLabel()
			};

			let formData = new FormData();
			formData.append('files', fs.createReadStream(filePath));
			formData.append('directoryStructure', JSON.stringify(directoryStructure));

			const endpointUrl = url.resolve(this.serverBaseUrl, "/upload");

			let config = {
				method: 'post',
				maxBodyLength: Infinity,
				url: endpointUrl,
				headers: {
					'Cookie': 'csrftoken=buSBxjeHrpiVmTueQVfY8IxbyW9uDMmB',
					...formData.getHeaders()
				},
				data: formData
			};

			const response = await axios.request(config);
			return response.data;
		} catch (error) {
			console.error('Could not upload file:', error.message);
			throw error;
		}
	}

	async uploadFileToJob(localPath, jobId, virtualPath) {
		try {
			localPath = this.removeTrailingSlashes(path.normalize(localPath));
			virtualPath = this.removeTrailingSlashes(path.normalize(virtualPath));
			const fileStat = await fs.promises.stat(localPath);

			const record = {
				jobId: jobId,
				name: path.basename(localPath),
				type: "file",
				path: virtualPath,
				size: fileStat.size,
				uploadedAt: this.getUniqueDateTimeLabel(),
				modifiedAt: this.getUniqueDateTimeLabel()
			};

			let formData = new FormData();
			formData.append('file', fs.createReadStream(localPath));
			formData.append('record', JSON.stringify(record));

			const endpointUrl = url.resolve(this.serverBaseUrl, "/uploadSingle");

			let config = {
				method: 'post',
				maxBodyLength: Infinity,
				url: endpointUrl,
				headers: {
					'Cookie': 'csrftoken=buSBxjeHrpiVmTueQVfY8IxbyW9uDMmB',
					...formData.getHeaders()
				},
				data: formData
			};

			const response = await axios.request(config);
			return response.data;
		} catch (error) {
			console.error('Could not upload file to job:', error.message);
			throw error;
		}
	}

	async uploadFolder(folderPath) {
		try {
			folderPath = this.removeTrailingSlashes(path.normalize(folderPath));
			const filePaths = [];
			const directoryStructureChildren = await this.getDirectoryStructure(folderPath, filePaths);

			const directoryStructure = {
				jobId: uuidv4(),
				name: path.basename(folderPath),
				type: "directory",
				path: `root\\${path.basename(folderPath)}`,
				uploadedAt: this.getUniqueDateTimeLabel(),
				modifiedAt: this.getUniqueDateTimeLabel(),
				children: directoryStructureChildren
			};

			let formData = new FormData();
			for (const filePath of filePaths) {
				formData.append('files', fs.createReadStream(filePath));
			}
			formData.append('directoryStructure', JSON.stringify(directoryStructure));

			const endpointUrl = url.resolve(this.serverBaseUrl, "/upload");

			let config = {
				method: 'post',
				maxBodyLength: Infinity,
				url: endpointUrl,
				headers: {
					'Cookie': 'csrftoken=buSBxjeHrpiVmTueQVfY8IxbyW9uDMmB',
					...formData.getHeaders()
				},
				data: formData
			};

			const response = await axios.request(config);
			return response.data;
		} catch (error) {
			console.error('Could not upload folder:', error.message);
			throw error;
		}
	}

	async getDirectoryStructure(directoryPath, filePaths) {
		try {
			directoryPath = this.removeTrailingSlashes(path.normalize(directoryPath));
			const baseDirName = path.resolve(directoryPath); // Get the absolute path of the base directory
			const baseDirNameNormalized = baseDirName.replace(/[\/\\]+$/, ''); // Remove trailing slashes
			const objects = await fs.promises.readdir(directoryPath);
			let memberObjects = [];
	
			for (const objectName of objects) {
				const objectPath = path.join(directoryPath, objectName);
				const objectStat = await fs.promises.stat(objectPath);
	
				// Construct relative path from base directory
				const relativePath = path.relative(baseDirNameNormalized, objectPath);
				const formattedPath = `root\\${relativePath.replace(/\//g, '\\')}`; // Use double backslashes for Windows-style paths
	
				const record = {
					name: objectName,
					type: objectStat.isDirectory() ? 'directory' : 'file',
					path: formattedPath,
					uploadedAt: this.getUniqueDateTimeLabel(),
					modifiedAt: this.getUniqueDateTimeLabel()
				};
	
				if (!objectStat.isDirectory()) {
					record.size = objectStat.size;
				}
	
				if (objectStat.isDirectory()) {
					const childStructure = await this.getDirectoryStructure(objectPath, filePaths);
					record.children = childStructure;
				} else {
					filePaths.push(objectPath);
				}
	
				memberObjects.push(record);
			}
	
			return memberObjects;
		} catch (error) {
			console.error('Could not get directory structure:', error);
			throw error;
		}
	}
	
	

	removeTrailingSlashes(path) {
		return path.replace(/[\/\\]+$/, '');
	}

	getUniqueDateTimeLabel() {
		const date = new Date();
		const day = String(date.getDate()).padStart(2, '0');
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const year = date.getFullYear();
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');
		const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
		return `${day}${month}${year}${hours}${minutes}${seconds}${milliseconds}`;
	}

	async saveFile(buffer, destPath, fileName) {
		try {
			const filePath = path.join(destPath, fileName);
			await fs.promises.writeFile(filePath, buffer);
		} catch (error) {
			console.error("Could not save the retrieved file: ", error)
			throw error;
		}
	}
}

async function main() {
	try {
		const client = new DspaceClient();
        await client.uploadFolder("C:/Users/MI/Desktop/Dspace/testing directory");
	} catch (error) {
		console.error('Error:', error);
	}
}

main();
