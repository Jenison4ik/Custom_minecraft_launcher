import { app, ipcMain } from "electron";
import { CHANNELS } from "@jenison/shared";
import Status from "../../services/statusService";
import {
  sendLaunchStatus,
  sendError,
} from "../../services/notifyService";
import mcInstall from "../../minecraft/installer";
import { loadLaunchContext } from "../../minecraft/loadLaunchContext";
import { syncModFiles } from "../../minecraft/syncMods";
import { mcPath } from "../../services/paths";
import path from "path";

export function registerDownloadHandlers(): void {
  ipcMain.handle(CHANNELS.downloadMinecraft, async () => {
    if (!Status.tryBegin()) return;
    sendLaunchStatus(true);
    try {
      const context = await loadLaunchContext();
      const versionId = await mcInstall(context.spec);
      if (context.online && !context.spec.disableDownload) {
        await syncModFiles(path.join(app.getPath("userData"), mcPath));
      }
      return versionId;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      sendError(`Minecraft download error: ${message}`);
      throw e;
    } finally {
      sendLaunchStatus(false);
      Status.end();
    }
  });

  ipcMain.handle(CHANNELS.isLaunched, () => {
    return Status.getStatus();
  });
}
