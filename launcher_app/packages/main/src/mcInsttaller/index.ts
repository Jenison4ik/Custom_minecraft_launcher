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
import { getUndiciAgent, setupUndiciAgent } from "../undiciAgent";

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
  let accumulatedProgress = 0; // суммарный прогресс за все предыдущие попытки

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
      accumulatedProgress += task.total ?? 0; // обновляем после успешного завершения
      return result;
    } catch (e) {
      if (interval) clearInterval(interval);
      lastError = e;
      console.warn(`Retry ${attempt}/${retries}`, e);

      if (isChecksumNotMatchError(e as any)) {
        deleteCorruptedFile(e as InstallationError);
      }

      // добавляем прогресс, который Task успел пройти до ошибки
      accumulatedProgress += task.progress ?? 0;

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
  const dispatcher = setupUndiciAgent({ connections: DOWNLOAD_CONCURRENCY }); // ⬅ ОБЯЗАТЕЛЬНО ПЕРВЫМ

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
        () => installVersionTask(versionMeta, mcDir),
        (progress, total) => {
          const percent = Math.min(
            33,
            total ? Math.floor((progress / total) * 33) : progress
          );
          sendDownloadStatus(
            `Загрузка версии Minecraft ${Math.floor(progress / 1048576)} Мб из ${Math.floor(total / 1048576)} Мб`,
            percent,
            true
          );
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
          }),
        (progress, total) => {
          const percent =
            33 +
            Math.min(
              33,
              total ? Math.floor((progress / total) * 33) : progress
            );
          sendDownloadStatus(
            `Загрузка ассетов ${Math.floor(progress / 1048576)} Мб из ${Math.floor(total / 1048576)} Мб`,
            percent,
            true
          );
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
          }),
        (progress, total) => {
          const percent =
            66 +
            Math.min(
              34,
              total ? Math.floor((progress / total) * 34) : progress
            );
          sendDownloadStatus(
            `Загрузка библиотек ${Math.floor(progress / 1048576)} Мб из ${Math.floor(total / 1048576)} Мб`,
            percent,
            true
          );
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
