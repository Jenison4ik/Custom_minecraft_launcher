import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { mcPath } from "./createLauncherDir"; // mcPath должен быть экспортирован без циклов
import { app } from "electron";
import { ensureJava17 } from "./downloadJava";
import getConfig from "./getConfigPath";
import sendError from "./sendError";

type LaunchArgs = [versionID: string, nickname: string, ram:string,]//надо добавить startOnServer: boolean

export async function runMinecraft(params: LaunchArgs) {
  try{
    const configPath = getConfig();
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  
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
   // const ASSETS_INDEX = "1.20.1"; // или свой индекс
   const ASSETS_INDEX = "5"
    console.log("mcPath:", mcPath);
    // Проверка наличия jar-файла
    if (!fs.existsSync(VERSION_JAR)) {
      sendError("Minecraft jar did not found: "+ VERSION_JAR);
      return;
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
  
    const classpath = getClasspath(LIBRARIES_DIR);
  
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
    console.log(`Launching Minecraft from: ${BASE_DIR}`);
  
    const mc = spawn(JAVA_PATH, args, { cwd: BASE_DIR });
  
    mc.stdout.on("data", (data: Buffer) => process.stdout.write(data));
    mc.stderr.on("data", (data: Buffer) => process.stderr.write(data));
    mc.on("exit", (code: number) => console.log(`Minecraft ended with code: ${code}`));
  }catch(e){
    sendError('Error while launching minecraft, details: '+ e)
  }
}
