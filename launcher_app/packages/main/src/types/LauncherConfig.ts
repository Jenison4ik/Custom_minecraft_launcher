import type { McCore } from "../config/launcherProperties";

/**
 * User preferences from config.json (not game version).
 */
export interface UserSettings {
  nickname: string;
  ram: number;
  disableDownload: boolean;
  /** Optional pin for mod loader version (overrides launcherProperties when set) */
  loaderVersion?: string;
}

/**
 * Full game install/launch spec: properties + user settings.
 */
export interface GameSpec extends UserSettings {
  /** Vanilla Minecraft version id (e.g. 1.16.4) */
  mcVersion: string;
  loader: McCore;
  /** Optional pinned loader version */
  loaderVersion?: string;
}

/** @deprecated Prefer GameSpec; kept for transitional call sites */
export interface LauncherConfig {
  nickname: string;
  ram: number;
  disableDownload: boolean;
  id: string;
  loader: {
    type: McCore;
    version?: string;
  };
}
