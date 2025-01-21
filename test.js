import DspaceClient from "./DspaceClient4.js";

// const localPath = "C:\\Users\\Maaz Malik\\Desktop\\Dspace-client\\test.js";
// const remotePath = "root\\test.js";

const localPath = "/C:/Users/Maaz Malik/Desktop/Dspace-client/test folder//";
const remotePath = "/test folder";


(async () => {
    try {
        const client = new DspaceClient();
        // await client.upload(localPath, remotePath)
        //await client.upload(localPath, remotePath);
        // await client.delete("542b8fbb-79be-4a2b-9d36-7beee1fb8304");
        // await client.retrieve("542b8fbb-79be-4a2b-9d36-7beee1fb8304");
        // await client.getUserDirectory();
    } catch (err) {
        console.error('Test failed', err);
    }
})();

