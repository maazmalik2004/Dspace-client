import DspaceClient from "./DspaceClient5.js";

const localPath = "C:\\Users\\Maaz Malik\\Desktop\\Dspace-client\\test.js";
const remotePath = "root\\test.js";

// const localPath = "/C:/Users/Maaz Malik/Desktop/Dspace-client/test folder//";
// const remotePath = "/test folder";

function findIdByPath(data, targetPath) {
    for (const item of data) {
        if (item.path === targetPath) {
            return item.id;
        }

        if (item.type === "directory" && item.children) {
            const result = findIdByPath(item.children, targetPath);
            if (result) {
                return result;
            }
        }
    }

    return null;
}

(async () => {
    try {
        const client = new DspaceClient("https://warcraft-deferred-references-newsletters.trycloudflare.com");
        // await client.upload(localPath, remotePath)
        //await client.upload(localPath, remotePath);
        // await client.delete("542b8fbb-79be-4a2b-9d36-7beee1fb8304");
        // await client.retrieve("542b8fbb-79be-4a2b-9d36-7beee1fb8304");
        let pth  = "root\\jichue's dungeon\\The Trapped Room\\The Pitfall Chamber\\hint.txt.txt"
        let dir = await client.getUserDirectory();
        let id = findIdByPath(dir.children, pth)
        console.log(id)
    } catch (err) {
        console.error('Test failed', err);
    }
})();

