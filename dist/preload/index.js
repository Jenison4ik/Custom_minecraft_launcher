"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('launcherAPI', {
    getConfigs: () => electron_1.ipcRenderer.invoke('get-configs'),
    runMinecraft: () => electron_1.ipcRenderer.invoke('run-minecraft'),
    addToConfigs: (params) => electron_1.ipcRenderer.invoke('add-to-configs', params),
    getMemSize: () => electron_1.ipcRenderer.invoke('get-mem-size')
});
