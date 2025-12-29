import { createLauncherDirectory } from "./createLauncherDir";
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { join } from "path";
import getConfig from "./getConfigPath";
import fs from "fs";
import os from "os";
import { openLauncherDir } from "./openLauncherDir";
import { autoUpdater } from "electron-updater";
import sendDownloadStatus from "./sendDownloadStatus";
import sendError from "./sendError";
import properties from "./launcherProperties";
import Status from "./status";
import mcLaunch from "./mcLaunch";
import mcInstall from "./mcInsttaller";

const configPath = getConfig();
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const totalmem = Math.floor(os.totalmem() / 1048576);

type Config = {
  name: string;
  value: any;
};

sendError("loaded");
// =================================================================
// ЛОГИКА АВТООБНОВЛЕНИЯ (ИСПРАВЛЕННАЯ ВЕРСИЯ)
// =================================================================
// Флаг, который не даст показать диалог о загрузке, если обновление уже скачано
let updateReadyToInstall = false;

autoUpdater.autoDownload = false;

// 1. Срабатывает ПОСЛЕ загрузки обновления.
autoUpdater.on("update-downloaded", () => {
  updateReadyToInstall = true;
  sendDownloadStatus("Обновление скачано. Готово к установке.", 100, false);
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send("launch-minecraft", false);
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

// 2. Срабатывает, когда найдено обновление.
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
          windows[0].webContents.send("launch-minecraft", true);
        }
      }
    });
});

// 3. Срабатывает во время загрузки обновления
autoUpdater.on("download-progress", (progress) => {
  sendDownloadStatus(
    "Загрузка обновления...",
    Math.floor(progress.percent),
    true
  );
});

// 4. Обработка ошибок
autoUpdater.on("error", (error) => {
  sendError(
    `Ошибка автообновления: ${error ? error.message : "Неизвестная ошибка"}`
  );
  sendDownloadStatus("Ошибка во время загрузки", Math.floor(0), false);
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send("launch-minecraft", false);
  }
});

export function addToConfig(configs: Config[]) {
  try {
    const configJson = fs.readFileSync(configPath, "utf-8");
    const configData = JSON.parse(configJson);
    configs.forEach((element: Config) => {
      configData[element.name] = element.value;
    });
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), "utf-8");
    Object.assign(config, JSON.parse(fs.readFileSync(configPath, "utf-8")));
    return;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.log("Error while writing to config, details: " + errorMessage);
    return;
  }
}

let win: BrowserWindow;

function createWindow() {
  console.log(join(__dirname, "../renderer/icon.png"));
  win = new BrowserWindow({
    minWidth: 700,
    minHeight: 400,
    width: 1000,
    height: 650,
    autoHideMenuBar: true,
    icon: join(__dirname, "../renderer/icon.ico"),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}
//Отправка логов в основную часть приложения
function forwardLogs() {
  const sendLog = (type: string, msg: string) => {
    if (win) {
      win.webContents.send("log-message", { type, msg });
    }
  };

  const origLog = console.log;
  console.log = (...args) => {
    origLog(...args);
    sendLog("log", args.join(" "));
  };

  const origErr = console.error;
  console.error = (...args) => {
    origErr(...args);
    sendLog("error", args.join(" "));
  };
}
app.whenReady().then(() => {
  let isConectionLost = false;

  //Ограничения для http запросов undici
  // setupDefaultUndiciAgent();

  createWindow();
  forwardLogs();
  autoUpdater.setFeedURL({
    provider: "generic",
    url: properties.url, // просто базовый URL, updater ищет latest.yml
  });
  autoUpdater.checkForUpdates();
});
app.whenReady().then(() => {
  try {
    createLauncherDirectory();
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    sendError(`Ошибка создания директории лаунчера: ${errorMessage}\n`);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle("get-configs", async () => {
  return config;
});

ipcMain.handle("get-mem-size", async () => {
  return totalmem;
});

ipcMain.handle("run-minecraft", async () => {
  //runMinecraft(["fabric-loader-0.16.14-1.20.1", config.nickname, config.ram]);
  mcLaunch(config);
});

ipcMain.handle("add-to-configs", async (event, params: Config[]) => {
  try {
    addToConfig(params);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.log(`Can't save configs at config.json error: ${errorMessage}`);
  }
});
ipcMain.handle("open-launcher-dir", () => {
  openLauncherDir();
});
ipcMain.handle("download-minecraft", async () => {
  const window = BrowserWindow.getAllWindows()[0];
  try {
    window.webContents.send("launch-minecraft", true);
    Status.setStatus(true);
    await mcInstall(config.id);
  } catch (e) {
  } finally {
    window.webContents.send("launch-minecraft", false);
    Status.setStatus(false);
  }

  return false;
});
ipcMain.handle("is-launched", () => {
  return Status.getStatus();
});
