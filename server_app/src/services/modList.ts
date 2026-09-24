import fs from "fs/promises";
import path from "path";
import {
  readFabricMod,
  readForgeModJson,
  readForgeModToml,
  readQuiltMod,
  type FabricModMetadata,
  type ForgeModMcmodInfo,
  type ForgeModTOMLData,
  type QuiltModMetadata,
} from "@xmcl/mod-parser";
import { resolveFileSystem, type FileSystem } from "@xmcl/system";
import type { AppConfig } from "../config.js";
import { readManifest, type FileEntry } from "./manifest.js";
import { resolveInside } from "./safePath.js";

export interface ListedMod {
  id: string;
  name: string;
  description: string;
  fileName: string;
  path: string;
  iconDataUrl: string | null;
}

export interface ModPage {
  total: number;
  limit: number;
  offset: number;
  mods: ListedMod[];
}

interface ParsedMod {
  modid: string;
  name: string;
  description: string;
  iconDataUrl: string | null;
}

interface CachedJar {
  sha1: string;
  size: number;
  mods: ParsedMod[];
}

const cache = new Map<string, CachedJar>();
const maxIconBytes = 1024 * 1024;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isModJar(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.startsWith("mods/") && normalized.toLowerCase().endsWith(".jar");
}

function iconPathOf(icon: unknown): string | null {
  if (typeof icon === "string") {
    const trimmed = icon.trim();
    return trimmed || null;
  }
  if (!icon || typeof icon !== "object" || Array.isArray(icon)) return null;
  const pairs = Object.entries(icon as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim() !== ""
  );
  if (pairs.length === 0) return null;
  pairs.sort((left, right) => {
    const leftSize = Number(left[0]);
    const rightSize = Number(right[0]);
    if (Number.isFinite(leftSize) && Number.isFinite(rightSize)) return rightSize - leftSize;
    return 0;
  });
  return pairs[0][1].trim();
}

function toPngDataUrl(bytes: Uint8Array): string | null {
  if (bytes.length < 8 || bytes.length > maxIconBytes) return null;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

async function readPng(jar: FileSystem, iconPath: string): Promise<string | null> {
  const normalized = iconPath.replace(/\\/g, "/").replace(/^\.?\//, "");
  if (!normalized || normalized.split("/").some((segment) => segment === ".." || segment === "")) {
    return null;
  }
  for (const candidate of [normalized, `/${normalized}`]) {
    try {
      if (!(await jar.existsFile(candidate))) continue;
      const bytes = await jar.readFile(candidate);
      const url = toPngDataUrl(bytes);
      if (url) return url;
    } catch {
      /* try the next path */
    }
  }
  return null;
}

async function withIcons(
  jar: FileSystem,
  mods: { modid: string; name: string; description: string; iconPath: string | null }[]
): Promise<ParsedMod[]> {
  const icons = new Map<string, string | null>();
  const result: ParsedMod[] = [];
  for (const mod of mods) {
    let iconDataUrl: string | null = null;
    if (mod.iconPath) {
      const cached = icons.get(mod.iconPath);
      iconDataUrl = cached !== undefined ? cached : await readPng(jar, mod.iconPath);
      icons.set(mod.iconPath, iconDataUrl);
    }
    result.push({
      modid: mod.modid,
      name: mod.name,
      description: mod.description,
      iconDataUrl,
    });
  }
  return result;
}

async function readFabric(jar: FileSystem): Promise<ParsedMod[] | null> {
  try {
    const meta = (await readFabricMod(jar)) as FabricModMetadata;
    const modid = text(meta?.id);
    if (!modid) return null;
    return withIcons(jar, [
      {
        modid,
        name: text(meta.name) || modid,
        description: text(meta.description),
        iconPath: iconPathOf(meta.icon),
      },
    ]);
  } catch {
    return null;
  }
}

async function readQuilt(jar: FileSystem): Promise<ParsedMod[] | null> {
  try {
    const meta = (await readQuiltMod(jar)) as QuiltModMetadata;
    const modid = text(meta?.quilt_loader?.id);
    if (!modid) return null;
    const metadata = meta.quilt_loader.metadata;
    return withIcons(jar, [
      {
        modid,
        name: text(metadata?.name) || modid,
        description: text(metadata?.description),
        iconPath: iconPathOf(metadata?.icon),
      },
    ]);
  } catch {
    return null;
  }
}

function fromForgeJson(mod: ForgeModMcmodInfo, fileName: string) {
  const modid = text(mod.modid);
  return {
    modid,
    name: text(mod.name) || modid || fileName,
    description: text(mod.description),
    iconPath: text(mod.logoFile) || null,
  };
}

function fromForgeToml(mod: ForgeModTOMLData, fileName: string) {
  const modid = text(mod.modid);
  return {
    modid,
    name: text(mod.displayName) || modid || fileName,
    description: text(mod.description),
    iconPath: text(mod.logoFile) || null,
  };
}

async function readForge(jar: FileSystem, fileName: string): Promise<ParsedMod[]> {
  const json = await readForgeModJson(jar).catch(() => [] as ForgeModMcmodInfo[]);
  const toml = await readForgeModToml(jar).catch(() => [] as ForgeModTOMLData[]);
  const neo =
    toml.length > 0
      ? []
      : await readForgeModToml(jar, {}, "neoforge.mods.toml").catch(() => [] as ForgeModTOMLData[]);
  const tomlMods = (toml.length > 0 ? toml : neo).map((mod) => fromForgeToml(mod, fileName));
  const merged = new Map<string, ReturnType<typeof fromForgeJson>>();
  json.forEach((mod, index) => {
    const parsed = fromForgeJson(mod, fileName);
    merged.set(parsed.modid || `json-${index}`, parsed);
  });
  tomlMods.forEach((mod, index) => {
    merged.set(mod.modid || `toml-${index}`, mod);
  });
  if (merged.size === 0) return [];
  return withIcons(jar, [...merged.values()]);
}

async function parseJar(absolutePath: string, fileName: string): Promise<ParsedMod[]> {
  const jar = await resolveFileSystem(absolutePath);
  try {
    const fabric = await readFabric(jar);
    if (fabric && fabric.length > 0) return fabric;
    const quilt = await readQuilt(jar);
    if (quilt && quilt.length > 0) return quilt;
    const forge = await readForge(jar, fileName);
    if (forge.length > 0) return forge;
    return [];
  } finally {
    jar.close();
  }
}

function fallback(fileName: string): ParsedMod[] {
  return [{ modid: "", name: fileName, description: "", iconDataUrl: null }];
}

function toListed(relativePath: string, mods: ParsedMod[]): ListedMod[] {
  const fileName = path.posix.basename(relativePath);
  const seen = new Map<string, number>();
  return mods.map((mod, index) => {
    const base = `${relativePath}#${mod.modid || index}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return {
      id: count === 0 ? base : `${base}#${count}`,
      name: mod.name || fileName,
      description: mod.description,
      fileName,
      path: relativePath,
      iconDataUrl: mod.iconDataUrl,
    };
  });
}

async function loadJar(config: AppConfig, relativePath: string, entry: FileEntry): Promise<ListedMod[]> {
  const fileName = path.posix.basename(relativePath);
  const cached = cache.get(relativePath);
  if (cached && cached.sha1 === entry.sha1 && cached.size === entry.size) {
    return toListed(relativePath, cached.mods);
  }

  let mods = fallback(fileName);
  try {
    const absolute = resolveInside(config.gameDir, relativePath);
    const stat = await fs.stat(absolute).catch(() => null);
    if (stat?.isFile()) {
      const parsed = await parseJar(absolute, fileName);
      mods = parsed.length > 0 ? parsed : fallback(fileName);
      cache.set(relativePath, { sha1: entry.sha1, size: entry.size, mods });
    }
  } catch {
    mods = fallback(fileName);
  }
  return toListed(relativePath, mods);
}

export async function listMods(
  config: AppConfig,
  query: string,
  limit: number,
  offset: number
): Promise<ModPage> {
  const manifest = (await readManifest(config.dataDir)) ?? { files: {} };
  const jars = Object.entries(manifest.files).filter(([filePath]) => isModJar(filePath));
  const present = new Set(jars.map(([filePath]) => filePath));
  for (const key of cache.keys()) {
    if (!present.has(key)) cache.delete(key);
  }

  const listed = (await Promise.all(jars.map(([filePath, entry]) => loadJar(config, filePath, entry)))).flat();
  const needle = query.trim().toLowerCase();
  const matched = listed
    .filter((mod) => {
      if (!needle) return true;
      return (
        mod.name.toLowerCase().includes(needle) ||
        mod.description.toLowerCase().includes(needle) ||
        mod.fileName.toLowerCase().includes(needle)
      );
    })
    .sort((left, right) => {
      const byName = left.name.localeCompare(right.name, "ru");
      if (byName !== 0) return byName;
      const byFile = left.fileName.localeCompare(right.fileName, "ru");
      if (byFile !== 0) return byFile;
      return left.id.localeCompare(right.id);
    });

  return {
    total: matched.length,
    limit,
    offset,
    mods: matched.slice(offset, offset + limit),
  };
}
