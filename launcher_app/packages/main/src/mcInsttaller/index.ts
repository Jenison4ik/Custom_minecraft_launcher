import {
  getVersionList,
  MinecraftVersion,
  installVersionTask,
  installLibrariesTask,
  installAssetsTask,
  AssetsOptions,
  LibraryOptions,
} from "@xmcl/installer";
import { MinecraftLocation, ResolvedVersion, Version } from "@xmcl/core";
import { Task } from "@xmcl/task";
import { app } from "electron";
import path from "path";
import fs from "fs";
import { mcPath } from "../createLauncherDir";
import { Agent, setGlobalDispatcher } from "undici";
import sendDownloadStatus from "../sendDownloadStatus";
import sendError from "../sendError";
import { setMaxListeners } from "events";
import checkVersionFiles from "./checkVersion";
import checkLibraryFiles from "./checkLibraries";
import checkAssetFiles from "./checkAssets";
import {
  InstallationError,
  FileError,
  isFileError,
  isNetworkTimeoutError,
  isChecksumNotMatchError,
  isErrorWithMessage,
  TaskUpdateCallback,
  TaskFailedCallback,
  AgentConfig,
} from "./types";

// Функция для удаления поврежденного файла при ошибке ChecksumNotMatchError
function deleteCorruptedFile(error: InstallationError): void {
  if (isFileError(error) && error.file && fs.existsSync(error.file)) {
    try {
      // Проверяем размер файла - если он пустой (0 байт) или очень маленький, удаляем
      const stats = fs.statSync(error.file);
      if (stats.size === 0) {
        fs.unlinkSync(error.file);
        console.log(`Deleted empty corrupted file: ${error.file}`);
      } else if (isChecksumNotMatchError(error)) {
        // Удаляем файл с несовпадающим хэшем
        fs.unlinkSync(error.file);
        console.log(
          `Deleted corrupted file (checksum mismatch): ${error.file}`
        );
      }
    } catch (e) {
      const errorMessage = isErrorWithMessage(e) ? e.message : String(e);
      console.error(`Failed to delete file ${error.file}:`, errorMessage);
    }
  }
}

// Функция для форматирования сообщения об ошибке
function formatError(error: InstallationError): string {
  if (isNetworkTimeoutError(error)) {
    return `Таймаут подключения. Проверьте интернет-соединение и попробуйте снова.`;
  }
  if (
    isChecksumNotMatchError(error) ||
    (isFileError(error) && error.algorithm)
  ) {
    return `Поврежденный файл обнаружен. Файл будет удален и загружен заново. Если ошибка повторяется, проверьте интернет-соединение.`;
  }
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return String(error);
}

export default async function mcInstall(version: MinecraftVersion["id"]) {
  // Увеличиваем лимит слушателей для EventTarget/AbortSignal
  // Это предотвратит предупреждение MaxListenersExceededWarning
  // когда создается много задач загрузки
  setMaxListeners(Infinity);

  const mcDir: MinecraftLocation = path.join(app.getPath("userData"), mcPath);

  // Проверяем, существует ли версия и корректна ли она
  let resolvedVersion: ResolvedVersion | undefined;
  let needInstallVersion = true;
  let needInstallAssets = true;
  let needInstallLibraries = true;

  try {
    // Пробуем проверить версию через модуль проверки
    sendDownloadStatus("Проверка версии Minecraft...", 0, true);
    resolvedVersion = await checkVersionFiles(mcDir, version);
    console.log(
      "✓ Version already installed and verified:",
      resolvedVersion.id
    );
    needInstallVersion = false;

    // Если версия установлена, проверяем остальные компоненты
    if (resolvedVersion) {
      try {
        sendDownloadStatus("Проверка ассетов Minecraft...", 25, true);
        await checkAssetFiles(mcDir, resolvedVersion);
        console.log("✓ Assets already installed and verified");
        needInstallAssets = false;
      } catch (e) {
        console.log("Assets missing or corrupted, installation required...");
        needInstallAssets = true;
      }

      try {
        sendDownloadStatus("Проверка библиотек Minecraft...", 50, true);
        await checkLibraryFiles(mcDir, resolvedVersion);
        console.log("✓ Libraries already installed and verified");
        needInstallLibraries = false;
      } catch (e) {
        console.log("Libraries missing or corrupted, installation required...");
        needInstallLibraries = true;
      }

      // Если всё уже установлено, завершаем
      if (!needInstallAssets && !needInstallLibraries) {
        console.log("All components already installed!");
        sendDownloadStatus("Все компоненты уже установлены", 100, false);
        return;
      }
    }
  } catch (e) {
    // Версия не установлена или повреждена, нужно установить
    console.log("Version not found or corrupted, installation required...");
    needInstallVersion = true;
  }

  // Получаем список версий и находим нужную
  const list: MinecraftVersion[] = (await getVersionList()).versions.filter(
    (item) => {
      return item.id.includes(version) && item.type === "release";
    }
  );

  if (list.length === 0) {
    throw new Error(`Version ${version} not found`);
  }

  const aVersion: MinecraftVersion = list[0];

  // Ограничиваем количество соединений, чтобы избежать разрывов соединений со стороны сервера
  // Увеличиваем таймауты для предотвращения ConnectTimeoutError
  // Используем headersTimeout и bodyTimeout вместо устаревшего requestTimeout
  const agentConfig = {
    connections: 1, // ограничиваем до 4 одновременных соединений (компромисс между скоростью и стабильностью)
    pipelining: 0, // отключаем pipelining для предотвращения проблем
    connectTimeout: 60000, // 60 секунд на подключение (вместо 10 по умолчанию)
    headersTimeout: 300000, // 5 минут на получение заголовков (для больших файлов)
    bodyTimeout: 300000, // 5 минут на получение тела ответа (для больших файлов)
  };
  const agent = new Agent(
    agentConfig as unknown as ConstructorParameters<typeof Agent>[0]
  );

  // Устанавливаем глобальный dispatcher с ограничением соединений
  // Это ограничит все HTTP-запросы через undici в процессе
  setGlobalDispatcher(agent);

  // Опции для всех функций установки с ограничением соединений
  const installOptions = {
    agent: {
      dispatcher: agent, // передаем agent с ограничением соединений
    },
  } as AssetsOptions | LibraryOptions;

  try {
    // Шаг 1: Установка версии (JSON и JAR) - только если нужно
    if (needInstallVersion) {
      sendDownloadStatus("Установка версии Minecraft...", 0, true);
      const installVersionTaskInstance: Task<ResolvedVersion> =
        installVersionTask(aVersion, mcDir, installOptions);

      const onUpdateVersion: TaskUpdateCallback<ResolvedVersion> = (task) => {
        const progress =
          installVersionTaskInstance.total > 0
            ? Math.floor(
                (installVersionTaskInstance.progress /
                  installVersionTaskInstance.total) *
                  33
              )
            : Math.min(installVersionTaskInstance.progress, 33);
        sendDownloadStatus(
          `Установка версии: ${task.name || "Загрузка"}...`,
          progress,
          true
        );
      };

      const onFailedVersion: TaskFailedCallback<ResolvedVersion> = (
        task,
        error
      ) => {
        deleteCorruptedFile(error);
        const errorMsg = formatError(error);
        sendError(`Ошибка установки версии: ${errorMsg}`);
        sendDownloadStatus("Ошибка установки версии", 0, false);
      };

      const installedVersion = await installVersionTaskInstance.startAndWait({
        onUpdate: onUpdateVersion,
        onFailed: onFailedVersion,
      });

      // Используем версию, возвращенную из installVersionTask, она уже полностью разрешена
      resolvedVersion = installedVersion;
      if (!resolvedVersion) {
        // Если installVersionTask не вернул версию, парсим заново
        resolvedVersion = await Version.parse(mcDir, aVersion.id);
      }
      console.log("Version installed:", resolvedVersion.id);
    } else {
      // Версия уже установлена, используем существующую
      console.log("Version already installed, skipping version installation");
      sendDownloadStatus("Версия уже установлена", 0, true);
    }

    // Проверяем ассеты перед установкой (если еще не проверяли)
    if (resolvedVersion && needInstallAssets) {
      try {
        sendDownloadStatus("Проверка ассетов Minecraft...", 33, true);
        await checkAssetFiles(mcDir, resolvedVersion);
        console.log("✓ Assets already installed and verified");
        needInstallAssets = false;
        sendDownloadStatus("Ассеты уже установлены", 33, true);
      } catch (e) {
        console.log("Assets missing or corrupted, installation required...");
        needInstallAssets = true;
      }
    }

    // Шаг 2: Установка ассетов - только если нужно
    if (needInstallAssets && resolvedVersion) {
      // Всегда перепарсим версию перед установкой ассетов, чтобы убедиться, что все данные загружены
      // Это особенно важно, если версия была установлена ранее
      try {
        resolvedVersion = await Version.parse(mcDir, resolvedVersion.id);
        console.log(
          "Version parsed for assets installation:",
          resolvedVersion.id
        );
      } catch (e) {
        console.error("Failed to parse version:", e);
        throw new Error(
          `Failed to resolve version ${resolvedVersion.id} for assets installation: ${e}`
        );
      }

      sendDownloadStatus("Установка ассетов Minecraft...", 33, true);

      try {
        // Используем installAssetsTask, который сам загружает asset index
        // installDependencies требует уже загруженный asset index, что может вызвать ошибку
        console.log("Installing assets using installAssetsTask...");
        const installAssetsTaskInstance = installAssetsTask(
          resolvedVersion,
          installOptions
        );

        const onUpdateAssets: TaskUpdateCallback<void> = (task) => {
          const progress =
            installAssetsTaskInstance.total > 0
              ? 33 +
                Math.floor(
                  (installAssetsTaskInstance.progress /
                    installAssetsTaskInstance.total) *
                    33
                )
              : 33 + Math.min(installAssetsTaskInstance.progress, 33);
          sendDownloadStatus(
            `Установка ассетов: ${task.name || "Загрузка"}...`,
            progress,
            true
          );
        };

        const onFailedAssets: TaskFailedCallback<void> = (task, error) => {
          //deleteCorruptedFile(error);
          const errorMsg = formatError(error);
          sendError(`Ошибка установки ассетов: ${errorMsg}`);
          sendDownloadStatus("Ошибка установки ассетов", 0, false);
        };

        await installAssetsTaskInstance.startAndWait({
          onUpdate: onUpdateAssets,
          onFailed: onFailedAssets,
        });
        console.log("Assets installed successfully");
      } catch (error: unknown) {
        console.error("Assets installation error:", error);
        const errorMessage = isErrorWithMessage(error)
          ? error.message
          : String(error);
        // Если ошибка связана с отсутствием данных об ассетах
        if (
          errorMessage.includes("objects") ||
          errorMessage.includes("undefined") ||
          errorMessage.includes("Cannot destructure")
        ) {
          console.error(
            "Asset index is missing. This usually means the version JSON is incomplete or asset index failed to download."
          );
          // throw new Error(
          //   `Asset index is missing or corrupted for version ${resolvedVersion.id}. The asset index JSON file may not have been downloaded. Please try reinstalling the version.`
          // );
        }
        //throw error as InstallationError;
      }
    } else {
      console.log("Assets already installed, skipping assets installation");
    }

    // Проверяем библиотеки перед установкой (если еще не проверяли)
    if (resolvedVersion && needInstallLibraries) {
      try {
        sendDownloadStatus("Проверка библиотек Minecraft...", 66, true);
        await checkLibraryFiles(mcDir, resolvedVersion);
        console.log("✓ Libraries already installed and verified");
        needInstallLibraries = false;
        sendDownloadStatus("Библиотеки уже установлены", 66, true);
      } catch (e) {
        console.log("Libraries missing or corrupted, installation required...");
        needInstallLibraries = true;
      }
    }

    // Шаг 3: Установка библиотек - только если нужно
    if (needInstallLibraries && resolvedVersion) {
      sendDownloadStatus("Установка библиотек Minecraft...", 66, true);
      const installLibrariesTaskInstance: Task<void> = installLibrariesTask(
        resolvedVersion,
        installOptions
      );

      const onUpdateLibraries: TaskUpdateCallback<void> = (task) => {
        const progress =
          installLibrariesTaskInstance.total > 0
            ? 66 +
              Math.floor(
                (installLibrariesTaskInstance.progress /
                  installLibrariesTaskInstance.total) *
                  34
              )
            : 66 + Math.min(installLibrariesTaskInstance.progress, 34);
        sendDownloadStatus(
          `Установка библиотек: ${task.name || "Загрузка"}...`,
          progress,
          true
        );
      };

      const onFailedLibraries: TaskFailedCallback<void> = (task, error) => {
        deleteCorruptedFile(error);
        const errorMsg = formatError(error);
        sendError(`Ошибка установки библиотек: ${errorMsg}`);
        sendDownloadStatus("Ошибка установки библиотек", 0, false);
      };

      await installLibrariesTaskInstance.startAndWait({
        onUpdate: onUpdateLibraries,
        onFailed: onFailedLibraries,
      });
      console.log("Libraries installed");
    } else {
      console.log(
        "Libraries already installed, skipping libraries installation"
      );
    }

    // Установка завершена
    sendDownloadStatus("Установка Minecraft завершена!", 100, false);
  } catch (error: unknown) {
    console.error("Installation error:", error);
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : String(error);
    sendError(`Ошибка установки: ${errorMessage}`);
    sendDownloadStatus("Ошибка установки", 0, false);
    throw error as InstallationError;
  }
}
