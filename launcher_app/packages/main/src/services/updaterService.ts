import { BrowserWindow, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import { CHANNELS } from "@jenison/shared";
import properties from "../config/launcherProperties";
import { sendDownloadStatus, sendError } from "./notifyService";

let updateReadyToInstall = false;

export function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;

  autoUpdater.on("update-downloaded", () => {
    updateReadyToInstall = true;
    sendDownloadStatus("Update downloaded. Ready to install.", 100, false);
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send(CHANNELS.launchMinecraft, false);
    }
    dialog
      .showMessageBox({
        type: "info",
        title: "Install update",
        message:
          "The update has been downloaded and is ready to install. The app will restart.",
        buttons: ["Restart and install"],
      })
      .then(() => {
        autoUpdater.quitAndInstall(false, true);
      });
  });

  autoUpdater.on("update-available", (info) => {
    if (updateReadyToInstall) {
      return;
    }

    dialog
      .showMessageBox({
        type: "info",
        title: "Update available",
        message: `A new launcher version (${info.version}) is available. Download it now?`,
        buttons: ["Download", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
          sendDownloadStatus("Starting update download...", 0, true);
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            windows[0].webContents.send(CHANNELS.launchMinecraft, true);
          }
        }
      });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendDownloadStatus(
      "Downloading update...",
      Math.floor(progress.percent),
      true
    );
  });

  autoUpdater.on("error", (error) => {
    sendError(
      `Auto-update error: ${error ? error.message : "Unknown error"}`
    );
    sendDownloadStatus("Error during download", 0, false);
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send(CHANNELS.launchMinecraft, false);
    }
  });

  autoUpdater.setFeedURL({
    provider: "generic",
    url: properties.url,
  });
  autoUpdater.checkForUpdates();
}
