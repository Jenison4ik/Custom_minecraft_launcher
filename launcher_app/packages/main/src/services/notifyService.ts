import { CHANNELS } from "@jenison/shared";
import type { DownloadStatus, ErrorToastType } from "@jenison/shared";
import { getMainWindow } from "../window/createWindow";

const THROTTLE_MS = 200;

let lastSent: DownloadStatus | null = null;
let pending: DownloadStatus | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function finiteCount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function normalize(status: DownloadStatus): DownloadStatus {
  const completedItems = finiteCount(status.completedItems);
  const totalItems = finiteCount(status.totalItems);
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
      completedItems,
      totalItems,
    };
  }

  return {
    active: status.active,
    title: status.title,
    totalBytes,
    loadedBytes: Math.max(0, Math.min(loadedBytes, totalBytes)),
    completedItems,
    totalItems,
  };
}

function deliver(status: DownloadStatus): void {
  lastSent = status;
  const window = getMainWindow();
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
  try {
    window.webContents.send(CHANNELS.showDownloadStatus, status);
  } catch (error) {
    console.error("Failed to send download status:", error);
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
    completedItems: null,
    totalItems: null,
  });
}

export function reportProgress(status: {
  title: string;
  loadedBytes: number | null;
  totalBytes: number | null;
  completedItems?: number | null;
  totalItems?: number | null;
  active?: boolean;
}): void {
  sendDownloadStatus({
    active: status.active ?? true,
    title: status.title,
    loadedBytes: status.loadedBytes,
    totalBytes: status.totalBytes,
    completedItems: status.completedItems ?? null,
    totalItems: status.totalItems ?? null,
  });
}

export function sendPhase(title: string, active = true): void {
  sendDownloadStatus({
    active,
    title,
    loadedBytes: null,
    totalBytes: null,
    completedItems: null,
    totalItems: null,
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

export function sendLaunchStatus(isLaunching: boolean, canStop = false): void {
  const window = getMainWindow();
  if (window) {
    window.webContents.send(CHANNELS.launchMinecraft, isLaunching, canStop);
  }
}

export default sendError;
