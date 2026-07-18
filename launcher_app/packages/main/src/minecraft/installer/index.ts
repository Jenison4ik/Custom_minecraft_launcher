import {
  getVersionList,
  installVersionTask,
  installLibrariesTask,
  installAssetsTask,
  installDependenciesTask,
} from "@xmcl/installer";
import { MinecraftLocation, ResolvedVersion, Version } from "@xmcl/core";
import type { JavaVersion } from "@xmcl/core";
import { Task } from "@xmcl/task";
import { app } from "electron";
import path from "path";
import fs from "fs";
import { setMaxListeners } from "events";

import { mcPath } from "../../services/paths";
import {
  sendDownloadStatus,
  sendError,
} from "../../services/notifyService";
import { setupUndiciAgent } from "../../utils/undiciAgent";
import { ensureJava } from "../java";
import type { GameSpec } from "../../types/LauncherConfig";

import checkVersionFiles from "./checkVersion";
import checkLibraryFiles from "./checkLibraries";
import checkAssetFiles from "./checkAssets";
import {
  InstallationError,
  isChecksumNotMatchError,
  isNetworkTimeoutError,
  isErrorWithMessage,
  isFileError,
} from "./types";
import installForgeLoader from "./ForgeInstaller";
import installFabricLoader from "./FabricInstaller";
import installQuiltLoader from "./QuiltInstaller";
import installNeoForgeLoader from "./NeoForgeInstaller";

const DOWNLOAD_CONCURRENCY = 1;

const DEFAULT_JAVA: JavaVersion = {
  majorVersion: 8,
  component: "jre-legacy",
};

function deleteCorruptedFile(error: InstallationError) {
  if (isFileError(error) && error.file && fs.existsSync(error.file)) {
    try {
      fs.unlinkSync(error.file);
      console.warn("Deleted corrupted file:", error.file);
    } catch {
      /* ignore */
    }
  }
}

function formatError(error: InstallationError): string {
  if (isNetworkTimeoutError(error)) {
    return "Connection timed out. Check your internet or proxy.";
  }
  if (isChecksumNotMatchError(error)) {
    return "Corrupted file. It will be re-downloaded.";
  }
  return isErrorWithMessage(error) ? error.message : String(error);
}

async function runTaskWithRetry<T>(
  createTask: () => Task<T>,
  onProgress?: (progress: number, total: number) => void,
  retries = 7
): Promise<T> {
  let lastError: unknown;
  let accumulatedProgress = 0;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const task = createTask();

    let interval: NodeJS.Timeout | null = null;
    if (onProgress) {
      interval = setInterval(() => {
        const currentProgress = (task.progress ?? 0) + accumulatedProgress;
        const currentTotal = task.total ?? 0;
        onProgress(currentProgress, currentTotal);
      }, 500);
    }

    try {
      const result = await task.startAndWait();
      if (interval) clearInterval(interval);
      accumulatedProgress += task.total ?? 0;
      return result;
    } catch (e) {
      if (interval) clearInterval(interval);
      lastError = e;
      console.warn(`Retry ${attempt}/${retries}`, e);

      if (isChecksumNotMatchError(e as InstallationError)) {
        deleteCorruptedFile(e as InstallationError);
      }

      accumulatedProgress += task.progress ?? 0;

      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  throw lastError;
}

async function ensureVanillaBase(
  mcDir: MinecraftLocation,
  mcVersion: string
): Promise<ResolvedVersion> {
  let resolvedVersion: ResolvedVersion | null = null;
  let needVersion = true;
  let needAssets = true;
  let needLibraries = true;

  try {
    sendDownloadStatus("Checking Minecraft version...", 0, true);
    resolvedVersion = await checkVersionFiles(mcDir, mcVersion);
    needVersion = false;

    try {
      sendDownloadStatus("Checking assets...", 15, true);
      await checkAssetFiles(mcDir, resolvedVersion);
      needAssets = false;
    } catch {
      /* need assets */
    }

    try {
      sendDownloadStatus("Checking libraries...", 25, true);
      await checkLibraryFiles(mcDir, resolvedVersion);
      needLibraries = false;
    } catch {
      /* need libraries */
    }

    if (!needAssets && !needLibraries && resolvedVersion) {
      return resolvedVersion;
    }
  } catch {
    /* version missing */
  }

  const versions = (await getVersionList()).versions.filter(
    (v) => v.id === mcVersion
  );

  if (!versions.length) {
    throw new Error(`Minecraft version ${mcVersion} not found`);
  }

  const versionMeta = versions[0];

  if (needVersion) {
    sendDownloadStatus("Installing Minecraft version...", 0, true);
    resolvedVersion = await runTaskWithRetry(
      () => installVersionTask(versionMeta, mcDir),
      (progress, total) => {
        const percent = Math.min(
          30,
          total ? Math.floor((progress / total) * 30) : progress
        );
        sendDownloadStatus(
          `Downloading Minecraft version ${Math.floor(progress / 1048576)} MB of ${Math.floor(total / 1048576)} MB`,
          percent,
          true
        );
      }
    );
  } else {
    resolvedVersion = await Version.parse(mcDir, mcVersion);
  }

  if (needAssets && resolvedVersion) {
    resolvedVersion = await Version.parse(mcDir, resolvedVersion.id);
    sendDownloadStatus("Installing assets...", 30, true);
    await runTaskWithRetry(
      () =>
        installAssetsTask(resolvedVersion!, {
          assetsDownloadConcurrency: DOWNLOAD_CONCURRENCY,
        }),
      (progress, total) => {
        const percent =
          30 +
          Math.min(15, total ? Math.floor((progress / total) * 15) : progress);
        sendDownloadStatus(
          `Downloading assets ${Math.floor(progress / 1048576)} MB of ${Math.floor(total / 1048576)} MB`,
          percent,
          true
        );
      }
    );
  }

  if (needLibraries && resolvedVersion) {
    sendDownloadStatus("Installing libraries...", 45, true);
    await runTaskWithRetry(
      () =>
        installLibrariesTask(resolvedVersion!, {
          librariesDownloadConcurrency: DOWNLOAD_CONCURRENCY,
        }),
      (progress, total) => {
        const percent =
          45 +
          Math.min(10, total ? Math.floor((progress / total) * 10) : progress);
        sendDownloadStatus(
          `Downloading libraries ${Math.floor(progress / 1048576)} MB of ${Math.floor(total / 1048576)} MB`,
          percent,
          true
        );
      }
    );
  }

  return Version.parse(mcDir, mcVersion);
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
 * @returns Final version id to launch (e.g. 1.16.4-forge-35.x.x)
 */
export default async function mcInstall(spec: GameSpec): Promise<string> {
  setMaxListeners(Infinity);
  setupUndiciAgent({ connections: DOWNLOAD_CONCURRENCY });

  const mcDir: MinecraftLocation = path.join(app.getPath("userData"), mcPath);

  try {
    const vanilla = await ensureVanillaBase(mcDir, spec.mcVersion);

    sendDownloadStatus("Checking Java...", 50, true);
    const javaPath = await ensureJava(vanilla.javaVersion ?? DEFAULT_JAVA);

    const versionId = await installLoader(spec, mcDir, javaPath);

    sendDownloadStatus("Installing version dependencies...", 80, true);
    const resolved = await Version.parse(mcDir, versionId);
    await runTaskWithRetry(
      () =>
        installDependenciesTask(resolved, {
          assetsDownloadConcurrency: DOWNLOAD_CONCURRENCY,
          librariesDownloadConcurrency: DOWNLOAD_CONCURRENCY,
        }),
      (progress, total) => {
        const percent =
          80 +
          Math.min(19, total ? Math.floor((progress / total) * 19) : progress);
        sendDownloadStatus(
          `Dependencies ${Math.floor(progress / 1048576)} MB of ${Math.floor(total / 1048576)} MB`,
          percent,
          true
        );
      }
    );

    sendDownloadStatus("Minecraft installation complete", 100, false);
    return versionId;
  } catch (e) {
    const error = e as InstallationError;
    console.error("Installation failed:", error);

    if (isChecksumNotMatchError(error)) {
      deleteCorruptedFile(error);
    }

    sendError(`Installation error: ${formatError(error)}`);
    sendDownloadStatus("Installation error", 0, false);
    throw error;
  }
}
