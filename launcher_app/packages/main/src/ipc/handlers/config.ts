import { app, dialog, ipcMain } from "electron";
import { CHANNELS } from "@jenison/shared";
import type { ConfigEntry, LauncherInfo } from "@jenison/shared";
import os from "os";
import configService from "../../services/configService";
import { loadProfile, ProfileMissingError, readCachedProfile } from "../../minecraft/profileClient";

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

  ipcMain.handle(CHANNELS.getLauncherInfo, async (): Promise<LauncherInfo> => {
    const empty: LauncherInfo = {
      appVersion: app.getVersion(),
      mcVersion: "",
      loader: "",
      loaderVersion: "",
      servers: [],
    };
    try {
      const loaded = await loadProfile(true);
      return {
        appVersion: app.getVersion(),
        mcVersion: loaded.profile.mcVersion,
        loader: loaded.profile.loader,
        loaderVersion: loaded.profile.loaderVersion,
        servers: loaded.profile.servers,
      };
    } catch (error) {
      if (error instanceof ProfileMissingError) return empty;
      const cached = readCachedProfile();
      if (!cached) return empty;
      return {
        appVersion: app.getVersion(),
        mcVersion: cached.mcVersion,
        loader: cached.loader,
        loaderVersion: cached.loaderVersion,
        servers: cached.servers,
      };
    }
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
