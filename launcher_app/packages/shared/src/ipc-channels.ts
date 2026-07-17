export const CHANNELS = {
  getConfigs: "get-configs",
  getMemSize: "get-mem-size",
  runMinecraft: "run-minecraft",
  addToConfigs: "add-to-configs",
  openLauncherDir: "open-launcher-dir",
  downloadMinecraft: "download-minecraft",
  isLaunched: "is-launched",
  showErrorToast: "show-error-toast",
  showDownloadStatus: "show-download-status",
  launchMinecraft: "launch-minecraft",
} as const;

export type IpcChannel = (typeof CHANNELS)[keyof typeof CHANNELS];
