"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('launcherAPI', {
    getLauncherName: () => electron_1.ipcRenderer.invoke('get-launcher-name'),
    runMinecraft: () => electron_1.ipcRenderer.invoke('run-minecraft'),
    addToConfigs: (params) => electron_1.ipcRenderer.invoke('add-to-configs', params)
});
