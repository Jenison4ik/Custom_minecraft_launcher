import { app, BrowserWindow } from "electron";
import { join } from "path";

let win: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return win;
}

export function createWindow(): BrowserWindow {
  win = new BrowserWindow({
    minWidth: 700,
    minHeight: 400,
    width: 1000,
    height: 650,
    autoHideMenuBar: true,
    icon: join(__dirname, "../../renderer/icon.ico"),
    webPreferences: {
      preload: join(__dirname, "../../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(join(__dirname, "../../renderer/index.html"));
  }

  return win;
}
