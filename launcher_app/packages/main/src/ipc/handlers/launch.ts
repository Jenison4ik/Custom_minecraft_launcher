import { ipcMain } from "electron";
import { CHANNELS } from "@jenison/shared";
import mcLaunch, {
  canStopMinecraft,
  stopMinecraft,
} from "../../minecraft/launch";

export function registerLaunchHandlers(): void {
  ipcMain.handle(CHANNELS.runMinecraft, async () => {
    await mcLaunch();
  });

  ipcMain.handle(CHANNELS.stopMinecraft, () => {
    return stopMinecraft();
  });

  ipcMain.handle(CHANNELS.canStopMinecraft, () => {
    return canStopMinecraft();
  });
}
