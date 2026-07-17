import { app } from "electron";
import path from "path";
import { Version, launch } from "@xmcl/core";
import { ChildProcess } from "child_process";
import { mcPath } from "../../services/paths";
import { ensureJava } from "../java";
import {
  sendError,
  sendDownloadStatus,
  sendLaunchStatus,
} from "../../services/notifyService";
import Status from "../../services/statusService";
import mcInstall from "../installer";
import { LauncherConfig } from "../../types/LauncherConfig";

const PROGRESS_CHECK_JAVA = 10;
const PROGRESS_PARSE_VERSION = 20;
const PROGRESS_LAUNCH = 30;
const PROGRESS_INIT_SESSION = 50;
const PROGRESS_FORGE = 60;
const PROGRESS_LOAD_GRAPHICS = 80;
const PROGRESS_COMPLETE = 100;

function cleanupOnError(errorMessage: string): void {
  sendError(errorMessage);
  sendDownloadStatus("Ошибка при запуске Minecraft", 0, false);
  sendLaunchStatus(false);
  Status.setStatus(false);
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
    sendLaunchStatus(false);
    Status.setStatus(false);
    if (onExit) {
      onExit(code, signal);
    }
  });
}

export default async function mcLaunch(config: LauncherConfig) {
  sendLaunchStatus(true);
  Status.setStatus(true);

  try {
    const BASE_DIR = path.join(app.getPath("userData"), mcPath);
    const versionId = config.id!;

    if (!config.disableDownload) {
      try {
        await mcInstall(config);
      } catch (installError) {
        const errorMessage =
          installError instanceof Error
            ? installError.message
            : String(installError);
        throw new Error(`Ошибка установки Minecraft: ${errorMessage}`);
      }
    }

    sendDownloadStatus(
      "Парсинг версии Minecraft",
      PROGRESS_PARSE_VERSION,
      true
    );
    const resolvedVersion = await Version.parse(BASE_DIR, versionId);

    sendDownloadStatus("Проверка Java", PROGRESS_CHECK_JAVA, true);
    const javaPath = await ensureJava(resolvedVersion.javaVersion);

    console.log("Resolved Version:", resolvedVersion);
    console.log("Base Dir:", BASE_DIR);
    console.log("Java Path:", javaPath);
    console.log("Version ID:", versionId);

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
