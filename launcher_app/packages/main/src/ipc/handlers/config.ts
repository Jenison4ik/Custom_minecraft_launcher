import { ipcMain } from "electron";
import { CHANNELS } from "@jenison/shared";
import type { ConfigEntry } from "@jenison/shared";
import os from "os";
import configService from "../../services/configService";

const totalmem = Math.floor(os.totalmem() / 1048576);

export function registerConfigHandlers(): void {
  ipcMain.handle(CHANNELS.getConfigs, async () => {
    return configService.getAll();
  });

  ipcMain.handle(CHANNELS.getMemSize, async () => {
    return totalmem;
  });

  ipcMain.handle(
    CHANNELS.addToConfigs,
    async (_event, params: ConfigEntry[]) => {
      try {
        configService.addEntries(params);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.log(
          `Can't save configs at config.json error: ${errorMessage}`
        );
      }
    }
  );
}
