import { contextBridge, ipcRenderer } from "electron";
import { CHANNELS } from "@jenison/shared";
import type { ConfigEntry, ErrorToastType, LauncherAPI } from "@jenison/shared";

const launcherAPI: LauncherAPI = {
  getConfigs: () => ipcRenderer.invoke(CHANNELS.getConfigs),
  runMinecraft: () => ipcRenderer.invoke(CHANNELS.runMinecraft),
  openLauncherDir: () => ipcRenderer.invoke(CHANNELS.openLauncherDir),
  addToConfigs: (params: ConfigEntry[]) =>
    ipcRenderer.invoke(CHANNELS.addToConfigs, params),
  getMemSize: () => ipcRenderer.invoke(CHANNELS.getMemSize),
  onError: (callback: (message: string, type: ErrorToastType) => void) => {
    ipcRenderer.on(CHANNELS.showErrorToast, (_event, message, type) =>
      callback(message, type)
    );
  },
  onDownloadStatus: (
    callback: (
      message: string,
      progress: number,
      isDownloading: boolean
    ) => void
  ) => {
    ipcRenderer.on(
      CHANNELS.showDownloadStatus,
      (_event, message, progress, isDownloading) =>
        callback(message, progress, isDownloading)
    );
  },
  onMinecraft: (callback: (status: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: boolean) => {
      callback(status);
    };

    ipcRenderer.on(CHANNELS.launchMinecraft, listener);

    return () => {
      ipcRenderer.removeListener(CHANNELS.launchMinecraft, listener);
    };
  },
  downloadMinecraft: async () => {
    await ipcRenderer.invoke(CHANNELS.downloadMinecraft);
  },
  getStatus: async () => {
    return await ipcRenderer.invoke(CHANNELS.isLaunched);
  },
};

contextBridge.exposeInMainWorld("launcherAPI", launcherAPI);
