import {
  DownloadTask,
  getVersionList,
  installResolvedAssetsTask,
  installResolvedLibrariesTask,
  installVersionTask,
} from "@xmcl/installer";
import {
  MinecraftFolder,
  Version,
  diagnoseAssetIndex,
  type MinecraftLocation,
  type ResolvedVersion,
} from "@xmcl/core";
import type { JavaVersion } from "@xmcl/core";
import type { Dispatcher } from "undici";
import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import { setMaxListeners } from "events";

import { mcPath } from "../../services/paths";
import { sendError, sendPhase } from "../../services/notifyService";
import { fetchWithRetry, getDownloadDispatcher } from "../../utils/undiciAgent";
import { resolveLaunchJava } from "../java";
import type { GameSpec } from "../../types/LauncherConfig";

import installForgeLoader from "./ForgeInstaller";
import installFabricLoader from "./FabricInstaller";
import installQuiltLoader from "./QuiltInstaller";
import installNeoForgeLoader from "./NeoForgeInstaller";
import {
  diagnoseInstall,
  isVanillaReady,
  missingAssets,
  missingLibraries,
} from "./diagnoseInstall";
import { summarizeInstallError, withRetry } from "./installError";
import { trackTask } from "./trackTask";

const VERSION_MANIFESTS = [
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
  "https://launchermeta.mojang.com/mc/game/version_manifest.json",
];

const DEFAULT_JAVA: JavaVersion = {
  majorVersion: 8,
  component: "jre-legacy",
};

async function fetchVersionMeta(mcVersion: string) {
  let lastError: unknown;
  for (const remote of VERSION_MANIFESTS) {
    try {
      const list = await getVersionList({ fetch: fetchWithRetry, remote });
      const found = list.versions.find((version) => version.id === mcVersion);
      if (!found) {
        throw new Error(`Версия Minecraft ${mcVersion} не найдена`);
      }
      return found;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Версия Minecraft")
      ) {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Не удалось получить список версий Minecraft`);
}

async function ensureVanillaVersion(
  mcDir: MinecraftLocation,
  mcVersion: string,
  dispatcher: Dispatcher
): Promise<void> {
  if (await isVanillaReady(mcDir, mcVersion)) return;

  const meta = await fetchVersionMeta(mcVersion);
  const title = `Загрузка клиента ${mcVersion}`;
  sendPhase(title);
  await withRetry(async () => {
    if (await isVanillaReady(mcDir, mcVersion)) return;
    await trackTask(
      installVersionTask(meta, mcDir, { dispatcher }),
      title
    );
  });
}

async function ensureAssetIndex(
  mcDir: MinecraftLocation,
  resolved: ResolvedVersion,
  dispatcher: Dispatcher
): Promise<void> {
  const folder = MinecraftFolder.from(mcDir);
  const index = resolved.assetIndex;
  if (!index?.url || !index.sha1) return;

  await withRetry(async () => {
    const issue = await diagnoseAssetIndex(resolved, folder);
    if (!issue) return;
    const destination = folder.getAssetsIndex(resolved.assets);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await trackTask(
      new DownloadTask({
        url: index.url,
        destination,
        validator: { algorithm: "sha1", hash: index.sha1 },
        dispatcher,
      }),
      "Загрузка индекса ресурсов"
    );
  });
}

async function ensureAssets(
  mcDir: MinecraftLocation,
  resolved: ResolvedVersion,
  dispatcher: Dispatcher,
  knownMissing: Awaited<ReturnType<typeof missingAssets>> | null
): Promise<void> {
  let first = knownMissing;
  await withRetry(async () => {
    const missing = first ?? (await missingAssets(mcDir, resolved));
    first = null;
    if (missing.length === 0) return;
    sendPhase("Загрузка ресурсов");
    await trackTask(
      installResolvedAssetsTask(missing, MinecraftFolder.from(mcDir), {
        dispatcher,
      }),
      "Загрузка ресурсов"
    );
  });
}

async function ensureLibraries(
  mcDir: MinecraftLocation,
  resolved: ResolvedVersion,
  dispatcher: Dispatcher,
  knownMissing: Awaited<ReturnType<typeof missingLibraries>> | null
): Promise<void> {
  let first = knownMissing;
  await withRetry(async () => {
    const missing = first ?? (await missingLibraries(mcDir, resolved));
    first = null;
    if (missing.length === 0) return;
    sendPhase("Загрузка библиотек");
    await trackTask(
      installResolvedLibrariesTask(missing, mcDir, { dispatcher }),
      "Загрузка библиотек"
    );
  });
}

async function installLoader(
  spec: GameSpec,
  mcDir: string,
  javaPath: string
): Promise<string> {
  switch (spec.loader) {
    case "vanilla":
      return spec.mcVersion;
    case "forge":
      return installForgeLoader({
        mcVersion: spec.mcVersion,
        mcDir,
        loaderVersion: spec.loaderVersion,
        javaPath,
      });
    case "fabric":
      return installFabricLoader({
        mcVersion: spec.mcVersion,
        mcDir,
        loaderVersion: spec.loaderVersion,
      });
    case "quilt":
      return installQuiltLoader({
        mcVersion: spec.mcVersion,
        mcDir,
        loaderVersion: spec.loaderVersion,
      });
    case "neoforge":
      return installNeoForgeLoader({
        mcVersion: spec.mcVersion,
        mcDir,
        loaderVersion: spec.loaderVersion,
        javaPath,
      });
    default:
      throw new Error(`Unknown loader: ${spec.loader as string}`);
  }
}

/**
 * Installs Minecraft (+ loader) according to GameSpec.
 * Downloads only files that are missing or corrupted.
 * @returns Final version id to launch (e.g. 1.20.1-forge-47.4.10)
 */
export default async function mcInstall(spec: GameSpec): Promise<string> {
  setMaxListeners(Infinity);
  const dispatcher = getDownloadDispatcher();
  const mcDir: MinecraftLocation = path.join(app.getPath("userData"), mcPath);

  try {
    sendPhase("Проверка файлов игры");
    await ensureVanillaVersion(mcDir, spec.mcVersion, dispatcher);

    let resolved = await Version.parse(mcDir, spec.mcVersion);
    await ensureAssetIndex(mcDir, resolved, dispatcher);
    resolved = await Version.parse(mcDir, spec.mcVersion);

    const report = await diagnoseInstall(mcDir, spec.mcVersion);
    const assets = report.needsAssetIndex
      ? await missingAssets(mcDir, resolved)
      : report.assets;
    await ensureAssets(mcDir, resolved, dispatcher, assets);
    await ensureLibraries(mcDir, resolved, dispatcher, report.libraries);

    const vanilla = await Version.parse(mcDir, spec.mcVersion);
    const javaPath = await resolveLaunchJava(
      vanilla.javaVersion ?? DEFAULT_JAVA
    );
    const versionId = await installLoader(spec, mcDir, javaPath);

    const loaderResolved = await Version.parse(mcDir, versionId);
    if (loaderResolved.id !== vanilla.id) {
      await ensureLibraries(mcDir, loaderResolved, dispatcher, null);
    }

    sendPhase("Установка завершена", false);
    return versionId;
  } catch (error) {
    const message = summarizeInstallError(error);
    console.error("Installation failed:", message);
    sendError(message);
    sendPhase("Ошибка установки", false);
    throw error;
  }
}
