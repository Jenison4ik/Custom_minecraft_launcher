import fs from "fs/promises";
import {
  readFabricMod,
  readForgeModToml,
  readQuiltMod,
  type FabricModMetadata,
  type ForgeModTOMLData,
  type QuiltModMetadata,
} from "@xmcl/mod-parser";
import { resolveFileSystem, type FileSystem } from "@xmcl/system";
import type { AppConfig } from "../config.js";
import { readManifest } from "./manifest.js";
import { readProfile } from "./profile.js";
import { resolveInside } from "./safePath.js";

export interface ModIssue {
  modName: string;
  message: string;
}

interface VersionRule {
  id: string;
  ranges: string[];
  unlessId?: string;
}

export interface DeclaredMod {
  id: string;
  name: string;
  version: string;
  loaders: string[];
  provides: string[];
  requires: VersionRule[];
  breaks: VersionRule[];
  minecraft?: string[];
}

const RUNTIME_IDS = new Set(["java", "fabricloader", "quilt_loader", "forge", "neoforge"]);

const LOADER_LABEL: Record<string, string> = {
  fabric: "Fabric",
  forge: "Forge",
  quilt: "Quilt",
  neoforge: "NeoForge",
};

// Forge 52.0.1 treats mods that explicitly allow 1.21 as compatible with 1.21.1.
const MINECRAFT_ALIASES: Record<string, string[]> = {
  "1.21.1": ["1.21"],
};

const LOADER_ORDER = ["fabric", "quilt", "forge", "neoforge"] as const;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function modIdOf(raw: string): string {
  const trimmed = raw.trim();
  const colon = trimmed.lastIndexOf(":");
  return (colon >= 0 ? trimmed.slice(colon + 1) : trimmed).toLowerCase();
}

function isModJar(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.startsWith("mods/") && normalized.toLowerCase().endsWith(".jar");
}

function stripBuild(version: string): string {
  return version.split("+")[0].trim();
}

function compareVersions(left: string, right: string): number {
  const a = stripBuild(left).split(/[.\-_]/).filter(Boolean);
  const b = stripBuild(right).split(/[.\-_]/).filter(Boolean);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const x = a[index] ?? "0";
    const y = b[index] ?? "0";
    const xn = Number(x);
    const yn = Number(y);
    const xNum = x !== "" && Number.isFinite(xn) && String(xn) === x;
    const yNum = y !== "" && Number.isFinite(yn) && String(yn) === y;
    if (xNum && yNum && xn !== yn) return xn - yn;
    if (!xNum || !yNum) {
      const order = x.localeCompare(y);
      if (order !== 0) return order;
    }
  }
  return 0;
}

function bump(version: string, index: number): string {
  const parts = stripBuild(version)
    .split(".")
    .map((part) => (/^\d+$/.test(part) ? Number(part) : 0));
  if (parts.length === 0) parts.push(0);
  const at = Math.min(Math.max(index, 0), parts.length - 1);
  parts[at] += 1;
  for (let cursor = at + 1; cursor < parts.length; cursor += 1) parts[cursor] = 0;
  return parts.join(".");
}

function isMavenRange(spec: string): boolean {
  return /^[[(].*,.*[\])]$/.test(spec);
}

function splitAnd(spec: string): string[] {
  if (isMavenRange(spec)) return [spec];
  const pieces = spec
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const rules: string[] = [];
  for (const piece of pieces) {
    const operators = piece
      .split(/\s+(?=(?:>=|<=|>|<|=|~|\^))/)
      .map((part) => part.trim())
      .filter(Boolean);
    rules.push(...operators);
  }
  return rules.length > 0 ? rules : [spec];
}

function matchesOne(version: string, spec: string): boolean {
  const rule = spec.trim();
  if (!rule || rule === "*") return true;
  if (isMavenRange(rule)) {
    const match = /^([\[(])([^,]*),([^\]\)]*)([\]\)])$/.exec(rule);
    if (!match) return true;
    const [, lowerBound, rawLower, rawUpper, upperBound] = match;
    const lower = rawLower.trim();
    const upper = rawUpper.trim();
    if (lower) {
      const order = compareVersions(version, lower);
      if (lowerBound === "[") {
        if (order < 0) return false;
      } else if (order <= 0) return false;
    }
    if (upper) {
      const order = compareVersions(version, upper);
      if (upperBound === "]") {
        if (order > 0) return false;
      } else if (order >= 0) return false;
    }
    return true;
  }
  if (rule.endsWith(".x") || rule.endsWith(".X")) {
    const base = rule.slice(0, -2);
    const parts = stripBuild(base).split(".").filter(Boolean);
    return compareVersions(version, base) >= 0 && compareVersions(version, bump(base, Math.max(parts.length - 1, 0))) < 0;
  }
  if (rule.startsWith("~")) {
    const base = rule.slice(1).trim();
    if (!base) return true;
    const parts = stripBuild(base).split(".").filter(Boolean);
    const index = parts.length >= 3 ? parts.length - 2 : Math.max(parts.length - 1, 0);
    const ceiling = bump(base, index);
    return compareVersions(version, base) >= 0 && compareVersions(version, ceiling) < 0;
  }
  if (rule.startsWith("^")) {
    const base = rule.slice(1).trim();
    if (!base) return true;
    const parts = stripBuild(base).split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : 0));
    const first = parts.findIndex((part) => part !== 0);
    const ceiling = bump(base, first === -1 ? parts.length - 1 : first);
    return compareVersions(version, base) >= 0 && compareVersions(version, ceiling) < 0;
  }
  const operator = /^(>=|<=|>|<|=)\s*(.+)$/.exec(rule);
  if (operator) {
    const [, op, raw] = operator;
    const order = compareVersions(version, raw.trim());
    if (op === ">=") return order >= 0;
    if (op === "<=") return order <= 0;
    if (op === ">") return order > 0;
    if (op === "<") return order < 0;
    return order === 0;
  }
  if (!/^[0-9A-Za-z][0-9A-Za-z.+_-]*$/.test(rule)) return true;
  return compareVersions(version, rule) === 0;
}

export function versionSatisfies(version: string, ranges: string[]): boolean {
  if (ranges.length === 0) return true;
  return ranges.some((range) => {
    const alternatives = range.split("||").map((part) => part.trim()).filter(Boolean);
    return alternatives.some((alternative) => splitAnd(alternative).every((part) => matchesOne(version, part)));
  });
}

function minecraftSatisfies(mcVersion: string, ranges: string[]): boolean {
  if (versionSatisfies(mcVersion, ranges)) return true;
  return (MINECRAFT_ALIASES[mcVersion] ?? []).some((alias) => versionSatisfies(alias, ranges));
}

function formatLoaders(loaders: string[]): string {
  const labels = loaders.map((id) => LOADER_LABEL[id] ?? id);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} или ${labels[labels.length - 1]}`;
}

function rangeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    const ranges = value.map((item) => text(item)).filter(Boolean);
    return ranges.length > 0 ? ranges : ["*"];
  }
  const single = text(value);
  return [single || "*"];
}

function anyRange(ranges: string[]): boolean {
  return ranges.length === 0 || ranges.every((range) => range.trim() === "" || range.trim() === "*");
}

function ruleFromFabric(id: string, value: string | string[]): VersionRule | null {
  const modId = modIdOf(id);
  if (!modId || RUNTIME_IDS.has(modId)) return null;
  return { id: modId, ranges: rangeList(value) };
}

function fabricRules(record: Record<string, string | string[]> | undefined): VersionRule[] {
  if (!record) return [];
  return Object.entries(record)
    .map(([id, value]) => ruleFromFabric(id, value))
    .filter((rule): rule is VersionRule => rule !== null && rule.id !== "minecraft");
}

function fabricMinecraft(record: Record<string, string | string[]> | undefined): string[] | undefined {
  if (!record) return undefined;
  const entry = Object.entries(record).find(([id]) => modIdOf(id) === "minecraft");
  return entry ? rangeList(entry[1]) : undefined;
}

function quiltRules(value: unknown): { rules: VersionRule[]; minecraft?: string[] } {
  if (!Array.isArray(value)) return { rules: [] };
  const rules: VersionRule[] = [];
  let minecraft: string[] | undefined;
  for (const item of value) {
    if (typeof item === "string") {
      const id = modIdOf(item);
      if (!id || RUNTIME_IDS.has(id)) continue;
      if (id === "minecraft") minecraft = ["*"];
      else rules.push({ id, ranges: ["*"] });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as { id?: unknown; versions?: unknown; optional?: unknown; unless?: unknown };
    const id = modIdOf(text(record.id));
    if (!id || RUNTIME_IDS.has(id) || record.optional === true) continue;
    const ranges = rangeList(record.versions);
    let unlessId: string | undefined;
    if (typeof record.unless === "string") unlessId = modIdOf(record.unless);
    else if (record.unless && typeof record.unless === "object") {
      unlessId = modIdOf(text((record.unless as { id?: unknown }).id));
    }
    if (id === "minecraft") {
      minecraft = ranges;
      continue;
    }
    rules.push({ id, ranges, unlessId: unlessId || undefined });
  }
  return { rules, minecraft };
}

type ForgeDependency = {
  modId?: string;
  mandatory?: boolean;
  versionRange?: string;
  type?: string;
  side?: string;
};

function forgeRules(dependencies: unknown): { requires: VersionRule[]; breaks: VersionRule[]; minecraft?: string[] } {
  const requires: VersionRule[] = [];
  const breaks: VersionRule[] = [];
  let minecraft: string[] | undefined;
  if (!Array.isArray(dependencies)) return { requires, breaks };
  for (const item of dependencies) {
    if (!item || typeof item !== "object") continue;
    const dep = item as ForgeDependency;
    const side = text(dep.side).toUpperCase();
    if (side === "SERVER") continue;
    const id = modIdOf(text(dep.modId));
    if (!id || RUNTIME_IDS.has(id)) continue;
    const ranges = rangeList(dep.versionRange);
    const kind = text(dep.type).toLowerCase();
    const target = id === "minecraft" ? null : { id, ranges };
    if (kind === "incompatible") {
      if (target) breaks.push(target);
      continue;
    }
    const required = kind === "required" || dep.mandatory === true;
    if (!required || kind === "optional" || kind === "discouraged") continue;
    if (id === "minecraft") minecraft = ranges;
    else if (target) requires.push(target);
  }
  return { requires, breaks, minecraft };
}

function declared(options: {
  id: string;
  name: string;
  version: string;
  provides?: string[];
  requires?: VersionRule[];
  breaks?: VersionRule[];
  minecraft?: string[];
}): DeclaredMod | null {
  const id = modIdOf(options.id);
  if (!id) return null;
  return {
    id,
    name: options.name.trim() || id,
    version: options.version.trim() || "0",
    loaders: [],
    provides: (options.provides ?? []).map(modIdOf).filter((item) => item && item !== id),
    requires: options.requires ?? [],
    breaks: options.breaks ?? [],
    minecraft: options.minecraft,
  };
}

async function readFabric(jar: FileSystem): Promise<DeclaredMod[]> {
  try {
    const meta = (await readFabricMod(jar)) as FabricModMetadata;
    const mod = declared({
      id: meta.id,
      name: text(meta.name) || text(meta.id),
      version: text(meta.version),
      provides: meta.provides,
      requires: fabricRules(meta.depends),
      breaks: [...fabricRules(meta.breaks), ...fabricRules(meta.conflicts)],
      minecraft: fabricMinecraft(meta.depends),
    });
    return mod ? [mod] : [];
  } catch {
    return [];
  }
}

async function readQuilt(jar: FileSystem): Promise<DeclaredMod[]> {
  try {
    const meta = (await readQuiltMod(jar)) as QuiltModMetadata;
    const loader = meta.quilt_loader;
    const depends = quiltRules(loader?.depends);
    const breaks = quiltRules(loader?.breaks);
    const mod = declared({
      id: loader?.id,
      name: text(loader?.metadata?.name) || text(loader?.id),
      version: text(loader?.version),
      provides: loader?.provides,
      requires: depends.rules,
      breaks: breaks.rules,
      minecraft: depends.minecraft,
    });
    return mod ? [mod] : [];
  } catch {
    return [];
  }
}

async function readForgeToml(jar: FileSystem, fileName?: string): Promise<DeclaredMod[]> {
  const source = await readForgeModToml(jar, {}, fileName).catch(() => [] as ForgeModTOMLData[]);
  return source
    .map((mod) => {
      const rules = forgeRules(mod.dependencies);
      return declared({
        id: mod.modid,
        name: text(mod.displayName) || text(mod.modid),
        version: text(mod.version),
        requires: rules.requires,
        breaks: rules.breaks,
        minecraft: rules.minecraft,
      });
    })
    .filter((mod): mod is DeclaredMod => mod !== null);
}

async function readJar(absolutePath: string, packLoader: string | null): Promise<DeclaredMod[]> {
  const jar = await resolveFileSystem(absolutePath);
  try {
    const groups: Record<(typeof LOADER_ORDER)[number], DeclaredMod[]> = {
      fabric: await readFabric(jar),
      quilt: await readQuilt(jar),
      forge: await readForgeToml(jar),
      neoforge: await readForgeToml(jar, "neoforge.mods.toml"),
    };
    const loaders = LOADER_ORDER.filter((id) => groups[id].length > 0);
    if (loaders.length === 0) return [];
    const matched = LOADER_ORDER.find((id) => id === packLoader && groups[id].length > 0);
    const preferred = matched ?? loaders[0];
    const declaredMods: DeclaredMod[] = groups[preferred].map((mod) => ({ ...mod, loaders: [...loaders] }));
    declaredMods.push(...(await readEmbedded(jar, packLoader)));
    return declaredMods;
  } finally {
    jar.close();
  }
}

async function readEmbedded(jar: FileSystem, packLoader: string | null): Promise<DeclaredMod[]> {
  const paths = new Set<string>();
  try {
    const meta = (await readFabricMod(jar)) as FabricModMetadata;
    for (const entry of meta.jars ?? []) {
      const file = text(entry?.file);
      if (file) paths.add(file);
    }
  } catch {
    /* the jar has no fabric metadata */
  }
  try {
    const raw = await jar.readFile("META-INF/jarjar/metadata.json", "utf-8");
    const parsed = JSON.parse(String(raw)) as { jars?: { path?: unknown }[] };
    for (const entry of parsed.jars ?? []) {
      const file = text(entry?.path);
      if (file) paths.add(file);
    }
  } catch {
    /* the jar does not embed libraries */
  }

  const embedded: DeclaredMod[] = [];
  for (const relative of paths) {
    try {
      const bytes = await jar.readFile(relative);
      if (!(bytes instanceof Uint8Array) || bytes.length === 0) continue;
      const inner = await resolveFileSystem(bytes);
      try {
        const groups: Record<(typeof LOADER_ORDER)[number], DeclaredMod[]> = {
          fabric: await readFabric(inner),
          quilt: await readQuilt(inner),
          forge: await readForgeToml(inner),
          neoforge: await readForgeToml(inner, "neoforge.mods.toml"),
        };
        const loaders = LOADER_ORDER.filter((id) => groups[id].length > 0);
        if (loaders.length === 0) continue;
        const matched = LOADER_ORDER.find((id) => id === packLoader && groups[id].length > 0);
        const preferred = matched ?? loaders[0];
        embedded.push(...groups[preferred].map((mod) => ({ ...mod, loaders: [...loaders] })));
      } finally {
        inner.close();
      }
    } catch {
      /* an unreadable nested jar does not participate */
    }
  }
  return embedded;
}

function installedLabel(name: string, version: string): string {
  return version && version !== "0" ? `${name} ${version}` : name;
}

export function diagnoseMods(mods: DeclaredMod[], mcVersion: string | null, packLoader: string | null = null): ModIssue[] {
  const byId = new Map<string, { name: string; version: string }[]>();
  const add = (id: string, mod: { name: string; version: string }) => {
    const key = modIdOf(id);
    if (!key) return;
    const list = byId.get(key) ?? [];
    list.push(mod);
    byId.set(key, list);
  };
  for (const mod of mods) {
    const record = { name: mod.name, version: mod.version };
    add(mod.id, record);
    for (const provided of mod.provides) add(provided, record);
  }

  const present = (id: string): boolean => (byId.get(modIdOf(id)) ?? []).length > 0;
  const issues: ModIssue[] = [];
  const seen = new Set<string>();
  const push = (modName: string, message: string) => {
    if (seen.has(message)) return;
    seen.add(message);
    issues.push({ modName, message });
  };

  for (const mod of mods) {
    if (packLoader && mod.loaders.length > 0 && !mod.loaders.includes(packLoader)) {
      const pack =
        packLoader === "vanilla" ? "сборка без модлоадера" : `сборка на ${LOADER_LABEL[packLoader] ?? packLoader}`;
      push(mod.name, `${mod.name} требует ${formatLoaders(mod.loaders)}, а ${pack}.`);
      continue;
    }

    for (const rule of mod.requires) {
      if (rule.id === mod.id || RUNTIME_IDS.has(rule.id)) continue;
      if (rule.unlessId && present(rule.unlessId)) continue;
      const found = byId.get(rule.id) ?? [];
      if (found.length === 0) {
        push(mod.name, `${mod.name} требует ${rule.id}, его нет в сборке.`);
        continue;
      }
      const comparable = found.filter((item) => !item.version.includes("${"));
      if (comparable.length === 0 || anyRange(rule.ranges) || comparable.some((item) => versionSatisfies(item.version, rule.ranges))) {
        continue;
      }
      const installed = found.map((item) => installedLabel(item.name, item.version)).join(", ");
      push(mod.name, `${mod.name} требует ${rule.id} ${rule.ranges.join(" или ")}, установлена версия ${installed}.`);
    }

    for (const rule of mod.breaks) {
      if (rule.id === mod.id || RUNTIME_IDS.has(rule.id)) continue;
      const found = (byId.get(rule.id) ?? []).filter(
        (item) => !item.version.includes("${") && versionSatisfies(item.version, rule.ranges)
      );
      for (const item of found) {
        push(mod.name, `${mod.name} конфликтует с ${installedLabel(item.name, item.version)}.`);
      }
    }

    if (mcVersion && mod.minecraft && !minecraftSatisfies(mcVersion, mod.minecraft)) {
      push(mod.name, `${mod.name} требует Minecraft ${mod.minecraft.join(" или ")}, в сборке ${mcVersion}.`);
    }
  }

  return issues.sort((left, right) => {
    const byName = left.modName.localeCompare(right.modName, "ru");
    if (byName !== 0) return byName;
    return left.message.localeCompare(right.message, "ru");
  });
}

export async function listModIssues(config: AppConfig): Promise<ModIssue[]> {
  const manifest = (await readManifest(config.dataDir)) ?? { files: {} };
  const profile = await readProfile(config.dataDir).catch(() => null);
  const packLoader = profile?.loader ?? null;
  const jars = Object.keys(manifest.files).filter(isModJar);
  const declaredMods: DeclaredMod[] = [];
  for (const relativePath of jars) {
    try {
      const absolute = resolveInside(config.gameDir, relativePath);
      const stat = await fs.stat(absolute).catch(() => null);
      if (!stat?.isFile()) continue;
      declaredMods.push(...(await readJar(absolute, packLoader)));
    } catch {
      /* an unreadable jar does not participate */
    }
  }
  return diagnoseMods(declaredMods, profile?.mcVersion ?? null, packLoader);
}
