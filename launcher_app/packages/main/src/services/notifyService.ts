import { BrowserWindow } from "electron";
import { CHANNELS } from "@jenison/shared";
import type { ErrorToastType } from "@jenison/shared";

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

export function sendError(
  message: string,
  type: ErrorToastType = "error"
): void {
  const window = getMainWindow();
  if (window) {
    window.webContents.send(CHANNELS.showErrorToast, message, type);
  }
}

export function sendDownloadStatus(
  message: string,
  progress: number = 0,
  isDownloading: boolean
): void {
  const window = getMainWindow();
  if (window) {
    window.webContents.send(
      CHANNELS.showDownloadStatus,
      message,
      progress,
      isDownloading
    );
  }
}

export function sendLaunchStatus(isLaunching: boolean): void {
  const window = getMainWindow();
  if (window) {
    window.webContents.send(CHANNELS.launchMinecraft, isLaunching);
  }
}

export default sendError;
