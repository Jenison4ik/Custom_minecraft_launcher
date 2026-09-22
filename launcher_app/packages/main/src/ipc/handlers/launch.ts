import { ipcMain } from "electron";
import { CHANNELS } from "@jenison/shared";
import mcLaunch from "../../minecraft/launch";

export function registerLaunchHandlers(): void {
  ipcMain.handle(CHANNELS.runMinecraft, async () => {
    await mcLaunch();
  });
}
