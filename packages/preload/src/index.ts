import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('launcherAPI', {
  getLauncherName: () => ipcRenderer.invoke('get-launcher-name'),
  runMinecraft: () => ipcRenderer.invoke('run-minecraft'),
}); 
