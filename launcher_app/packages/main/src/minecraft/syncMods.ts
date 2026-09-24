import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { Agent, request } from "undici";
import launcherProperties from "../config/launcherProperties";
import { reportProgress, sendPhase } from "../services/notifyService";

const modAgent = new Agent({
  connections: 4,
  connect: { timeout: 10_000 },
  headersTimeout: 20_000,
  bodyTimeout: 120_000,
});

interface ManifestFile {
  sha1: string;
  size: number;
}

function apiUrl(suffix: string): string {
  return `${launcherProperties.url.replace(/\/$/, "")}${suffix}`;
}

function sha1Of(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(filePath);
    let settled = false;
    const finish = (error?: NodeJS.ErrnoException, digest?: string) => {
      if (settled) return;
      settled = true;
      stream.destroy();
      if (error) reject(error);
      else resolve(digest ?? "");
    };
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", (error) => finish(error));
    stream.on("end", () => finish(undefined, hash.digest("hex")));
  });
}

async function walkFiles(dir: string): Promise<string[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

function manifestKey(mcDir: string, filePath: string): string {
  return path.relative(mcDir, filePath).split(path.sep).join("/");
}

function isModKey(key: string): boolean {
  const rest = key.startsWith("mods/") ? key.slice("mods/".length) : "";
  return rest.length > 0 && !rest.split("/").some((part) => part === "" || part === "." || part === "..");
}

async function matches(filePath: string, entry: ManifestFile): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile() || stat.size !== entry.size) return false;
  } catch {
    return false;
  }
  const hash = await sha1Of(filePath);
  return hash === entry.sha1;
}

function fileUrl(key: string): string {
  return apiUrl(`/v1/files/${key.split("/").map(encodeURIComponent).join("/")}`);
}

async function replaceFile(tmpPath: string, filePath: string): Promise<void> {
  try {
    await fs.promises.rename(tmpPath, filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EEXIST" && code !== "EPERM") throw error;
    await fs.promises.rm(filePath, { force: true });
    await fs.promises.rename(tmpPath, filePath);
  }
}

async function downloadFile(
  key: string,
  entry: ManifestFile,
  filePath: string,
  onBytes: (received: number) => void
): Promise<void> {
  const download = await request(fileUrl(key), {
    dispatcher: modAgent,
    signal: AbortSignal.timeout(60_000),
  });
  if (download.statusCode < 200 || download.statusCode >= 300) {
    await download.body.dump();
    throw new Error(`Не удалось скачать ${key}`);
  }

  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.part`;
  const hash = crypto.createHash("sha1");
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      onBytes(chunk.length);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(download.body, counter, fs.createWriteStream(tmpPath));
    const stat = await fs.promises.stat(tmpPath);
    const digest = hash.digest("hex");
    if (stat.size !== entry.size || digest !== entry.sha1) {
      throw new Error(`Файл ${key} не совпал с манифестом`);
    }
    await replaceFile(tmpPath, filePath);
  } finally {
    await fs.promises.rm(tmpPath, { force: true });
  }
}

async function pruneEmptyDirs(dir: string, keepRoot: boolean): Promise<void> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await pruneEmptyDirs(path.join(dir, entry.name), false);
    }
  }
  if (keepRoot) return;
  const left = await fs.promises.readdir(dir);
  if (left.length === 0) {
    await fs.promises.rmdir(dir);
  }
}

/**
 * Keeps mods/ aligned with the server manifest.
 * If the manifest cannot be read, the folder is left untouched.
 */
export async function syncModFiles(mcDir: string): Promise<void> {
  let response: Awaited<ReturnType<typeof request>>;
  try {
    response = await request(apiUrl("/v1/manifest"), {
      dispatcher: modAgent,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return;
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    await response.body.dump();
    return;
  }

  let files: Record<string, ManifestFile>;
  try {
    const body = (await response.body.json()) as { files?: Record<string, ManifestFile> };
    files = body.files ?? {};
  } catch {
    return;
  }

  const wanted = new Map<string, ManifestFile>();
  for (const [key, entry] of Object.entries(files)) {
    if (!isModKey(key) || !entry || typeof entry.sha1 !== "string" || typeof entry.size !== "number") continue;
    wanted.set(key, entry);
  }

  const modsDir = path.join(mcDir, "mods");
  const localFiles = await walkFiles(modsDir);
  const total = wanted.size;
  let checked = 0;
  sendPhase("Сверка модов");

  const toDownload: Array<[string, ManifestFile]> = [];
  for (const [key, entry] of wanted) {
    const filePath = path.join(mcDir, ...key.split("/"));
    if (!(await matches(filePath, entry))) toDownload.push([key, entry]);
    checked += 1;
    reportProgress({
      title: "Сверка модов",
      loadedBytes: null,
      totalBytes: null,
      completedItems: checked,
      totalItems: total,
    });
  }

  // The hash stream resolves on "end", before Windows drops the handle.
  await new Promise((resolve) => setImmediate(resolve));

  const toDelete = localFiles.filter((filePath) => !wanted.has(manifestKey(mcDir, filePath)));

  const totalBytes = toDownload.reduce((sum, [, entry]) => sum + entry.size, 0);
  let completedBytes = 0;
  let completedFiles = 0;
  for (const [key, entry] of toDownload) {
    const filePath = path.join(mcDir, ...key.split("/"));
    let received = 0;
    await downloadFile(key, entry, filePath, (chunkBytes) => {
      received += chunkBytes;
      reportProgress({
        title: "Скачивание модов",
        loadedBytes: completedBytes + received,
        totalBytes,
        completedItems: completedFiles,
        totalItems: toDownload.length,
      });
    });
    completedBytes += entry.size;
    completedFiles += 1;
    reportProgress({
      title: "Скачивание модов",
      loadedBytes: completedBytes,
      totalBytes,
      completedItems: completedFiles,
      totalItems: toDownload.length,
    });
  }

  if (toDelete.length > 0) {
    sendPhase("Удаление лишних модов");
    for (const filePath of toDelete) {
      await fs.promises.rm(filePath, { force: true });
    }
    await pruneEmptyDirs(modsDir, true);
  }

  setImmediate(() => sendPhase("", false));
}
