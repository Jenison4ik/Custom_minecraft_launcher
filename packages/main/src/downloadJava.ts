import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import extract from "extract-zip";
import { app } from "electron";
import sendError from "./sendError";
import sendDownloadStatus from "./sendDownloadStatus";

const javaBaseDir = path.join(app.getPath("userData"), "java");
const java17Path = path.join(javaBaseDir, "temurin-17");
const os = process.platform === "win32" ? "windows" : process.platform === "darwin" ? "mac" : "linux";
const arch = process.arch === "x64" ? "x64" : "aarch64";


function downloadAnimation(text: string): () => void {
  const downloadFrames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r${text}${downloadFrames[i % downloadFrames.length]}  `);
    i++;
  }, 500);
  
  // Возвращаем функцию для остановки анимации
  return () => {
    clearInterval(interval);
    process.stdout.write('\r\x1b[36m Done!\n');
  };
}

//URL для Windows x64
const JAVA_URL = `https://api.adoptium.net/v3/binary/version/jdk-17.0.10+7/${os}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`;

export async function ensureJava17(): Promise<string> {
  let stopAnimation = () => {};
  try{
  const javaExecutable = path.join(java17Path, "bin", "java.exe");

  if (fs.existsSync(javaExecutable)) {
    return javaExecutable;
  }
  sendError("Java 17 not found, downloading...");
  sendDownloadStatus("Starting Java 17 download...", 0, true);
  stopAnimation = downloadAnimation('Downloading Java 17');

  const zipPath = path.join(app.getPath("temp"), "java17.zip");

  const writer = fs.createWriteStream(zipPath);

    const response = await axios.get(JAVA_URL, { 
    responseType: "stream",
     onDownloadProgress: (progressEvent) => {
      const { loaded, total } = progressEvent;
      if (total) {
        const percent = Math.round((loaded * 100) / total);
        sendDownloadStatus(`Downloading Java 17: loaded ${Math.floor(loaded/1048576)} MB from ${Math.floor(total/1048576)} MB`, percent, true);
      } else {
        sendDownloadStatus(`Downloaded Java 17: ${loaded} bytes`, 100, false);
      }
    }
   });

  response.data.pipe(writer);

  await new Promise<void>((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  stopAnimation(); // Останавливаем анимацию загрузки
  sendDownloadStatus("Download completed, unpacking Java...", 100, true);
  process.stdout.write("Unpacking Java...\n");
  await extract(zipPath, { dir: javaBaseDir });

  //название извлечённой папки
  const extractedDir = fs.readdirSync(javaBaseDir).find(d => d.includes("jdk") || d.includes("jre"));
  if (!extractedDir) throw new Error("The extracted Java folder could not be found");

  fs.renameSync(path.join(javaBaseDir, extractedDir), java17Path);

  sendDownloadStatus("Java 17 installation completed!", 100, false);
  process.stdout.write("Java 17 installed\n");
  return javaExecutable;
  } catch (e: unknown) {
    if (e instanceof Error) {
        stopAnimation();
        sendError(`Failed to download Java 17: ${e.message}`);
        throw e;
    }
    // Handle non-Error objects
    stopAnimation();
    sendError('Failed to download Java 17: Unknown error');
    throw new Error('Unknown error occurred');
}
}
