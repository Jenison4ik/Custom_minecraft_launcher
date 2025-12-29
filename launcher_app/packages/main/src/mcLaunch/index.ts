import { app, BrowserWindow } from "electron";
import path from "path";
import { mcPath } from "../createLauncherDir";
import { ResolvedVersion, Version } from "@xmcl/core";
import getConfig from "../getConfigPath";
import fs from "fs";
import { launch } from "@xmcl/core";
import { ChildProcess } from "child_process";
import { ensureJava } from "../javaInstaller";
import sendError from "../sendError";
import sendDownloadStatus from "../sendDownloadStatus";
import Status from "../status";
import mcInstall from "../mcInsttaller";
import { LauncherConfig } from "../types/LauncherConfig";

/* ──────────────────────────────
   CONSTANTS
────────────────────────────── */

const PROGRESS_CHECK_JAVA = 10;
const PROGRESS_PARSE_VERSION = 20;
const PROGRESS_LAUNCH = 30;
const PROGRESS_INIT_SESSION = 50;
const PROGRESS_FORGE = 60;
const PROGRESS_LOAD_GRAPHICS = 80;
const PROGRESS_COMPLETE = 100;

/* ──────────────────────────────
   HELPER FUNCTIONS
────────────────────────────── */

interface Config {
  id?: string;
  disableDownload?: boolean;
  [key: string]: unknown;
}

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

function notifyLaunchStatus(isLaunching: boolean): void {
  const window = getMainWindow();
  if (window) {
    window.webContents.send("launch-minecraft", isLaunching);
  }
}

function cleanupOnError(errorMessage: string): void {
  sendError(errorMessage);
  sendDownloadStatus("Ошибка при запуске Minecraft", 0, false);
  notifyLaunchStatus(false);
  Status.setStatus(false);
}

function validateConfig(config: Config): void {
  if (!config.id || typeof config.id !== "string") {
    throw new Error("Не указана версия Minecraft в конфигурации");
  }
}

function setupProcessHandlers(
  proc: ChildProcess,
  onExit?: (code: number | null, signal: string | null) => void
): void {
  proc.stdout?.on("data", (data: Buffer) => {
    const line = data.toString();
    console.log("[MC]", line);

    if (line.includes("Setting user")) {
      sendDownloadStatus("Инициализация сессии", PROGRESS_INIT_SESSION, true);
    }
    if (line.includes("LWJGL") || line.includes("OpenGL")) {
      sendDownloadStatus("Загрузка графики", PROGRESS_LOAD_GRAPHICS, true);
    }
    if (
      line.includes("OpenAL initialized") ||
      line.includes("Sound engine started") ||
      line.includes("Successfully loaded")
    ) {
      sendDownloadStatus("Minecraft запущен", PROGRESS_COMPLETE, false);
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const line = data.toString();
    console.error("[MC ERROR]", line);

    // Forge часто выводит важную информацию в stderr
    if (
      line.includes("Launching wrapped minecraft") ||
      line.includes("ModLauncher running")
    ) {
      sendDownloadStatus("Запуск Forge", PROGRESS_FORGE, true);
    }
  });

  proc.on("error", (error: Error) => {
    cleanupOnError("Ошибка при запуске Minecraft: " + error.message);
  });

  proc.on("exit", (code: number | null, signal: string | null) => {
    console.log(`Minecraft ended with code: ${code}, signal: ${signal}`);
    sendDownloadStatus("Minecraft завершен", 0, false);
    notifyLaunchStatus(false);
    Status.setStatus(false);
    if (onExit) {
      onExit(code, signal);
    }
  });
}

/* ──────────────────────────────
   MAIN FUNCTION
────────────────────────────── */

export default async function mcLaunch(config: LauncherConfig) {
  const window = getMainWindow();
  if (!window) {
    sendError("Окно приложения не найдено");
    return;
  }

  notifyLaunchStatus(true);
  Status.setStatus(true);

  try {
    // Загрузка и валидация конфигурации

    const BASE_DIR = path.join(app.getPath("userData"), mcPath);
    const versionId = config.id!;

    // Установка Minecraft (если не отключена)
    if (!config.disableDownload) {
      try {
        await mcInstall(versionId);
      } catch (installError) {
        const errorMessage =
          installError instanceof Error
            ? installError.message
            : String(installError);
        throw new Error(`Ошибка установки Minecraft: ${errorMessage}`);
      }
    }

    // Парсинг версии
    sendDownloadStatus(
      "Парсинг версии Minecraft",
      PROGRESS_PARSE_VERSION,
      true
    );
    const resolvedVersion = await Version.parse(BASE_DIR, versionId);

    // Проверка Java
    sendDownloadStatus("Проверка Java", PROGRESS_CHECK_JAVA, true);
    const javaPath = await ensureJava(resolvedVersion.javaVersion);

    console.log("Resolved Version:", resolvedVersion);
    console.log("Base Dir:", BASE_DIR);
    console.log("Java Path:", javaPath);
    console.log("Version ID:", versionId);

    // Запуск Minecraft
    sendDownloadStatus("Запуск Minecraft", PROGRESS_LAUNCH, true);
    const proc: ChildProcess = await launch({
      gamePath: BASE_DIR,
      javaPath: javaPath,
      version: versionId,
      gameProfile: { name: config.nickname || "Player", id: "offline-id" },
    });

    setupProcessHandlers(proc);
  } catch (e) {
    console.error("Launch error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    cleanupOnError("Ошибка при запуске Minecraft: " + errorMessage);
  }
}
