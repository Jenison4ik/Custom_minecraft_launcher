import { app, dialog, ipcMain } from "electron";
import { CHANNELS } from "@jenison/shared";
import type { ConfigEntry, LauncherInfo } from "@jenison/shared";
import os from "os";
import configService from "../../services/configService";
import launcherProperties from "../../config/launcherProperties";

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

  ipcMain.handle(CHANNELS.getLauncherInfo, (): LauncherInfo => {
    return {
      appVersion: app.getVersion(),
      mcVersion: launcherProperties.mcVersion,
      loader: launcherProperties.mcCore,
      loaderVersion: launcherProperties.loaderVersion,
      servers: launcherProperties.servers,
    };
  });

  ipcMain.handle(CHANNELS.pickJavaPath, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: "Выберите Java",
      properties: ["openFile"],
      filters: [
        { name: "Java", extensions: ["exe"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}
