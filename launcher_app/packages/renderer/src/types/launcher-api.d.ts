import type { LauncherAPI } from "@jenison/shared";

declare global {
  interface Window {
    launcherAPI: LauncherAPI;
  }
}

export {};
