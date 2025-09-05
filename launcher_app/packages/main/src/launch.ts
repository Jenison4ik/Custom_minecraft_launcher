import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { mcPath } from "./createLauncherDir"; // mcPath должен быть экспортирован без циклов
import { app, BrowserWindow } from "electron";
import { ensureJava17 } from "./downloadJava";
import sendError from "./sendError";
import sendDownloadStatus from "./sendDownloadStatus";
import generateManifest from "./generateManifest";
import axios from "axios";
import deepEqual from "./deepEqual";
import {updates} from "./updates";
import extract from "extract-zip"

type LaunchArgs = [versionID: string, nickname: string, ram:string,]//надо добавить startOnServer: boolean

export async function runMinecraft(params: LaunchArgs) {

  const window = BrowserWindow.getAllWindows()[0];
  window.webContents.send('launch-minecraft', true);


  try{
    sendDownloadStatus('Checking Java17', 10, true);
  
  //Configs
    const VERSION_ID = params[0];
    const NICKNAME = params[1];
    const JAVA_PATH = await ensureJava17(); //проверка и установка Java
    const RAM = params[2];
  
    // Пути
    const BASE_DIR = path.join(app.getPath('userData'),mcPath); // корень .minecraft
    const VERSION_DIR = path.join(BASE_DIR, "versions", VERSION_ID);
    const VERSION_JAR = path.join(VERSION_DIR, `${VERSION_ID}.jar`);
    const LIBRARIES_DIR = path.join(BASE_DIR, "libraries");
    const NATIVES_DIR = path.join(VERSION_DIR, "natives");
    const ASSETS_DIR = path.join(BASE_DIR, "assets");
    const versionJsonPath = path.join(VERSION_DIR, `${VERSION_ID}.json`);
    
    

    //Создание и проверка игровых файлов
    sendDownloadStatus("Checking game files", 20, true);
    const manifest = await generateManifest(".minecraft");

    sendDownloadStatus("Checking game files", 40, true);
    const server_manifest = (await axios.get("http://jenison.ru/manifest")).data;

    sendDownloadStatus("Checking game files", 60, true);
    const needDownload = !deepEqual(manifest, server_manifest);
    sendDownloadStatus("Checking game files", 80, true);

    //Скачивание
    if(needDownload){
      const zipPath = path.join(BASE_DIR,"minecraft.zip")
      const writer = fs.createWriteStream(zipPath);

      const response = await axios.get('http://jenison.ru/download', { responseType: "stream" });

      const total = parseInt(response.headers["content-length"] || "0", 10);
      let downloaded = 0;

      response.data.on("data", (chunk: Buffer) => {
        downloaded += chunk.length;
        sendDownloadStatus(`Downloaded Minecraft: ${Math.floor(downloaded/1048576)} MB`, 100, true);
      });
    
    sendDownloadStatus("Download completed, unpacking Minecraft...", 100, true);
    //Удаление неправильных файлов
      updates.forEach(file =>{
        const delete_path = path.join(BASE_DIR, file);

        fs.rmSync(delete_path,{recursive:true,force:true});
      })
      //Распаковка
    
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
      });
      await extract(zipPath,{dir:BASE_DIR});
      sendDownloadStatus("Download completed, unpacking Minecraft...", 100, false);
    }
    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
    const ASSETS_INDEX = versionJson.assets;

    // Проверка наличия jar-файла
    if (!fs.existsSync(VERSION_JAR)) {
      throw new Error("Minecraft jar did not found: "+ VERSION_JAR);
    }
    sendDownloadStatus("Checking game files", 100, true);

    if(NICKNAME.length < 3 || NICKNAME.length > 16){
      throw new Error("Nickname must contain from 3 to 16 characters");
    }
    // Сборка classpath
    
    function getClasspath(librariesDir: string): string {
      const jars: string[] = [];
  
      function walk(d: string) {
        for (const file of fs.readdirSync(d)) {
          const full = path.join(d, file);
          if (fs.statSync(full).isDirectory()) walk(full);
          else if (file.endsWith(".jar")) jars.push(full);
        }
      }
      
      walk(librariesDir);
      jars.push(VERSION_JAR);
      return jars.join(path.delimiter);
    }
    
    sendDownloadStatus("Building classpath", 15, true);
    const classpath = getClasspath(LIBRARIES_DIR);
    sendDownloadStatus('Starting Minecraft', 20, true);
    // JVM + game args
    const jvmArgs = [
      `-Xmx${RAM}M`,
      `-Djava.library.path=${NATIVES_DIR}`,
      "-cp", classpath
    ];
  
    const mainClass = "net.minecraft.client.main.Main";
    const gameArgs = [
      "--username", NICKNAME,
      "--version", VERSION_ID,
      "--gameDir", BASE_DIR,
      "--assetsDir", ASSETS_DIR,
      "--assetIndex", ASSETS_INDEX,
      "--accessToken", "0",
      "--userType", "legacy"
    ];
  
    const args = [...jvmArgs, mainClass, ...gameArgs];
    
    sendDownloadStatus("Starting JVM", 30, true);
    const mc = spawn(JAVA_PATH, args, { cwd: BASE_DIR });//Запуск майнкрафта
    
    mc.stdout.on("data", (data: Buffer) => {
      const line = data.toString();

      if (line.includes("Setting user")) {
        sendDownloadStatus("Initializing session", 50, true);
      }
      if (line.includes("LWJGL")) {
        sendDownloadStatus("Loading graphics", 80, true);
      }
      if (line.includes("OpenAL initialized")) {
        sendDownloadStatus("Minecraft launched", 100, false);
      }
      process.stdout.write(line);
    });

    mc.stderr.on("data", (data: Buffer) => process.stderr.write(data));
    mc.on("exit", (code: number) => {
      console.log(`Minecraft ended with code: ${code}`);
      sendDownloadStatus("Minecraft closed", 0, false);
      window.webContents.send('launch-minecraft', false);
    });
  }catch(e){
    sendError('Error while launching minecraft, '+ e);
    sendDownloadStatus('Error while launching Minecraft', 0, false);
    window.webContents.send('launch-minecraft', false);
  }
}
