import { createLauncherDirectory } from "./createLauncherDir";
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { runMinecraft } from "./launch";
import { join } from "path";
import getConfig from "./getConfigPath";
import fs from "fs";
import os from "os";
import { openLauncherDir } from "./openLauncherDir";
// import { checkServerUpdate, initAutoUpdater } from "./updates";
import { autoUpdater } from "electron-updater";
import sendDownloadStatus from "./sendDownloadStatus";
import sendError from "./sendError";

const configPath = getConfig();
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const totalmem = Math.floor(os.totalmem() / 1048576);

type Config = {
  name: string;
  value: any;
};

sendError("loaded");
// =================================================================
// ЛОГИКА АВТООБНОВЛЕНИЯ
// =================================================================

// Срабатывает, когда доступно обновление

autoUpdater.on("update-available", async (info) => {
  sendDownloadStatus("Начинается загрузка обновления...", 0, true);
  autoUpdater.downloadUpdate();
});

// Срабатывает после загрузки обновления
autoUpdater.on("update-downloaded", () => {
  sendDownloadStatus("Обновление скачано. Готово к установке.", 100, false);

  const result = dialog.showMessageBoxSync({
    type: "question",
    buttons: ["Перезапустить и установить", "Позже"],
    defaultId: 0,
    cancelId: 1,
    title: "Установка обновления",
    message:
      "Доступна новая версия! Для применения изменений приложение будет перезапущено.",
  });

  if (result === 0) {
    // Устанавливаем isSilent в false, чтобы пользователь видел процесс установки.
    // allowDowngrade: false - хорошая практика, чтобы не откатываться на старую версию.
    autoUpdater.quitAndInstall(false, true);
  }
});

// Обработка ошибок
autoUpdater.on("error", (error) => {
  sendError(`Ошибка автообновления: ${error.message}`);
});

function addToConfig(configs: Config[]) {
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
    process.stdout.write("Error while writing to config, details: " + e);
    return;
  }
}

function createWindow() {
  process.stdout.write(join(__dirname, "../renderer/icon.png"));
  const win = new BrowserWindow({
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

app.whenReady().then(() => {
  createWindow();

  autoUpdater.setFeedURL({
    provider: "generic",
    url: "https://jenison.ru", // просто базовый URL, updater ищет latest.yml
  });

  autoUpdater.checkForUpdates();
  // checkServerUpdate();
});
app.whenReady().then(() => {
  try {
    createLauncherDirectory();
  } catch (e) {
    process.stdout.write(`${e}\n`);
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
  runMinecraft(["fabric-loader-0.16.14-1.20.1", config.nickname, config.ram]);
});

ipcMain.handle("add-to-configs", async (event, params: Config[]) => {
  try {
    addToConfig(params);
  } catch (e) {
    process.stdout.write(`Can't save configs at config.json error: ${e}`);
  }
});
ipcMain.handle("open-launcher-dir", () => {
  openLauncherDir();
});
ipcMain.handle("ui-loaded", () => {});
