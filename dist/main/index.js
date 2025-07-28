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
const configPath = (0, path_1.join)(electron_1.app.getAppPath(), 'config.json');
const config = JSON.parse(fs_1.default.readFileSync(configPath, 'utf-8'));
function addToConfig(configs) {
    try {
        const configJson = fs_1.default.readFileSync(configPath, 'utf-8');
        const configData = JSON.parse(configJson);
        configs.forEach((element) => {
            configData[element.name] = element.value;
        });
        fs_1.default.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf-8');
        // Обновляем глобальную переменную config
        Object.assign(config, JSON.parse(fs_1.default.readFileSync(configPath, 'utf-8')));
        return;
    }
    catch (e) {
        process.stdout.write('Error while writing to config, details: ' + e);
        return;
    }
}
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
electron_1.app.whenReady().then(() => {
    createWindow();
});
electron_1.app.whenReady().then(() => {
    try {
        (0, createLauncherDir_1.createLauncherDirectory)();
    }
    catch (e) {
        process.stdout.write(`${e}\n`);
    }
});
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
    (0, launch_1.runMinecraft)(['1.20.1', config.nickname, config.ram]);
});
electron_1.ipcMain.handle('add-to-configs', async (event, params) => {
    try {
        addToConfig(params);
    }
    catch (e) {
        process.stdout.write(`Can't save configs at config error: ${e}`);
    }
    // process.stdout.write(`Nickname received: ${nickname}\n`);
    // return { success: true };
});
