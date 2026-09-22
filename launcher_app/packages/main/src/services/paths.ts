import { app, shell } from "electron";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { sendError } from "./notifyService";

const MC_DIR_NAME = ".minecraft";

export const mcPath = MC_DIR_NAME;

export function createLauncherDirectory(): string {
  const baseDir = app.getPath("userData");
  const launcherDir = path.join(baseDir, MC_DIR_NAME);

  try {
    if (!fs.existsSync(launcherDir)) {
      fs.mkdirSync(launcherDir, { recursive: true });
      console.log(`Created launcher directory: ${launcherDir}`);
    } else {
      console.log(`\nLauncher directory already exists: ${launcherDir}\n`);
    }
  } catch (err) {
    sendError(`Error when creating launcher directories: ${err}`);
  }

  return launcherDir;
}

export function gameDir(): string {
  return path.join(app.getPath("userData"), MC_DIR_NAME);
}

export async function openGameDir(): Promise<void> {
  const dir = gameDir();
  if (!fs.existsSync(dir)) {
    sendError("Папка игры не найдена");
    return;
  }
  const error = await shell.openPath(dir);
  if (error) sendError(`Не удалось открыть папку игры: ${error}`);
}

export async function openGameLogs(): Promise<void> {
  const dir = path.join(gameDir(), "logs");
  if (!fs.existsSync(dir)) {
    sendError("Папка логов не найдена. Она появится после первого запуска игры.");
    return;
  }
  const error = await shell.openPath(dir);
  if (error) sendError(`Не удалось открыть логи: ${error}`);
}

export async function openLauncherDir(): Promise<void> {
  try {
    const platform = process.platform;
    const baseDir = app.getPath("userData");

    if (platform === "win32") {
      exec(`start ${baseDir}`);
    } else if (platform === "darwin") {
      exec(`open "${baseDir}"`);
    } else {
      exec(`xdg-open ${baseDir}`);
    }
  } catch (e) {
    sendError(`Can't open directory: ${e}`);
  }
}
