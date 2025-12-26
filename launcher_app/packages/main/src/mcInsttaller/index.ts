import {
  getVersionList,
  MinecraftVersion,
  installVersionTask,
  installLibrariesTask,
  installAssetsTask,
} from "@xmcl/installer";
import { MinecraftLocation, ResolvedVersion, Version } from "@xmcl/core";
import { Task } from "@xmcl/task";
import { app } from "electron";
import path from "path";
import fs from "fs";
import { setMaxListeners } from "events";

import { mcPath } from "../createLauncherDir";
import sendDownloadStatus from "../sendDownloadStatus";
import sendError from "../sendError";
import { getUndiciAgent } from "../undiciAgent";

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

/* ──────────────────────────────
   CONSTANTS
────────────────────────────── */

const DOWNLOAD_CONCURRENCY = 1;

/* ──────────────────────────────
   HELPERS
────────────────────────────── */

function deleteCorruptedFile(error: InstallationError) {
  if (isFileError(error) && error.file && fs.existsSync(error.file)) {
    try {
      fs.unlinkSync(error.file);
      console.warn("Deleted corrupted file:", error.file);
    } catch {}
  }
}

function formatError(error: InstallationError): string {
  if (isNetworkTimeoutError(error)) {
    return "Таймаут соединения. Проверьте интернет или прокси.";
  }
  if (isChecksumNotMatchError(error)) {
    return "Повреждённый файл. Он будет загружен заново.";
  }
  return isErrorWithMessage(error) ? error.message : String(error);
}

async function runTaskWithRetry<T>(
  createTask: () => Task<T>,
  onProgress?: (progress: number, total: number) => void,
  retries = 7
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const task = createTask();

      let progressInterval: NodeJS.Timeout | null = null;
      if (onProgress) {
        progressInterval = setInterval(() => {
          if (task.progress !== undefined && task.total !== undefined) {
            onProgress(task.progress, task.total);
          }
        }, 100);
      }

      try {
        const result = await task.startAndWait();
        if (progressInterval) clearInterval(progressInterval);
        return result;
      } catch (e) {
        if (progressInterval) clearInterval(progressInterval);
        throw e;
      }
    } catch (e) {
      lastError = e;
      console.warn(`Retry ${attempt}/${retries}`, e);

      if (isChecksumNotMatchError(e as any)) {
        deleteCorruptedFile(e as InstallationError);
      }

      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  throw lastError;
}

/* ──────────────────────────────
   MAIN INSTALL FUNCTION
────────────────────────────── */

export default async function mcInstall(versionId: MinecraftVersion["id"]) {
  setMaxListeners(Infinity);
  const dispatcher = getUndiciAgent({ connections: DOWNLOAD_CONCURRENCY }); // ⬅ ОБЯЗАТЕЛЬНО ПЕРВЫМ

  const mcDir: MinecraftLocation = path.join(app.getPath("userData"), mcPath);

  let resolvedVersion: ResolvedVersion | null = null;
  let needVersion = true;
  let needAssets = true;
  let needLibraries = true;

  try {
    sendDownloadStatus("Проверка версии Minecraft...", 0, true);
    resolvedVersion = await checkVersionFiles(mcDir, versionId);
    needVersion = false;

    try {
      sendDownloadStatus("Проверка ассетов...", 25, true);
      await checkAssetFiles(mcDir, resolvedVersion);
      needAssets = false;
    } catch {}

    try {
      sendDownloadStatus("Проверка библиотек...", 50, true);
      await checkLibraryFiles(mcDir, resolvedVersion);
      needLibraries = false;
    } catch {}

    if (!needAssets && !needLibraries) {
      sendDownloadStatus("Minecraft уже установлен", 100, false);
      return;
    }
  } catch {
    // версия отсутствует
  }

  const versions = (await getVersionList()).versions.filter(
    (v) => v.id === versionId && v.type === "release"
  );

  if (!versions.length) {
    throw new Error(`Version ${versionId} not found`);
  }

  const versionMeta = versions[0];

  try {
    /* ───── VERSION FILES ───── */

    if (needVersion) {
      sendDownloadStatus("Установка версии Minecraft...", 0, true);

      resolvedVersion = await runTaskWithRetry(
        () =>
          installVersionTask(versionMeta, mcDir, { dispatcher: dispatcher }),
        (progress, total) => {
          const percent = Math.min(
            33,
            total ? Math.floor((progress / total) * 33) : progress
          );
          sendDownloadStatus("Загрузка версии...", percent, true);
        }
      );
    } else {
      resolvedVersion = await Version.parse(mcDir, versionId);
    }

    /* ───── ASSETS ───── */

    if (needAssets && resolvedVersion) {
      resolvedVersion = await Version.parse(mcDir, resolvedVersion.id);

      sendDownloadStatus("Установка ассетов...", 33, true);

      await runTaskWithRetry(
        () =>
          installAssetsTask(resolvedVersion!, {
            assetsDownloadConcurrency: DOWNLOAD_CONCURRENCY,
            dispatcher: dispatcher,
          }),
        (progress, total) => {
          const percent =
            33 +
            Math.min(
              33,
              total ? Math.floor((progress / total) * 33) : progress
            );
          sendDownloadStatus("Загрузка ассетов...", percent, true);
        }
      );
    }

    /* ───── LIBRARIES ───── */

    if (needLibraries && resolvedVersion) {
      sendDownloadStatus("Установка библиотек...", 66, true);

      await runTaskWithRetry(
        () =>
          installLibrariesTask(resolvedVersion!, {
            librariesDownloadConcurrency: DOWNLOAD_CONCURRENCY,
            dispatcher: dispatcher,
          }),
        (progress, total) => {
          const percent =
            66 +
            Math.min(
              34,
              total ? Math.floor((progress / total) * 34) : progress
            );
          sendDownloadStatus("Загрузка библиотек...", percent, true);
        }
      );
    }

    sendDownloadStatus("Установка Minecraft завершена", 100, false);
  } catch (e) {
    const error = e as InstallationError;
    console.error("Installation failed:", error);

    if (isChecksumNotMatchError(error)) {
      deleteCorruptedFile(error);
    }

    sendError(`Ошибка установки: ${formatError(error)}`);
    sendDownloadStatus("Ошибка установки", 0, false);
    throw error;
  }
}
