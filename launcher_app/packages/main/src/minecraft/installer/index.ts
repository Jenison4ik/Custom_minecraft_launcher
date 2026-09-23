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
  byteProgress,
  sendError,
  sendPhase,
} from "../../services/notifyService";
import { setupUndiciAgent } from "../../utils/undiciAgent";
import { resolveLaunchJava } from "../java";
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
  title: string,
  retries = 7
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const task = createTask();
    const interval = setInterval(() => {
      byteProgress(title, task.progress, task.total);
    }, 200);

    try {
      const result = await task.startAndWait();
      clearInterval(interval);
      byteProgress(title, task.progress, task.total);
      return result;
    } catch (e) {
      clearInterval(interval);
      lastError = e;
      console.warn(`Retry ${attempt}/${retries}`, e);

      if (isChecksumNotMatchError(e as InstallationError)) {
        deleteCorruptedFile(e as InstallationError);
      }

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
    sendPhase("Checking Minecraft version...");
    resolvedVersion = await checkVersionFiles(mcDir, mcVersion);
    needVersion = false;

    try {
      sendPhase("Checking assets...");
      await checkAssetFiles(mcDir, resolvedVersion);
      needAssets = false;
    } catch {
      /* need assets */
    }

    try {
      sendPhase("Checking libraries...");
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
    sendPhase("Downloading Minecraft version");
    resolvedVersion = await runTaskWithRetry(
      () => installVersionTask(versionMeta, mcDir),
      "Downloading Minecraft version"
    );
  } else {
    resolvedVersion = await Version.parse(mcDir, mcVersion);
  }

  if (needAssets && resolvedVersion) {
    resolvedVersion = await Version.parse(mcDir, resolvedVersion.id);
    sendPhase("Downloading assets");
    await runTaskWithRetry(
      () =>
        installAssetsTask(resolvedVersion!, {
          assetsDownloadConcurrency: DOWNLOAD_CONCURRENCY,
        }),
      "Downloading assets"
    );
  }

  if (needLibraries && resolvedVersion) {
    sendPhase("Downloading libraries");
    await runTaskWithRetry(
      () =>
        installLibrariesTask(resolvedVersion!, {
          librariesDownloadConcurrency: DOWNLOAD_CONCURRENCY,
        }),
      "Downloading libraries"
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

    sendPhase("Checking Java...");
    const javaPath = await resolveLaunchJava(
      vanilla.javaVersion ?? DEFAULT_JAVA
    );

    const versionId = await installLoader(spec, mcDir, javaPath);

    sendPhase("Installing version dependencies...");
    const resolved = await Version.parse(mcDir, versionId);
    await runTaskWithRetry(
      () =>
        installDependenciesTask(resolved, {
          assetsDownloadConcurrency: DOWNLOAD_CONCURRENCY,
          librariesDownloadConcurrency: DOWNLOAD_CONCURRENCY,
        }),
      "Installing version dependencies..."
    );

    sendPhase("Minecraft installation complete", false);
    return versionId;
  } catch (e) {
    const error = e as InstallationError;
    console.error("Installation failed:", error);

    if (isChecksumNotMatchError(error)) {
      deleteCorruptedFile(error);
    }

    sendError(`Installation error: ${formatError(error)}`);
    sendPhase("Installation error", false);
    throw error;
  }
}
