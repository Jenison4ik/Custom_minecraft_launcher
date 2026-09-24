import { app } from "electron";
import fs from "fs";
import path from "path";
import launcherProperties from "../config/launcherProperties";
import type { McCore } from "../config/launcherProperties";

export interface ProfileServer {
  ip: string;
  lable: string;
}

export interface GameProfile {
  mcVersion: string;
  loader: McCore;
  loaderVersion: string;
  servers: ProfileServer[];
}

const LOADERS: readonly McCore[] = ["vanilla", "fabric", "forge", "quilt", "neoforge"];

export class ProfileMissingError extends Error {
  constructor() {
    super("Сборка на сервере не задана");
    this.name = "ProfileMissingError";
  }
}

function cachePath(): string {
  return path.join(app.getPath("userData"), "profile.json");
}

export function parseProfile(value: unknown): GameProfile | null {
  if (!value || typeof value !== "object") return null;
  const record = value as {
    mcVersion?: unknown;
    loader?: unknown;
    loaderVersion?: unknown;
    servers?: unknown;
  };
  const mcVersion = typeof record.mcVersion === "string" ? record.mcVersion.trim() : "";
  const loaderVersion = typeof record.loaderVersion === "string" ? record.loaderVersion.trim() : "";
  if (!mcVersion || typeof record.loader !== "string" || !LOADERS.includes(record.loader as McCore)) {
    return null;
  }
  const loader = record.loader as McCore;
  if (loader !== "vanilla" && !loaderVersion) return null;
  if (!Array.isArray(record.servers)) return null;
  const servers: ProfileServer[] = [];
  for (const item of record.servers) {
    if (!item || typeof item !== "object") return null;
    const row = item as { ip?: unknown; lable?: unknown };
    const ip = typeof row.ip === "string" ? row.ip.trim() : "";
    const lable = typeof row.lable === "string" ? row.lable.trim() : "";
    if (!ip || !lable) return null;
    servers.push({ ip, lable });
  }
  return {
    mcVersion,
    loader,
    loaderVersion: loader === "vanilla" ? "" : loaderVersion,
    servers,
  };
}

export function readCachedProfile(): GameProfile | null {
  try {
    const raw = fs.readFileSync(cachePath(), "utf-8");
    return parseProfile(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeCachedProfile(profile: GameProfile): void {
  fs.writeFileSync(cachePath(), JSON.stringify(profile, null, 2), "utf-8");
}

function apiUrl(suffix: string): string {
  return `${launcherProperties.url.replace(/\/$/, "")}${suffix}`;
}

export async function fetchProfile(): Promise<GameProfile> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/v1/profile"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message);
  }
  if (response.status === 404) throw new ProfileMissingError();
  if (!response.ok) throw new Error(`Profile request failed (${response.status})`);
  const profile = parseProfile(await response.json());
  if (!profile) throw new Error("Profile is invalid");
  return profile;
}

export async function loadProfile(allowNetwork: boolean): Promise<{ profile: GameProfile; online: boolean }> {
  if (!allowNetwork) {
    const cached = readCachedProfile();
    if (!cached) {
      throw new Error("Нет сохранённой сборки. Нужен интернет для первого запуска.");
    }
    return { profile: cached, online: false };
  }

  try {
    const profile = await fetchProfile();
    writeCachedProfile(profile);
    return { profile, online: true };
  } catch (error) {
    if (error instanceof ProfileMissingError) throw error;
    const cached = readCachedProfile();
    if (!cached) {
      throw new Error("Нет связи с сервером и нет сохранённой сборки");
    }
    return { profile: cached, online: false };
  }
}
