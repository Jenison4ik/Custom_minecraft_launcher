import { contextBridge, ipcRenderer } from 'electron';


contextBridge.exposeInMainWorld('launcherAPI', {
  getConfigs: () => ipcRenderer.invoke('get-configs'),
  runMinecraft: () => ipcRenderer.invoke('run-minecraft'),
  addToConfigs: (params: any[]) => ipcRenderer.invoke('add-to-configs', params),
  getMemSize:() => ipcRenderer.invoke('get-mem-size'),
  onError: (callback: (message: string) => void) => {
    ipcRenderer.on('show-error-toast', (event, message) => callback(message));
  },
  onDownloadStatus: (callback: (message: string, progress: number, isDownloading: boolean) => void) => {
    ipcRenderer.on('show-download-status', (event, message, progress, isDownloading) => callback(message, progress, isDownloading));
  },
  onMinecraft: (callback: (status: boolean) => void) => {
    ipcRenderer.on('launch-minecraft', (event, status) => callback(status));
  }
});
