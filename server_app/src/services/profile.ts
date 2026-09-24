import fs from "fs/promises";
import path from "path";
import { loaderCatalog, listReleaseIds, VersionListError } from "./gameCatalog.js";

export const LOADERS = ["vanilla", "fabric", "forge", "quilt", "neoforge"] as const;
export type Loader = (typeof LOADERS)[number];

export interface ProfileServer {
  ip: string;
  lable: string;
}

export interface GameProfile {
  mcVersion: string;
  loader: Loader;
  loaderVersion: string;
  servers: ProfileServer[];
}

export class ProfileError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ProfileError";
    this.status = status;
  }
}

export function profilePath(dataDir: string): string {
  return path.join(dataDir, "profile.json");
}

function isLoader(value: unknown): value is Loader {
  return typeof value === "string" && (LOADERS as readonly string[]).includes(value);
}

function readServers(value: unknown): ProfileServer[] {
  if (!Array.isArray(value)) {
    throw new ProfileError(400, "Invalid profile");
  }
  const servers: ProfileServer[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      throw new ProfileError(400, "Invalid profile");
    }
    const record = item as { ip?: unknown; lable?: unknown };
    const ip = typeof record.ip === "string" ? record.ip.trim() : "";
    const lable = typeof record.lable === "string" ? record.lable.trim() : "";
    if (!ip && !lable) continue;
    if (!ip || !lable) {
      throw new ProfileError(400, "Invalid profile");
    }
    servers.push({ ip, lable });
  }
  return servers;
}

export function parseStoredProfile(value: unknown): GameProfile {
  if (!value || typeof value !== "object") {
    throw new ProfileError(500, "Profile is invalid");
  }
  const record = value as { mcVersion?: unknown; loader?: unknown; loaderVersion?: unknown; servers?: unknown };
  const mcVersion = typeof record.mcVersion === "string" ? record.mcVersion.trim() : "";
  const loaderVersion = typeof record.loaderVersion === "string" ? record.loaderVersion.trim() : "";
  if (!mcVersion || !isLoader(record.loader)) {
    throw new ProfileError(500, "Profile is invalid");
  }
  if (record.loader !== "vanilla" && !loaderVersion) {
    throw new ProfileError(500, "Profile is invalid");
  }
  return {
    mcVersion,
    loader: record.loader,
    loaderVersion: record.loader === "vanilla" ? "" : loaderVersion,
    servers: readServers(record.servers),
  };
}

export async function readProfile(dataDir: string): Promise<GameProfile | null> {
  try {
    const raw = await fs.readFile(profilePath(dataDir), "utf-8");
    return parseStoredProfile(JSON.parse(raw) as unknown);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: string }).code : "";
    if (code === "ENOENT") return null;
    if (error instanceof ProfileError) throw error;
    throw new ProfileError(500, "Profile is invalid");
  }
}

async function writeProfile(dataDir: string, profile: GameProfile): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(profilePath(dataDir), JSON.stringify(profile, null, 2));
}

export async function saveProfile(dataDir: string, body: unknown): Promise<GameProfile> {
  if (!body || typeof body !== "object") {
    throw new ProfileError(400, "Invalid profile");
  }
  const record = body as { mcVersion?: unknown; loader?: unknown; loaderVersion?: unknown; servers?: unknown };
  const mcVersion = typeof record.mcVersion === "string" ? record.mcVersion.trim() : "";
  const requestedLoaderVersion = typeof record.loaderVersion === "string" ? record.loaderVersion.trim() : "";
  if (!mcVersion || !isLoader(record.loader)) {
    throw new ProfileError(400, "Invalid profile");
  }

  let releases: string[];
  try {
    releases = await listReleaseIds();
  } catch (error) {
    if (error instanceof VersionListError) throw error;
    throw new VersionListError();
  }
  if (!releases.includes(mcVersion)) {
    throw new ProfileError(400, "Unknown Minecraft version");
  }

  let loaderVersion = "";
  if (record.loader !== "vanilla") {
    const catalog = await loaderCatalog(mcVersion, record.loader);
    if (!requestedLoaderVersion) {
      if (!catalog.recommended) throw new VersionListError();
      loaderVersion = catalog.recommended;
    } else if (!catalog.versions.includes(requestedLoaderVersion)) {
      throw new ProfileError(400, "Unknown loader version");
    } else {
      loaderVersion = requestedLoaderVersion;
    }
  }

  const profile: GameProfile = {
    mcVersion,
    loader: record.loader,
    loaderVersion,
    servers: readServers(record.servers),
  };
  await writeProfile(dataDir, profile);
  return profile;
}
