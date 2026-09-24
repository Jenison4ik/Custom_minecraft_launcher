import { createWriteStream } from "fs";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { setDefaultResultOrder } from "node:dns";

setDefaultResultOrder("ipv4first");
import {
  ModrinthV2Client,
  type ProjectVersion,
  type SearchResultHit,
} from "@xmcl/modrinth";
import {
  CurseforgeV1Client,
  FileModLoaderType,
  FileReleaseType,
  getCurseforgeFileDownloadUrls,
  type Mod,
  type File as CurseforgeFile,
} from "@xmcl/curseforge";
import type { AppConfig } from "../config.js";
import { rememberCatalogMod } from "./catalogMods.js";
import { saveGameFile } from "./gameFiles.js";

const MAX_JAR_BYTES = 100 * 1024 * 1024;
const PAGE_LIMIT = 20;

const MODRINTH_HOSTS = new Set(["cdn.modrinth.com"]);
const CURSEFORGE_HOSTS = new Set([
  "edge.forgecdn.net",
  "mediafiles.forgecdn.net",
  "mediafilez.forgecdn.net",
]);

const LOADERS = ["fabric", "forge", "neoforge", "quilt"] as const;

export type CatalogSource = "modrinth" | "curseforge";
export type ModLoader = (typeof LOADERS)[number];

export interface CatalogHit {
  id: string;
  slug: string;
  title: string;
  description: string;
  iconUrl: string | null;
}

export interface CatalogPage {
  total: number;
  hits: CatalogHit[];
}

export interface CatalogInstall {
  path: string;
  sha1: string;
  size: number;
}

export class CatalogError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CatalogError";
    this.status = status;
  }
}

function isTransient(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "cause" in error
      ? (error.cause as { code?: string } | undefined)?.code
      : undefined;
  const direct = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  return (
    code === "UND_ERR_SOCKET" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    direct === "UND_ERR_SOCKET" ||
    direct === "ECONNRESET"
  );
}

async function catalogFetch(input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      last = error;
      if (attempt === 2 || !isTransient(error)) break;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw last;
}

const CURSEFORGE_LOADERS: Record<ModLoader, FileModLoaderType> = {
  forge: FileModLoaderType.Forge,
  fabric: FileModLoaderType.Fabric,
  quilt: FileModLoaderType.Quilt,
  neoforge: FileModLoaderType.NeoForge,
};

function modrinthClient(): ModrinthV2Client {
  return new ModrinthV2Client({
    headers: { "User-Agent": "jenison-mc-launcher/0.0.1 (admin catalog)" },
    fetch: catalogFetch,
  });
}

function curseforgeClient(apiKey: string): CurseforgeV1Client {
  return new CurseforgeV1Client(apiKey, { fetch: catalogFetch });
}

function requireFilters(gameVersion: string, loader: string): ModLoader {
  const version = gameVersion.trim();
  if (!/^[0-9][0-9A-Za-z._-]{0,31}$/.test(version)) {
    throw new CatalogError(400, "Укажите версию и загрузчик");
  }
  if (!LOADERS.includes(loader as ModLoader)) {
    throw new CatalogError(400, "Укажите версию и загрузчик");
  }
  return loader as ModLoader;
}

function requireSource(source: string): CatalogSource {
  if (source !== "modrinth" && source !== "curseforge") {
    throw new CatalogError(400, "Неизвестный каталог");
  }
  return source;
}

function allowedUrl(raw: string, hosts: Set<string>): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CatalogError(400, "Ссылка на файл отклонена");
  }
  if (url.protocol !== "https:" || !hosts.has(url.hostname)) {
    throw new CatalogError(400, "Ссылка на файл отклонена");
  }
  return url;
}

function jarFileName(filename: string): string {
  const base = path.basename(filename).replace(/[^\w.+-]/g, "_");
  if (!base.toLowerCase().endsWith(".jar") || base === ".jar" || base.length > 180) {
    throw new CatalogError(400, "Можно скачивать только .jar");
  }
  return base;
}

function modrinthHit(hit: SearchResultHit): CatalogHit {
  return {
    id: hit.project_id,
    slug: hit.slug || "",
    title: hit.title,
    description: hit.description,
    iconUrl: hit.icon_url || null,
  };
}

function curseforgeHit(mod: Mod): CatalogHit {
  const logo = mod.logo;
  return {
    id: String(mod.id),
    slug: mod.slug || "",
    title: mod.name,
    description: mod.summary,
    iconUrl: logo?.thumbnailUrl || logo?.url || null,
  };
}

function pickModrinthFile(versions: ProjectVersion[]): { url: string; filename: string } {
  const release = versions.find((version) => version.version_type === "release");
  if (!release) throw new CatalogError(404, "Релиз для этой версии не найден");
  const jars = release.files.filter(
    (file) => file.filename.toLowerCase().endsWith(".jar") && isHost(file.url, MODRINTH_HOSTS)
  );
  const file = jars.find((entry) => entry.primary) ?? jars[0];
  if (!file) throw new CatalogError(404, "У релиза нет .jar");
  return { url: file.url, filename: file.filename };
}

function isHost(raw: string, hosts: Set<string>): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && hosts.has(url.hostname);
  } catch {
    return false;
  }
}

function pickCurseforgeFile(files: CurseforgeFile[]): { url: string; filename: string } {
  const releases = files
    .filter(
      (file) =>
        file.releaseType === FileReleaseType.Release && file.fileName.toLowerCase().endsWith(".jar")
    )
    .sort((a, b) => b.fileDate.localeCompare(a.fileDate));
  for (const file of releases) {
    const candidates = getCurseforgeFileDownloadUrls(file.id, file.fileName, file.downloadUrl);
    const url = candidates.find((candidate) => isHost(candidate, CURSEFORGE_HOSTS));
    if (url) return { url, filename: file.fileName };
  }
  throw new CatalogError(404, "Релиз для этой версии не найден");
}

async function downloadJar(rawUrl: string, dest: string, hosts: Set<string>): Promise<void> {
  const url = allowedUrl(rawUrl, hosts);
  let response: Response;
  try {
    response = await catalogFetch(url);
  } catch (error) {
    console.error(error);
    throw new CatalogError(502, "Не удалось скачать мод");
  }
  const finalUrl = allowedUrl(response.url || url.href, hosts);
  if (finalUrl.hostname !== url.hostname && !hosts.has(finalUrl.hostname)) {
    throw new CatalogError(400, "Ссылка на файл отклонена");
  }
  if (!response.ok || !response.body) {
    throw new CatalogError(502, "Не удалось скачать мод");
  }
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_JAR_BYTES) {
    throw new CatalogError(400, "Файл мода слишком большой");
  }

  const stream = createWriteStream(dest);
  let received = 0;
  try {
    for await (const chunk of response.body) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += buffer.length;
      if (received > MAX_JAR_BYTES) throw new CatalogError(400, "Файл мода слишком большой");
      if (!stream.write(buffer)) {
        await new Promise<void>((resolve) => stream.once("drain", () => resolve()));
      }
    }
    await new Promise<void>((resolve, reject) => {
      stream.end(() => resolve());
      stream.on("error", reject);
    });
  } catch (error) {
    stream.destroy();
    await fs.rm(dest, { force: true });
    throw error;
  }
}

export async function searchCatalog(
  config: AppConfig,
  sourceRaw: string,
  query: string,
  gameVersion: string,
  loaderRaw: string,
  offset: number
): Promise<CatalogPage> {
  const source = requireSource(sourceRaw);
  const loader = requireFilters(gameVersion, loaderRaw);
  const version = gameVersion.trim();
  const q = query.trim();

  if (source === "modrinth") {
    const facets = JSON.stringify([
      ["project_type:mod"],
      [`versions:${version}`],
      [`categories:${loader}`],
    ]);
    let result;
    try {
      result = await modrinthClient().searchProjects({
        query: q,
        facets,
        limit: PAGE_LIMIT,
        offset,
        index: q ? "relevance" : "downloads",
      });
    } catch (error) {
      if (error instanceof CatalogError) throw error;
      console.error(error);
      throw new CatalogError(502, "Каталог временно недоступен");
    }
    return { total: result.total_hits, hits: result.hits.map(modrinthHit) };
  }

  if (!config.curseforgeApiKey) {
    throw new CatalogError(503, "Ключ CurseForge не задан");
  }
  try {
    const result = await curseforgeClient(config.curseforgeApiKey).searchMods({
      gameId: 432,
      classId: 6,
      searchFilter: q,
      gameVersion: version,
      modLoaderType: CURSEFORGE_LOADERS[loader],
      index: offset,
      pageSize: PAGE_LIMIT,
    });
    return { total: result.pagination.totalCount, hits: result.data.map(curseforgeHit) };
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    console.error(error);
    throw new CatalogError(502, "Каталог временно недоступен");
  }
}

export async function installCatalogMod(
  config: AppConfig,
  sourceRaw: string,
  projectId: string,
  gameVersion: string,
  loaderRaw: string
): Promise<CatalogInstall> {
  const source = requireSource(sourceRaw);
  const loader = requireFilters(gameVersion, loaderRaw);
  const version = gameVersion.trim();
  if (!/^[A-Za-z0-9]+$/.test(projectId)) {
    throw new CatalogError(400, "Неизвестный мод");
  }

  let file: { url: string; filename: string };
  let hosts: Set<string>;
  try {
    if (source === "modrinth") {
      const versions = await modrinthClient().getProjectVersions(projectId, {
        loaders: [loader],
        gameVersions: [version],
      });
      file = pickModrinthFile(versions);
      hosts = MODRINTH_HOSTS;
    } else {
      if (!config.curseforgeApiKey) throw new CatalogError(503, "Ключ CurseForge не задан");
      const modId = Number(projectId);
      if (!Number.isInteger(modId)) throw new CatalogError(400, "Неизвестный мод");
      const files = await curseforgeClient(config.curseforgeApiKey).getModFiles({
        modId,
        gameVersion: version,
        modLoaderType: CURSEFORGE_LOADERS[loader],
        pageSize: 50,
      });
      file = pickCurseforgeFile(files.data);
      hosts = CURSEFORGE_HOSTS;
    }
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    console.error(error);
    throw new CatalogError(502, "Каталог временно недоступен");
  }

  const relativePath = `mods/${jarFileName(file.filename)}`;
  await fs.mkdir(config.uploadsDir, { recursive: true });
  const temp = path.join(config.uploadsDir, `mod-${randomUUID()}`);
  try {
    await downloadJar(file.url, temp, hosts);
    const entry = await saveGameFile(config, relativePath, temp);
    await rememberCatalogMod(config.dataDir, relativePath, source, projectId);
    return { path: relativePath, ...entry };
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}
