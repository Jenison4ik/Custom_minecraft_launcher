"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const config_json_1 = __importDefault(require("../../config.json"));
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: (0, path_1.join)(__dirname, '../preload/index.js'),
        },
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        //win.loadURL(process.env.VITE_DEV_SERVER_URL);
        win.loadFile('../index.js')
        win.webContents.openDevTools();
    }
    else {
        win.loadFile((0, path_1.join)(__dirname, '../renderer/index.html'));
    }
}
electron_1.app.whenReady().then(createWindow);
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
    return config_json_1.default['launcher-name'];
});
