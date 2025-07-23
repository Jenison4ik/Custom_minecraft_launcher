

import { app } from 'electron';
import * as fs from 'fs';
import { version } from 'os';
import * as path from 'path';
import {join} from 'path';



const configPath = join(app.getAppPath(), 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

let pathName = config?.['minecraft-path-name'] || '.minecraft';

export function createLauncherDirectory() {
  // Путь к пользовательской директории приложения
  const baseDir = app.getPath('userData'); // например: C:\Users\Имя\AppData\Roaming\Custom_minecraft_launcher
  const launcherDir = path.join(baseDir, `${config['minecraft-path-name']}`); // директория лаунчера

  // Подкаталоги
  //const subdirs = [ 'mods', 'resourcepacks', 'shaderpacks', 'logs', 'configs','versions'];

  try {
    if (!fs.existsSync(launcherDir)) {
      fs.mkdirSync(launcherDir, { recursive: true });
      console.log('Создана директория лаунчера:', launcherDir);
    }

  } catch (err) {
    console.error('Ошибка при создании директорий лаунчера:', err);
  }

  return launcherDir;
}
export {pathName as mcPath}