import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import sendError from "./sendError";

let pathName = ".minecraft";

export function createLauncherDirectory() {
  // Путь к пользовательской директории приложения
  const baseDir = app.getPath("userData");
  //Windows:
  //C:\Users\Имя\AppData\Roaming\mc-launcher
  //Mac
  //Macintosh HD/User/Имя/Library/Aplicatio Support/mc-launcher

  const launcherDir = path.join(baseDir, pathName); // директория лаунчера

  // Подкаталоги
  //const subdirs = [ 'mods', 'resourcepacks', 'shaderpacks', 'logs', 'configs','versions'];

  try {
    if (!fs.existsSync(launcherDir)) {
      fs.mkdirSync(launcherDir, { recursive: true });
      process.stdout.write(`Created launcher directory: ${launcherDir}`);
    } else {
      process.stdout.write(
        `\nLauncher directory already exists: ${launcherDir}\n`
      );
    }
  } catch (err) {
    sendError(`Error when creating launcher directories: ${err}`);
  }

  return launcherDir;
}
export { pathName as mcPath };
