import { app, BrowserWindow } from "electron";
import { join } from "path";

let win: BrowserWindow | null = null;
let hiddenForGame = false;

export function getMainWindow(): BrowserWindow | null {
  return win;
}

export function hideMainWindow(): void {
  hiddenForGame = true;
  for (const window of BrowserWindow.getAllWindows()) {
    window.hide();
  }
}

export function showMainWindow(): void {
  if (!hiddenForGame) return;
  hiddenForGame = false;

  const windows = BrowserWindow.getAllWindows();
  if (windows.length === 0) {
    createWindow();
    return;
  }

  for (const window of windows) {
    if (window.isMinimized()) window.restore();
    window.show();
  }
  windows[0].focus();
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
