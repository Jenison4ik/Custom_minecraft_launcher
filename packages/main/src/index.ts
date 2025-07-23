import { createLauncherDirectory } from './createLauncherDir';
import { app, BrowserWindow, ipcMain } from 'electron';
import { runMinecraft } from './launch';
import { join } from 'path';
import fs from 'fs';

process.stdout.write('\x1b[0m');//кодировка для консоли

const configPath = join(app.getAppPath(), 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));



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

app.whenReady().then(createWindow);
app.whenReady().then(()=>{try{ createLauncherDirectory()}catch(e){console.log(e)}});

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
  runMinecraft();
});

