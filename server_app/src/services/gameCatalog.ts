import {
  getLoaderArtifactListFor,
  getQuiltLoaderVersionsByMinecraft,
  getVersionList,
} from "@xmcl/installer";
import type { Loader } from "./profile.js";

const TTL_MS = 10 * 60 * 1000;
const NEOFORGE_META = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";
const FORGE_MAVEN_METADATA = "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml";
const FORGE_PROMOTIONS = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";

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
    console.error(error);
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

function compareForgeVersions(left: string, right: string): number {
  const a = left.split(".").map((part) => Number.parseInt(part, 10));
  const b = right.split(".").map((part) => Number.parseInt(part, 10));
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (Number.isFinite(diff) && diff !== 0) return diff;
  }
  return left.localeCompare(right);
}

async function fetchForgeVersions(mcVersion: string): Promise<{ versions: string[]; recommended: string }> {
  const [metaResponse, promoResponse] = await Promise.all([
    fetch(FORGE_MAVEN_METADATA),
    fetch(FORGE_PROMOTIONS),
  ]);
  if (!metaResponse.ok) throw new VersionListError();

  const xml = await metaResponse.text();
  const prefix = `${mcVersion}-`;
  const versions = [
    ...new Set(
      [...xml.matchAll(/<version>([^<]+)<\/version>/g)]
        .map((match) => match[1])
        .filter((version) => version.startsWith(prefix))
        .map((version) => version.slice(prefix.length)),
    ),
  ].sort((left, right) => compareForgeVersions(right, left));
  if (!versions.length) throw new VersionListError();

  let recommended = versions[0];
  if (promoResponse.ok) {
    const data = (await promoResponse.json()) as { promos?: Record<string, string> };
    const promos = data.promos ?? {};
    const preferred = promos[`${mcVersion}-recommended`] ?? promos[`${mcVersion}-latest`];
    if (preferred && versions.includes(preferred)) recommended = preferred;
  }
  return { versions, recommended };
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
      return fetchForgeVersions(mcVersion);
    }

    const versions = await fetchNeoForgeVersions(mcVersion);
    return { versions, recommended: versions[versions.length - 1] };
  });
}
