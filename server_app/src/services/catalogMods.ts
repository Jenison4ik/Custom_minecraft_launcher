import fs from "fs/promises";
import path from "path";

export type CatalogModSource = "modrinth" | "curseforge";

export interface CatalogModRef {
  source: CatalogModSource;
  projectId: string;
  path: string;
}

interface CatalogModStore {
  mods: Record<string, { source: CatalogModSource; projectId: string }>;
}

function storePath(dataDir: string): string {
  return path.join(dataDir, "catalog-mods.json");
}

function normalizePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}

function isSource(value: unknown): value is CatalogModSource {
  return value === "modrinth" || value === "curseforge";
}

async function readStore(dataDir: string): Promise<CatalogModStore> {
  try {
    const parsed = JSON.parse(await fs.readFile(storePath(dataDir), "utf-8")) as CatalogModStore;
    if (!parsed?.mods || typeof parsed.mods !== "object") return { mods: {} };
    return parsed;
  } catch {
    return { mods: {} };
  }
}

async function writeStore(dataDir: string, store: CatalogModStore): Promise<void> {
  await fs.writeFile(storePath(dataDir), JSON.stringify(store, null, 2));
}

export async function rememberCatalogMod(
  dataDir: string,
  relativePath: string,
  source: CatalogModSource,
  projectId: string,
): Promise<void> {
  const store = await readStore(dataDir);
  store.mods[normalizePath(relativePath)] = { source, projectId };
  await writeStore(dataDir, store);
}

export async function forgetCatalogMod(dataDir: string, relativePath: string): Promise<void> {
  const store = await readStore(dataDir);
  const key = normalizePath(relativePath);
  if (!store.mods[key]) return;
  delete store.mods[key];
  await writeStore(dataDir, store);
}

export async function listCatalogMods(dataDir: string, present: Set<string>): Promise<CatalogModRef[]> {
  const store = await readStore(dataDir);
  return Object.entries(store.mods)
    .filter((entry): entry is [string, { source: CatalogModSource; projectId: string }] => {
      const [filePath, ref] = entry;
      return present.has(filePath) && isSource(ref?.source) && typeof ref.projectId === "string" && ref.projectId !== "";
    })
    .map(([filePath, ref]) => ({ path: filePath, source: ref.source, projectId: ref.projectId }));
}
