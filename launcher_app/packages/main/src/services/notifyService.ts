import { BrowserWindow } from "electron";
import { CHANNELS } from "@jenison/shared";
import type { DownloadStatus, ErrorToastType } from "@jenison/shared";

const THROTTLE_MS = 200;

let lastSent: DownloadStatus | null = null;
let pending: DownloadStatus | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

function normalize(status: DownloadStatus): DownloadStatus {
  const { loadedBytes, totalBytes } = status;
  if (
    loadedBytes == null ||
    totalBytes == null ||
    !Number.isFinite(loadedBytes) ||
    !Number.isFinite(totalBytes) ||
    totalBytes <= 0
  ) {
    return {
      active: status.active,
      title: status.title,
      loadedBytes: null,
      totalBytes: null,
    };
  }

  return {
    active: status.active,
    title: status.title,
    totalBytes,
    loadedBytes: Math.max(0, Math.min(loadedBytes, totalBytes)),
  };
}

function deliver(status: DownloadStatus): void {
  lastSent = status;
  const window = getMainWindow();
  if (window) {
    window.webContents.send(CHANNELS.showDownloadStatus, status);
  }
}

function flushPending(): void {
  timer = null;
  if (!pending) return;
  const next = pending;
  pending = null;
  deliver(next);
}

export function sendDownloadStatus(status: DownloadStatus): void {
  const normalized = normalize(status);
  const immediate =
    lastSent == null ||
    !normalized.active ||
    lastSent.title !== normalized.title;

  if (immediate) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
    deliver(normalized);
    return;
  }

  pending = normalized;
  if (!timer) {
    timer = setTimeout(flushPending, THROTTLE_MS);
  }
}

export function byteProgress(
  title: string,
  loaded: number,
  total: number,
  active = true
): void {
  sendDownloadStatus({
    active,
    title,
    loadedBytes: loaded,
    totalBytes: total,
  });
}

export function sendPhase(title: string, active = true): void {
  sendDownloadStatus({
    active,
    title,
    loadedBytes: null,
    totalBytes: null,
  });
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

export function sendLaunchStatus(isLaunching: boolean): void {
  const window = getMainWindow();
  if (window) {
    window.webContents.send(CHANNELS.launchMinecraft, isLaunching);
  }
}

export default sendError;
