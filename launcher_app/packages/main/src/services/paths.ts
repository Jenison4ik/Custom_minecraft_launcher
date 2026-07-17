import { app } from "electron";
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
