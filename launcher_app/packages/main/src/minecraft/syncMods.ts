import crypto from "crypto";
import fs from "fs";
import path from "path";
import launcherProperties from "../config/launcherProperties";
import { sendPhase } from "../services/notifyService";

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
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
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
  if (!key.startsWith("mods/")) return false;
  const rest = key.slice("mods/".length);
  return rest.length > 0 && !rest.split("/").some((part) => part === "" || part === "." || part === "..");
}

async function matches(filePath: string, entry: ManifestFile): Promise<boolean> {
  const stat = await fs.promises.stat(filePath);
  if (stat.size !== entry.size) return false;
  const hash = await sha1Of(filePath);
  return hash === entry.sha1;
}

/**
 * Keeps mods/ aligned with the server manifest.
 * If the manifest cannot be read, the folder is left untouched.
 */
export async function syncModFiles(mcDir: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/v1/manifest"));
  } catch {
    return;
  }
  if (!response.ok) return;

  let files: Record<string, ManifestFile>;
  try {
    const body = (await response.json()) as { files?: Record<string, ManifestFile> };
    files = body.files ?? {};
  } catch {
    return;
  }

  const wanted = new Map<string, ManifestFile>();
  for (const [key, entry] of Object.entries(files)) {
    if (!isModKey(key) || !entry || typeof entry.sha1 !== "string" || typeof entry.size !== "number") continue;
    wanted.set(key, entry);
  }

  sendPhase("Сверка модов");
  const modsDir = path.join(mcDir, "mods");
  const localFiles = await walkFiles(modsDir);
  for (const filePath of localFiles) {
    const key = manifestKey(mcDir, filePath);
    if (!wanted.has(key)) {
      await fs.promises.rm(filePath, { force: true });
    }
  }

  for (const [key, entry] of wanted) {
    const filePath = path.join(mcDir, ...key.split("/"));
    if (fs.existsSync(filePath) && (await matches(filePath, entry))) continue;
    const download = await fetch(apiUrl(`/v1/files/${key.split("/").map(encodeURIComponent).join("/")}`));
    if (!download.ok) {
      throw new Error(`Не удалось скачать ${key}`);
    }
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const bytes = Buffer.from(await download.arrayBuffer());
    await fs.promises.writeFile(filePath, bytes);
  }
}
