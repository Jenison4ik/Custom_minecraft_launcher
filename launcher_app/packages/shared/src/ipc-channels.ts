export const CHANNELS = {
  getConfigs: "get-configs",
  getMemSize: "get-mem-size",
  runMinecraft: "run-minecraft",
  addToConfigs: "add-to-configs",
  openLauncherDir: "open-launcher-dir",
  downloadMinecraft: "download-minecraft",
  isLaunched: "is-launched",
  getLauncherInfo: "get-launcher-info",
  pickJavaPath: "pick-java-path",
  checkForUpdates: "check-for-updates",
  openGameDir: "open-game-dir",
  openGameLogs: "open-game-logs",
  showErrorToast: "show-error-toast",
  showDownloadStatus: "show-download-status",
  launchMinecraft: "launch-minecraft",
} as const;

export type IpcChannel = (typeof CHANNELS)[keyof typeof CHANNELS];
