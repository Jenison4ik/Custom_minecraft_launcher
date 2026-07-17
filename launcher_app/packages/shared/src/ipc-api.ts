export type ConfigEntry = {
  name: string;
  value: unknown;
};

export type ErrorToastType = "error" | "notification";

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
    callback: (
      message: string,
      progress: number,
      isDownloading: boolean
    ) => void
  ) => void;
  onMinecraft: (callback: (status: boolean) => void) => () => void;
  downloadMinecraft: () => Promise<void>;
  getStatus: () => Promise<boolean>;
}
