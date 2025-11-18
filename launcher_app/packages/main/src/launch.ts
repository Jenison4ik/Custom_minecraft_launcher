import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { mcPath } from "./createLauncherDir";
import { app, BrowserWindow } from "electron";
import { ensureJava17 } from "./downloadJava";
import sendError from "./sendError";
import sendDownloadStatus from "./sendDownloadStatus";
import generateManifest from "./generateManifest";
import axios from "axios";
import deepEqual from "./deepEqual";
import addServer from "./addServer";
import getConfig from "./getConfigPath";
import downloadMinecraft from "./downloadMinecraft";
import url from "./launcherProperties";
import Status from "./status";

type LaunchArgs = [versionID: string, nickname: string, ram: string];

type FileEntry = {
  sha1: string;
  size: number;
};

type FilesObject = {
  files: Record<string, FileEntry>;
};

export async function runMinecraft(params: LaunchArgs) {
  const window = BrowserWindow.getAllWindows()[0];
  window.webContents.send("launch-minecraft", true);
  Status.setStatus(true);

  try {
    addServer();
    sendDownloadStatus("Checking Java17", 10, true);

    // Параметры запуска
    const VERSION_ID = params[0]; // например "1.21.1-fabric"
    const NICKNAME = params[1];
    const JAVA_PATH = await ensureJava17();
    const RAM = params[2];
    // Пути
    const BASE_DIR = path.join(app.getPath("userData"), mcPath);
    const VERSION_DIR = path.join(BASE_DIR, "versions", VERSION_ID);
    const VERSION_JAR = path.join(VERSION_DIR, `${VERSION_ID}.jar`);
    const LIBRARIES_DIR = path.join(BASE_DIR, "libraries");
    const NATIVES_DIR = path.join(VERSION_DIR, "natives");
    const ASSETS_DIR = path.join(BASE_DIR, "assets");
    const versionJsonPath = path.join(VERSION_DIR, `${VERSION_ID}.json`);

    const configPath = getConfig();

    const targetFile = path.join(BASE_DIR, "mods.zip"); //фикс бага
    if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
      fs.unlinkSync(targetFile);
      console.log("mods.zip deleted.");
    } else {
      console.log("mods.zip did not found");
    }

    // Проверка файлов
    const data = fs.readFileSync(configPath, "utf-8");
    const configs = JSON.parse(data);
    const disableDownload = configs.disableDownload ?? false;
    if (!disableDownload) {
      sendDownloadStatus("Проверяем файлы Minecraft", 20, true);
      const manifest = (await generateManifest(".minecraft").then((res) => {
        console.log(res);
        return res;
      })) as FilesObject;
      const server_manifest = (await axios.get(url + "/manifest")).data;
      const needDownload = await deepEqual(manifest, server_manifest);
      if (!needDownload) {
        process.stdout.write("\n\ndone\n\n");
        await downloadMinecraft();
      }
    }

    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, "utf-8"));
    const ASSETS_INDEX = versionJson.assets;

    if (!fs.existsSync(VERSION_JAR)) {
      throw new Error("Minecraft jar не найден: " + VERSION_JAR); //Вдруг скачалось не то
    }
    if (NICKNAME.length < 3 || NICKNAME.length > 16) {
      throw new Error("Никнейм должен содержать от 3 до 16 символов"); //Формат никнейма для майнкрафта
    }

    // Сборка classpath (все библиотеки + версия)
    function getClasspath(librariesDir: string, versionJar: string): string {
      const jars: string[] = [];

      function walk(d: string) {
        for (const file of fs.readdirSync(d)) {
          const full = path.join(d, file);
          if (fs.statSync(full).isDirectory()) walk(full);
          else if (file.endsWith(".jar")) jars.push(full);
        }
      }

      walk(librariesDir);
      jars.push(versionJar);
      return jars.join(path.delimiter);
    }

    sendDownloadStatus("Сборка classpath", 15, true);
    const classpath = getClasspath(LIBRARIES_DIR, VERSION_JAR);

    // JVM + game args
    const jvmArgs = [
      `-Xmx${RAM}M`,
      `-Djava.library.path=${NATIVES_DIR}`,
      "-cp",
      classpath,
    ];

    // Fabric main class
    const mainClass = "net.fabricmc.loader.launch.knot.KnotClient";
    const gameArgs = [
      "--username",
      NICKNAME,
      "--version",
      VERSION_ID, // например "1.21.1-fabric"
      "--gameDir",
      BASE_DIR,
      "--assetsDir",
      ASSETS_DIR,
      "--assetIndex",
      ASSETS_INDEX,
      "--accessToken",
      "0",
      "--userType",
      "legacy",
    ];
    const args = [...jvmArgs, mainClass, ...gameArgs];

    //Запуск майнкрафта
    sendDownloadStatus("Запуск JVM", 30, true);
    const mc = spawn(JAVA_PATH, args, { cwd: BASE_DIR });

    mc.stdout.on("data", (data: Buffer) => {
      const line = data.toString();
      if (line.includes("Setting user"))
        sendDownloadStatus("Инициализация сессии", 50, true);
      if (line.includes("LWJGL"))
        sendDownloadStatus("Загрузка графики", 80, true);
      if (line.includes("OpenAL initialized"))
        sendDownloadStatus("Minecraft запущен", 100, false);
      console.log(line); //Вывод логов в консоль
    });

    mc.stderr.on("data", (data: Buffer) => process.stderr.write(data));
    mc.on("exit", (code: number) => {
      console.log(`Minecraft завершен с кодом: ${code}`);
      sendDownloadStatus("Minecraft завершен", 0, false);
      window.webContents.send("launch-minecraft", false); //Отправка события в главное окно
      Status.setStatus(false); //Установка статуса в false
    });
  } catch (e) {
    sendError("Ошибка при запуске Minecraft, " + e);
    sendDownloadStatus("Ошибка при запуске Minecraft", 0, false);
    window.webContents.send("launch-minecraft", false); //Отправка события в главное окно
    Status.setStatus(false); //Установка статуса в false
  }
}
