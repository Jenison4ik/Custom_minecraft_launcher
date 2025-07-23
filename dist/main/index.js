"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const createLauncherDir_1 = require("./createLauncherDir");
const electron_1 = require("electron");
const launch_1 = require("./launch");
const path_1 = require("path");
const fs_1 = __importDefault(require("fs"));
process.stdout.write('\x1b[0m'); //кодировка для консоли
const configPath = (0, path_1.join)(electron_1.app.getAppPath(), 'config.json');
const config = JSON.parse(fs_1.default.readFileSync(configPath, 'utf-8'));
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: (0, path_1.join)(__dirname, '../preload/index.js'),
        },
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
        win.webContents.openDevTools();
    }
    else {
        win.loadFile((0, path_1.join)(__dirname, '../renderer/index.html'));
    }
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.whenReady().then(() => { try {
    (0, createLauncherDir_1.createLauncherDirectory)();
}
catch (e) {
    console.log(e);
} });
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
electron_1.ipcMain.handle('get-launcher-name', async () => {
    return config['launcher-name'];
});
electron_1.ipcMain.handle('run-minecraft', async () => {
    (0, launch_1.runMinecraft)();
});
