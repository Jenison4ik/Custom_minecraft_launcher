export type ConfigEntry = {
  name: string;
  value: unknown;
};

export type ErrorToastType = "error" | "notification";

export interface DownloadStatus {
  active: boolean;
  title: string;
  /** null, если размер неизвестен — полоса без процентов */
  loadedBytes: number | null;
  totalBytes: number | null;
}

export interface LauncherServerInfo {
  ip: string;
  lable: string;
}

export interface LauncherInfo {
  appVersion: string;
  mcVersion: string;
  loader: string;
  loaderVersion: string;
  servers: LauncherServerInfo[];
}

export interface LauncherAPI {
  getConfigs: () => Promise<Record<string, unknown>>;
  runMinecraft: () => Promise<void>;
  openLauncherDir: () => Promise<void>;
  addToConfigs: (params: ConfigEntry[]) => Promise<void>;
  getMemSize: () => Promise<number>;
  onError: (
    callback: (message: string, type: ErrorToastType) => void
  ) => void;
  onDownloadStatus: (
    callback: (status: DownloadStatus) => void
  ) => () => void;
  onMinecraft: (callback: (status: boolean) => void) => () => void;
  downloadMinecraft: () => Promise<void>;
  getStatus: () => Promise<boolean>;
  getLauncherInfo: () => Promise<LauncherInfo>;
  pickJavaPath: () => Promise<string | null>;
  checkForUpdates: () => Promise<void>;
  openGameDir: () => Promise<void>;
  openGameLogs: () => Promise<void>;
}
