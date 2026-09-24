import {
  getForgeVersionList,
  getLoaderArtifactListFor,
  getQuiltLoaderVersionsByMinecraft,
  getVersionList,
} from "@xmcl/installer";
import type { Loader } from "./profile.js";

const TTL_MS = 10 * 60 * 1000;
const NEOFORGE_META = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";

type CacheEntry = { expires: number; value: unknown };

const cache = new Map<string, CacheEntry>();

export class VersionListError extends Error {
  status = 502;

  constructor() {
    super("Version list is unavailable");
    this.name = "VersionListError";
  }
}

export function resetVersionCache(): void {
  cache.clear();
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  try {
    const value = await load();
    cache.set(key, { expires: Date.now() + TTL_MS, value });
    return value;
  } catch (error) {
    if (error instanceof VersionListError) throw error;
    throw new VersionListError();
  }
}

export function listReleaseIds(): Promise<string[]> {
  return cached("releases", async () => {
    const list = await getVersionList();
    return list.versions.filter((version) => version.type === "release").map((version) => version.id);
  });
}

function neoForgePrefix(mcVersion: string): string {
  const parts = mcVersion.split(".");
  const major = parts[1] ?? "";
  const minor = parts[2] ?? "0";
  return `${major}.${minor}.`;
}

async function fetchNeoForgeVersions(mcVersion: string): Promise<string[]> {
  const response = await fetch(NEOFORGE_META);
  if (!response.ok) throw new VersionListError();
  const data = (await response.json()) as { versions?: string[] };
  const versions = data.versions ?? [];
  const matching = versions.filter((version) => version.startsWith(neoForgePrefix(mcVersion)));
  const pool = matching.length ? matching : versions;
  if (!pool.length) throw new VersionListError();
  return pool;
}

export function loaderCatalog(
  mcVersion: string,
  loader: Exclude<Loader, "vanilla">,
): Promise<{ versions: string[]; recommended: string }> {
  return cached(`loaders:${loader}:${mcVersion}`, async () => {
    if (loader === "fabric") {
      const artifacts = await getLoaderArtifactListFor(mcVersion);
      const versions = artifacts.map((artifact) => artifact.loader.version);
      const recommended = artifacts.find((artifact) => artifact.loader.stable)?.loader.version ?? versions[0] ?? "";
      if (!recommended) throw new VersionListError();
      return { versions, recommended };
    }

    if (loader === "quilt") {
      const artifacts = await getQuiltLoaderVersionsByMinecraft({ minecraftVersion: mcVersion });
      const versions = artifacts.map((artifact) => artifact.loader.version);
      const recommended = artifacts.find((artifact) => artifact.loader.stable)?.loader.version ?? versions[0] ?? "";
      if (!recommended) throw new VersionListError();
      return { versions, recommended };
    }

    if (loader === "forge") {
      const list = await getForgeVersionList({ minecraft: mcVersion });
      const versions = list.versions.map((version) => version.version);
      const recommended =
        list.versions.find((version) => version.type === "recommended")?.version ??
        list.versions.find((version) => version.type === "latest")?.version ??
        versions[0] ??
        "";
      if (!recommended) throw new VersionListError();
      return { versions, recommended };
    }

    const versions = await fetchNeoForgeVersions(mcVersion);
    return { versions, recommended: versions[versions.length - 1] };
  });
}
