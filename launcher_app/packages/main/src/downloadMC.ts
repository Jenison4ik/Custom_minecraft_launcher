// import axios from "axios";
// import * as fs from "fs";
// import * as path from "path";
// import extract from "extract-zip";
// import { app } from "electron";
// import sendError from "./sendError";
// import sendDownloadStatus from "./sendDownloadStatus";

// const minecraft = path.join(app.getPath("userData"), ".minecraft");
// const minecraft_url = "http://jenison.ru/download";


// //URL для Windows x64

// export async function ensureJava17(): Promise<string> {
//   let stopAnimation = () => {};
//   try{
//   const javaExecutable = path.join(java17Path, "bin", "java.exe");

//   if (fs.existsSync(javaExecutable)) {
//     return javaExecutable;
//   }
//   sendError("Java 17 not found, downloading...");
//   sendDownloadStatus("Starting Java 17 download...", 0, true);

//   const zipPath = path.join(app.getPath("temp"), "java17.zip");

//   const writer = fs.createWriteStream(zipPath);

//     const response = await axios.get(minecraft_url, { 
//     responseType: "stream",
//      onDownloadProgress: (progressEvent) => {
//       const { loaded, total } = progressEvent;
//       if (total) {
//         const percent = Math.round((loaded * 100) / total);
//         process.stdout.write(`\r Downloading minecraft ${Math.floor(loaded/1048576)} MB from ${Math.floor(total/1048576)} MB`)
//         sendDownloadStatus(`Downloading minecraft: loaded ${Math.floor(loaded/1048576)} MB from ${Math.floor(total/1048576)} MB`, percent, true);
//       } else {
//         sendDownloadStatus(`Downloaded minecraft: ${loaded} bytes`, 100, false);
//       }
//     }
//    });

//   response.data.pipe(writer);

//   await new Promise<void>((resolve, reject) => {
//     writer.on("finish", resolve);
//     writer.on("error", reject);
//   });

//   sendDownloadStatus("Download completed, unpacking minecraft...", 100, true);
//   process.stdout.write("Unpacking minecraft...\n");
//   await extract(zipPath, { dir: javaBaseDir });

//   //название извлечённой папки
//   const extractedDir = fs.readdirSync(javaBaseDir).find(d => d.includes("jdk") || d.includes("jre"));
//   if (!extractedDir) throw new Error("The extracted minecraft folder could not be found");

//   fs.renameSync(path.join(javaBaseDir, extractedDir), java17Path);

//   sendDownloadStatus("minecraft installation completed!", 100, false);
//   process.stdout.write("minecraft installed\n");
//   return javaExecutable;
//   } catch (e: unknown) {
//     if (e instanceof Error) {
//         sendError(`Failed to download minecraft: ${e.message}`);
//         throw e;
//     }
//     // Handle non-Error objects
//     sendError('Failed to download minecraft: Unknown error');
//     throw new Error('Unknown error occurred');
// }
// }
