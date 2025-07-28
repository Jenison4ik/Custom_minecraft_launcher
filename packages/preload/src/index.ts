import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('launcherAPI', {
  getConfigs: () => ipcRenderer.invoke('get-configs'),
  runMinecraft: () => ipcRenderer.invoke('run-minecraft'),
  addToConfigs: (params: any[]) => ipcRenderer.invoke('add-to-configs', params),
  getMemSize:() => ipcRenderer.invoke('get-mem-size')
});
