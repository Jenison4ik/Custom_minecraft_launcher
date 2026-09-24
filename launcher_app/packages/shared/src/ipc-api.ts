export type ConfigEntry = {
  name: string;
  value: unknown;
};

export type ErrorToastType = "error" | "notification";

export interface DownloadStatus {
  active: boolean;
  title: string;
  /** null, если размер неизвестен — полоса без процентов по байтам */
  loadedBytes: number | null;
  totalBytes: number | null;
  /** Сколько файлов уже готово. null, если шаг не считается файлами. */
  completedItems?: number | null;
  /** Сколько файлов всего на этом шаге. */
  totalItems?: number | null;
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
  stopMinecraft: () => Promise<boolean>;
  canStopMinecraft: () => Promise<boolean>;
  openLauncherDir: () => Promise<void>;
  addToConfigs: (params: ConfigEntry[]) => Promise<void>;
  getMemSize: () => Promise<number>;
  onError: (
    callback: (message: string, type: ErrorToastType) => void
  ) => void;
  onDownloadStatus: (
    callback: (status: DownloadStatus) => void
  ) => () => void;
  onMinecraft: (
    callback: (status: boolean, canStop?: boolean) => void
  ) => () => void;
  downloadMinecraft: () => Promise<void>;
  getStatus: () => Promise<boolean>;
  getLauncherInfo: () => Promise<LauncherInfo>;
  pickJavaPath: () => Promise<string | null>;
  checkForUpdates: () => Promise<void>;
  openGameDir: () => Promise<void>;
  openGameLogs: () => Promise<void>;
}
