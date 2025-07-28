import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('launcherAPI', {
  getLauncherName: () => ipcRenderer.invoke('get-launcher-name'),
  runMinecraft: () => ipcRenderer.invoke('run-minecraft'),
  addToConfigs: (params: any[]) => ipcRenderer.invoke('add-to-configs', params)
});
