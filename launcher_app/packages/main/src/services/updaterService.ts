import { BrowserWindow, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import { CHANNELS } from "@jenison/shared";
import properties from "../config/launcherProperties";
import { byteProgress, sendError, sendPhase } from "./notifyService";

let updateReadyToInstall = false;

export function setupAutoUpdater(): void {
  autoUpdater.autoDownload = false;

  autoUpdater.on("update-downloaded", () => {
    updateReadyToInstall = true;
    sendPhase("Update downloaded. Ready to install.", false);
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
          sendPhase("Starting update download...");
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            windows[0].webContents.send(CHANNELS.launchMinecraft, true);
          }
        }
      });
  });

  autoUpdater.on("download-progress", (progress) => {
    byteProgress("Downloading update...", progress.transferred, progress.total);
  });

  autoUpdater.on("error", (error) => {
    sendError(
      `Auto-update error: ${error ? error.message : "Unknown error"}`
    );
    sendPhase("Error during download", false);
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

export function checkForUpdatesManually(): void {
  const onNotAvailable = () => {
    cleanup();
    sendError("Уже последняя версия", "notification");
  };
  const cleanup = () => {
    autoUpdater.off("update-not-available", onNotAvailable);
    autoUpdater.off("update-available", cleanup);
    autoUpdater.off("error", cleanup);
  };

  autoUpdater.once("update-not-available", onNotAvailable);
  autoUpdater.once("update-available", cleanup);
  autoUpdater.once("error", cleanup);
  void autoUpdater.checkForUpdates();
}
