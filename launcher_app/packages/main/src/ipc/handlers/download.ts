import { ipcMain } from "electron";
import { CHANNELS } from "@jenison/shared";
import Status from "../../services/statusService";
import {
  sendLaunchStatus,
  sendError,
} from "../../services/notifyService";
import mcInstall from "../../minecraft/installer";
import resolveGameSpec from "../../minecraft/resolveGameSpec";

export function registerDownloadHandlers(): void {
  ipcMain.handle(CHANNELS.downloadMinecraft, async () => {
    sendLaunchStatus(true);
    Status.setStatus(true);
    try {
      const versionId = await mcInstall(resolveGameSpec());
      return versionId;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      sendError(`Minecraft download error: ${message}`);
      throw e;
    } finally {
      sendLaunchStatus(false);
      Status.setStatus(false);
    }
  });

  ipcMain.handle(CHANNELS.isLaunched, () => {
    return Status.getStatus();
  });
}
