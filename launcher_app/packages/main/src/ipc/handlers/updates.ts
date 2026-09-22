import { ipcMain } from "electron";
import { CHANNELS } from "@jenison/shared";
import { checkForUpdatesManually } from "../../services/updaterService";

export function registerUpdateHandlers(): void {
  ipcMain.handle(CHANNELS.checkForUpdates, () => {
    checkForUpdatesManually();
  });
}
