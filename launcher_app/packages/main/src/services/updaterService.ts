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
    sendDownloadStatus("Обновление скачано. Готово к установке.", 100, false);
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send(CHANNELS.launchMinecraft, false);
    }
    dialog
      .showMessageBox({
        type: "info",
        title: "Установка обновления",
        message:
          "Обновление загружено и готово к установке. Приложение будет перезапущено.",
        buttons: ["Перезапустить и установить"],
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
        title: "Доступно обновление",
        message: `Найдена новая версия лаунчера (${info.version}). Хотите загрузить её сейчас?`,
        buttons: ["Загрузить", "Позже"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
          sendDownloadStatus("Начинается загрузка обновления...", 0, true);
          const windows = BrowserWindow.getAllWindows();
          if (windows.length > 0) {
            windows[0].webContents.send(CHANNELS.launchMinecraft, true);
          }
        }
      });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendDownloadStatus(
      "Загрузка обновления...",
      Math.floor(progress.percent),
      true
    );
  });

  autoUpdater.on("error", (error) => {
    sendError(
      `Ошибка автообновления: ${error ? error.message : "Неизвестная ошибка"}`
    );
    sendDownloadStatus("Ошибка во время загрузки", 0, false);
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
