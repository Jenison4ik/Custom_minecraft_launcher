import configService from "../services/configService";

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

export interface LaunchPrefs {
  windowWidth: number;
  windowHeight: number;
  fullscreen: boolean;
  closeOnLaunch: boolean;
  javaPath: string;
  jvmArgs: string[];
}

function positiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseJvmArgs(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^-Xm[sx]/i.test(line));
}

export function readLaunchPrefs(): LaunchPrefs {
  const user = configService.getAll();
  return {
    windowWidth: positiveInt(user.windowWidth, DEFAULT_WIDTH),
    windowHeight: positiveInt(user.windowHeight, DEFAULT_HEIGHT),
    fullscreen: user.fullscreen === true,
    closeOnLaunch: user.closeOnLaunch === true,
    javaPath: typeof user.javaPath === "string" ? user.javaPath.trim() : "",
    jvmArgs: parseJvmArgs(user.jvmArgs),
  };
}
