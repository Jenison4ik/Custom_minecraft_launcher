import { contextBridge, ipcRenderer } from "electron";
import { CHANNELS } from "@jenison/shared";
import type {
  ConfigEntry,
  DownloadStatus,
  ErrorToastType,
  LauncherAPI,
} from "@jenison/shared";

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
  onDownloadStatus: (callback: (status: DownloadStatus) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      status: DownloadStatus
    ) => {
      callback(status);
    };

    ipcRenderer.removeAllListeners(CHANNELS.showDownloadStatus);
    ipcRenderer.on(CHANNELS.showDownloadStatus, listener);

    return () => {
      ipcRenderer.removeListener(CHANNELS.showDownloadStatus, listener);
    };
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
  getLauncherInfo: () => ipcRenderer.invoke(CHANNELS.getLauncherInfo),
  pickJavaPath: () => ipcRenderer.invoke(CHANNELS.pickJavaPath),
  checkForUpdates: () => ipcRenderer.invoke(CHANNELS.checkForUpdates),
  openGameDir: () => ipcRenderer.invoke(CHANNELS.openGameDir),
  openGameLogs: () => ipcRenderer.invoke(CHANNELS.openGameLogs),
};

contextBridge.exposeInMainWorld("launcherAPI", launcherAPI);
