import { ipcMain } from "electron";
import { CHANNELS } from "@jenison/shared";
import { openLauncherDir } from "../../services/paths";

export function registerFilesystemHandlers(): void {
  ipcMain.handle(CHANNELS.openLauncherDir, () => {
    openLauncherDir();
  });
}
