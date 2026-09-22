import { ipcMain } from "electron";
import { CHANNELS } from "@jenison/shared";
import { openGameDir, openGameLogs, openLauncherDir } from "../../services/paths";

export function registerFilesystemHandlers(): void {
  ipcMain.handle(CHANNELS.openLauncherDir, () => {
    openLauncherDir();
  });

  ipcMain.handle(CHANNELS.openGameDir, () => {
    return openGameDir();
  });

  ipcMain.handle(CHANNELS.openGameLogs, () => {
    return openGameLogs();
  });
}
