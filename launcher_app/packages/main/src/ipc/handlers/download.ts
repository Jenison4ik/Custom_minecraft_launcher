import { app, ipcMain } from "electron";
import { join } from "path";
import { CHANNELS } from "@jenison/shared";
import configService from "../../services/configService";
import Status from "../../services/statusService";
import { mcPath } from "../../services/paths";
import FabricInstaller from "../../minecraft/installer/FabricInstaller";

export function registerDownloadHandlers(): void {
  ipcMain.handle(CHANNELS.downloadMinecraft, async () => {
    const config = configService.getAll();
    await FabricInstaller(
      config as unknown as Parameters<typeof FabricInstaller>[0],
      join(app.getPath("userData"), mcPath)
    );
  });

  ipcMain.handle(CHANNELS.isLaunched, () => {
    return Status.getStatus();
  });
}
