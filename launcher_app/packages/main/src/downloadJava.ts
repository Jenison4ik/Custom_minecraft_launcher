import { app } from "electron";
import path from "path";
import fs from "fs";

import {
  installJavaRuntimeTask,
  fetchJavaRuntimeManifest,
} from "@xmcl/installer";
import { MinecraftLocation } from "@xmcl/core";
import { Task } from "@xmcl/task";

import sendDownloadStatus from "./sendDownloadStatus";
import sendError from "./sendError";

/* ──────────────────────────────
   HELPER FUNCTIONS
────────────────────────────── */

/**
 * Отслеживание прогресса Task через интервал
 */
async function runTaskWithProgress<T>(
  task: Task<T>,
  onProgress?: (progress: number, total: number) => void
): Promise<T> {
  let progressInterval: NodeJS.Timeout | null = null;

  if (onProgress) {
    progressInterval = setInterval(() => {
      if (
        task.progress !== undefined &&
        task.total !== undefined &&
        task.total > 0
      ) {
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
}

/**
 * Поиск исполняемого файла Java в директории
 */
function findJavaExecutable(baseDir: string): string | null {
  const isWindows = process.platform === "win32";
  const javaExeName = isWindows ? "java.exe" : "java";

  // Стандартные пути для Java Runtime в XMCL
  const possiblePaths = [
    path.join(baseDir, "java-runtime-epsilon", "bin", javaExeName),
    path.join(baseDir, "bin", javaExeName),
    path.join(baseDir, javaExeName),
  ];

  // Рекурсивный поиск в поддиректориях
  function searchRecursive(dir: string, depth: number): string | null {
    if (depth > 5) return null; // Ограничение глубины поиска

    try {
      if (!fs.existsSync(dir)) return null;

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isFile() && entry.name === javaExeName) {
          return fullPath;
        }

        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const found = searchRecursive(fullPath, depth + 1);
          if (found) return found;
        }
      }
    } catch {
      // Игнорируем ошибки доступа
    }

    return null;
  }

  // Сначала проверяем стандартные пути
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      return possiblePath;
    }
  }

  // Если не нашли, ищем рекурсивно
  return searchRecursive(baseDir, 0);
}

/* ──────────────────────────────
   MAIN FUNCTION
────────────────────────────── */

/**
 * Директория Java (совместима с предыдущей реализацией)
 */
const javaBaseDir = path.join(app.getPath("userData"), "java");

/**
 * Устанавливает Java 21+ Runtime и возвращает путь к исполняемому файлу
 */
export async function ensureJava21(): Promise<string> {
  const mcLocation: MinecraftLocation = javaBaseDir;

  // Сначала проверяем, не установлена ли Java уже
  sendDownloadStatus("Проверка Java Runtime...", 0, true);
  const existingJava = findJavaExecutable(mcLocation);

  if (existingJava && fs.existsSync(existingJava)) {
    console.log("Java уже установлена:", existingJava);
    sendDownloadStatus("Java Runtime найдена", 100, false);
    return existingJava;
  }

  // Если Java не найдена, пытаемся установить
  let lastError: unknown;
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      /**
       * Получение манифеста Java Runtime через XMCL
       * java-runtime-epsilon → Java 21+
       * XMCL сам подберёт корректную версию под ОС / архитектуру
       */
      if (attempt > 1) {
        sendDownloadStatus(
          `Повторная попытка установки Java (${attempt}/${maxRetries})...`,
          5,
          true
        );
        // Небольшая задержка перед повторной попыткой
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        sendDownloadStatus("Получение манифеста Java Runtime...", 5, true);
      }

      const manifest = await fetchJavaRuntimeManifest({
        target: "java-runtime-epsilon",
      });

      /**
       * Установка Java Runtime
       */
      sendDownloadStatus("Установка Java Runtime...", 10, true);
      const task = installJavaRuntimeTask({
        destination: mcLocation,
        manifest,
      });

      await runTaskWithProgress(task, (progress, total) => {
        const percent = 10 + Math.floor((progress / total) * 85); // 10-95%
        sendDownloadStatus("Загрузка Java Runtime...", percent, true);
      });

      /**
       * Поиск пути к Java после установки
       */
      const javaPath = findJavaExecutable(mcLocation);

      if (!javaPath || !fs.existsSync(javaPath)) {
        throw new Error(
          `Java executable not found after installation in ${mcLocation}`
        );
      }

      sendDownloadStatus("Java Runtime готова", 100, false);
      console.log("Java успешно установлена:", javaPath);
      return javaPath;
    } catch (e) {
      lastError = e;
      const errorMessage = e instanceof Error ? e.message : String(e);

      console.error(
        `Ошибка установки Java (попытка ${attempt}/${maxRetries}):`,
        errorMessage
      );

      // Если это последняя попытка, выбрасываем ошибку
      if (attempt >= maxRetries) {
        const userMessage =
          errorMessage.includes("throwOnError") ||
          errorMessage.includes("UND_ERR")
            ? "Ошибка подключения при загрузке Java. Проверьте интернет-соединение."
            : errorMessage.includes("ENOENT") ||
                errorMessage.includes("not found")
              ? "Не удалось найти файлы Java. Возможно, проблема с правами доступа."
              : `Ошибка установки Java: ${errorMessage}`;

        sendError(userMessage);
        sendDownloadStatus("Ошибка установки Java", 0, false);
        throw new Error(userMessage);
      }
    }
  }

  // Этот код не должен выполниться, но на всякий случай
  const finalMessage =
    lastError instanceof Error
      ? lastError.message
      : "Неизвестная ошибка установки Java";
  sendError(`Ошибка при установке Java: ${finalMessage}`);
  throw lastError || new Error(finalMessage);
}
