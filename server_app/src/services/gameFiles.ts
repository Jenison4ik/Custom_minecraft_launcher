import fs from "fs/promises";
import path from "path";
import type { AppConfig } from "../config.js";
import { withFsLock } from "./lock.js";
import { resolveInside, SafePathError } from "./safePath.js";
import { hashFile, readManifest, writeManifest, type FileEntry, type Manifest } from "./manifest.js";

export interface ListedFile extends FileEntry {
  path: string;
}

export interface FilePage {
  total: number;
  limit: number;
  offset: number;
  files: ListedFile[];
}

async function currentManifest(config: AppConfig): Promise<Manifest> {
  return (await readManifest(config.dataDir)) ?? { files: {} };
}

export async function listGameFiles(
  config: AppConfig,
  query: string,
  limit: number,
  offset: number
): Promise<FilePage> {
  const manifest = await currentManifest(config);
  const needle = query.trim().toLowerCase();
  const matched = Object.entries(manifest.files)
    .filter(([filePath]) => filePath.toLowerCase().includes(needle))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([filePath, entry]) => ({ path: filePath, ...entry }));

  return {
    total: matched.length,
    limit,
    offset,
    files: matched.slice(offset, offset + limit),
  };
}

export async function saveGameFile(
  config: AppConfig,
  relativePath: string,
  tempFile: string
): Promise<FileEntry> {
  return withFsLock(async () => {
    const destination = resolveInside(config.gameDir, relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(tempFile, destination);
    await fs.rm(tempFile, { force: true });

    const entry = await hashFile(destination);
    const manifest = await currentManifest(config);
    manifest.files[relativePath.replace(/\\/g, "/")] = entry;
    await writeManifest(config.dataDir, manifest);
    return entry;
  });
}

export async function deleteGameFile(config: AppConfig, relativePath: string): Promise<void> {
  return withFsLock(async () => {
    const destination = resolveInside(config.gameDir, relativePath);
    const key = relativePath.replace(/\\/g, "/");
    const manifest = await currentManifest(config);
    const stat = await fs.stat(destination).catch(() => null);
    if (!stat && !(key in manifest.files)) {
      throw Object.assign(new Error("File not found"), { status: 404 });
    }
    if (stat?.isDirectory()) {
      throw Object.assign(new Error("Path is a directory"), { status: 400 });
    }
    if (stat) await fs.rm(destination, { force: true });
    delete manifest.files[key];
    await writeManifest(config.dataDir, manifest);
  });
}

export function isSafePathError(error: unknown): error is SafePathError {
  return error instanceof SafePathError;
}
