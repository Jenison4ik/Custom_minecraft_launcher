import { ipcMain } from "electron";
import { CHANNELS } from "@jenison/shared";
import configService from "../../services/configService";
import mcLaunch from "../../minecraft/launch";

export function registerLaunchHandlers(): void {
  ipcMain.handle(CHANNELS.runMinecraft, async () => {
    const config = configService.getAll();
    await mcLaunch(config as unknown as Parameters<typeof mcLaunch>[0]);
  });
}
