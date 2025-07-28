import { createLauncherDirectory } from './createLauncherDir';
import { app, BrowserWindow, ipcMain } from 'electron';
import { runMinecraft } from './launch';
import path, { join } from 'path';
import fs from 'fs';


const configPath = join(app.getAppPath(), 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

type Config = {
  name: string;
  value: any;
}

function addToConfig(configs: Config[] ){
  try{
    const configJson = fs.readFileSync(configPath, 'utf-8');
    const configData = JSON.parse(configJson);
    configs.forEach((element: Config) => {
      configData[element.name] = element.value;
    });
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf-8');
     // Обновляем глобальную переменную config
    Object.assign(config, JSON.parse(fs.readFileSync(configPath, 'utf-8')));
    return
  }catch(e){
    process.stdout.write('Error while writing to config, details: '+ e)
    return
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(()=>{
  createWindow();
});
app.whenReady().then(()=>{try{ 
  createLauncherDirectory()


}catch(e){process.stdout.write(`${e}\n`)}});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});



ipcMain.handle('get-launcher-name', async () => {
  return config['launcher-name'];
});

ipcMain.handle('run-minecraft', async () => {

  runMinecraft(['1.20.1', config.nickname, config.ram]);
});




ipcMain.handle('add-to-configs', async (event, params: Config[]) => {

try{
  addToConfig(params);
}catch(e){
  process.stdout.write(`Can't save configs at config error: ${e}`);
}

  // process.stdout.write(`Nickname received: ${nickname}\n`);
  // return { success: true };
});

