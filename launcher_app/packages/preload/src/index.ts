import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("launcherAPI", {
  getConfigs: () => ipcRenderer.invoke("get-configs"),
  runMinecraft: () => ipcRenderer.invoke("run-minecraft"),
  openLauncherDir: () => ipcRenderer.invoke("open-launcher-dir"),
  uiLoaded: () => ipcRenderer.invoke("ui-loaded"),
  addToConfigs: (params: any[]) => ipcRenderer.invoke("add-to-configs", params),
  getMemSize: () => ipcRenderer.invoke("get-mem-size"),
  onError: (
    callback: (message: string, type: "error" | "notification") => void
  ) => {
    ipcRenderer.on("show-error-toast", (event, message, type) =>
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
      "show-download-status",
      (event, message, progress, isDownloading) =>
        callback(message, progress, isDownloading)
    );
  },
  onMinecraft: (callback: (status: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: boolean) => {
      callback(status);
    };

    ipcRenderer.on("launch-minecraft", listener);

    // Возвращаем функцию отписки
    return () => {
      ipcRenderer.removeListener("launch-minecraft", listener);
    };
  },
  downloadMinecraft: () => {
    ipcRenderer.invoke("download-minecraft");
  },
  getStatus: async () => {
    return await ipcRenderer.invoke("is-launched");
  },
});
