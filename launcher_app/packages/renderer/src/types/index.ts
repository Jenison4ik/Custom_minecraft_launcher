// Types for the renderer process

export interface Config {
  name: string;
  value: any;
}

export interface LauncherConfig {
  nickname?: string;
  ram?: number;
  disableDownload?: boolean;
  [key: string]: any;
}

export interface DownloadStatus {
  message: string;
  progress: number;
  isDownloading: boolean;
}

export interface LogMessage {
  type: 'log' | 'error' | 'warn' | 'info';
  msg: string;
}

export interface LauncherAPI {
  getConfigs: () => Promise<LauncherConfig>;
  runMinecraft: () => Promise<string>;
  openLauncherDir: () => Promise<void>;
  uiLoaded: () => Promise<void>;
  addToConfigs: (params: Config[]) => Promise<void>;
  getMemSize: () => Promise<number>;
  onError: (
    callback: (message: string, type: "error" | "notification") => void
  ) => void;
  onDownloadStatus: (
    callback: (
      message: string,
      progress: number,
      isDownloading: boolean
    ) => void
  ) => void;
  onMinecraft: (callback: (status: boolean) => void) => () => void;
  removeOnMinecraft: () => void;
  downloadMinecraft: () => Promise<boolean>;
  getStatus: () => Promise<boolean>;
  openExternalUrl: (url: string) => void;
}

declare global {
  interface Window {
    launcherAPI: LauncherAPI;
  }
}