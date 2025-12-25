import { app, BrowserWindow } from "electron";
import path from "path";
import { mcPath } from "../createLauncherDir";
import { ResolvedVersion, Version } from "@xmcl/core";
import getConfig from "../getConfigPath";
import fs from "fs";
import { launch } from "@xmcl/core";
import { ChildProcess } from "child_process";
import { ensureJava21 } from "../downloadJava";
import sendError from "../sendError";
import sendDownloadStatus from "../sendDownloadStatus";
import Status from "../status";

export default async function mcLaunch() {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length === 0) {
    sendError("Окно приложения не найдено");
    return;
  }
  const window = windows[0];
  window.webContents.send("launch-minecraft", true);
  Status.setStatus(true);

  try {
    sendDownloadStatus("Проверка Java25", 10, true);
    const java21Path = await ensureJava21();

    const configPath = getConfig();
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const BASE_DIR = path.join(app.getPath("userData"), mcPath);

    sendDownloadStatus("Парсинг версии Minecraft", 20, true);
    const resolvedVersion: ResolvedVersion = await Version.parse(
      BASE_DIR,
      config.id
    );

    console.log("Resolved Version:", resolvedVersion);
    console.log("Base Dir:", BASE_DIR);
    console.log("Java Path:", java21Path);
    console.log("Version ID:", config.id);

    sendDownloadStatus("Запуск Minecraft", 30, true);
    const proc: ChildProcess = await launch({
      gamePath: BASE_DIR,
      javaPath: java21Path,
      version: config.id,
    });

    proc.stdout?.on("data", (data: Buffer) => {
      const line = data.toString();
      console.log("[MC]", line);

      if (line.includes("Setting user"))
        sendDownloadStatus("Инициализация сессии", 50, true);
      if (line.includes("LWJGL") || line.includes("OpenGL"))
        sendDownloadStatus("Загрузка графики", 80, true);
      if (
        line.includes("OpenAL initialized") ||
        line.includes("Sound engine started") ||
        line.includes("Successfully loaded")
      )
        sendDownloadStatus("Minecraft запущен", 100, false);
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const line = data.toString();
      console.error("[MC ERROR]", line);

      // Forge часто выводит важную информацию в stderr
      if (
        line.includes("Launching wrapped minecraft") ||
        line.includes("ModLauncher running")
      ) {
        sendDownloadStatus("Запуск Forge", 60, true);
      }
    });

    proc.on("error", (error: Error) => {
      console.error("Ошибка процесса Minecraft:", error);
      sendError("Ошибка при запуске Minecraft: " + error.message);
      sendDownloadStatus("Ошибка при запуске Minecraft", 0, false);
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send("launch-minecraft", false);
      }
      Status.setStatus(false);
    });

    proc.on("exit", (code: number | null, signal: string | null) => {
      console.log(`Minecraft завершен с кодом: ${code}, сигнал: ${signal}`);
      sendDownloadStatus("Minecraft завершен", 0, false);
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send("launch-minecraft", false);
      }
      Status.setStatus(false);
    });
  } catch (e) {
    console.error("Launch error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    sendError("Ошибка при запуске Minecraft: " + errorMessage);
    sendDownloadStatus("Ошибка при запуске Minecraft", 0, false);
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send("launch-minecraft", false);
    }
    Status.setStatus(false);
  }
}
