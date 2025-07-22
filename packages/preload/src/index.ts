import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('launcherAPI', {
  getLauncherName: () => ipcRenderer.invoke('get-launcher-name'),
}); 