import crypto from "crypto";
import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";

export interface FileEntry {
  sha1: string;
  size: number;
}

export interface Manifest {
  files: Record<string, FileEntry>;
}

export function manifestPath(dataDir: string): string {
  return path.join(dataDir, "manifest.json");
}

export async function hashFile(filePath: string): Promise<FileEntry> {
  const hash = crypto.createHash("sha1");
  const stat = await fs.stat(filePath);
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return { sha1: hash.digest("hex"), size: stat.size };
}

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

export async function buildManifest(gameDir: string): Promise<Manifest> {
  const manifest: Manifest = { files: {} };
  try {
    await fs.access(gameDir);
  } catch {
    return manifest;
  }

  const files = await walk(gameDir);
  for (const file of files) {
    const key = path.relative(gameDir, file).replace(/\\/g, "/");
    manifest.files[key] = await hashFile(file);
  }
  return manifest;
}

export async function readManifest(dataDir: string): Promise<Manifest | null> {
  try {
    const raw = await fs.readFile(manifestPath(dataDir), "utf-8");
    const parsed = JSON.parse(raw) as Manifest;
    if (!parsed || typeof parsed.files !== "object" || parsed.files === null) {
      return { files: {} };
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeManifest(dataDir: string, manifest: Manifest): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(manifestPath(dataDir), JSON.stringify(manifest, null, 2));
}

export async function ensureManifest(gameDir: string, dataDir: string): Promise<Manifest> {
  const existing = await readManifest(dataDir);
  if (existing) return existing;
  const built = await buildManifest(gameDir);
  await writeManifest(dataDir, built);
  return built;
}
