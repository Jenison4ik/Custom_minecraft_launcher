import { app, BrowserWindow } from "electron";
import { createWindow } from "./window/createWindow";
import { createLauncherDirectory } from "./services/paths";
import { setupAutoUpdater } from "./services/updaterService";
import { registerIpcHandlers } from "./ipc/registerHandlers";
import { sendError } from "./services/notifyService";

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  registerIpcHandlers();

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
