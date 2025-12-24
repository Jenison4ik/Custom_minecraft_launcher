import { getVersionList, MinecraftVersion, installTask } from "@xmcl/installer";
import { MinecraftLocation } from "@xmcl/core";
import path from "path";
import { mcPath } from "../createLauncherDir";
import { app } from "electron";
import { addToConfig } from "..";
import sendDownloadStatus from "../sendDownloadStatus";
import { Task } from "@xmcl/task";
import { ResolvedVersion } from "@xmcl/core";
import fs from "fs";
import { Agent, setGlobalDispatcher } from "undici";
import { setMaxListeners } from "events";

export default async function mcInstall() {
  // Снимаем лимит слушателей, чтобы предупреждения Node не мешали
  setMaxListeners(0);

  const minecraft: MinecraftLocation = path.join(
    app.getPath("userData"),
    mcPath
  );
  const list: MinecraftVersion[] = (await getVersionList()).versions;
  const aVersion: MinecraftVersion = list[0]; // i just pick the first version in list here
  sendDownloadStatus("Устанавливаем Minecraft...", 0, true);

  // Dispatcher с увеличенными таймаутами и keep-alive
  const dispatcher = new Agent({
    connect: { timeout: 20000 },
    headersTimeout: 20000,
    bodyTimeout: 0,
    keepAliveTimeout: 60000,
    keepAliveMaxTimeout: 60000,
    pipelining: 1,
  });
  // Применяем dispatcher глобально для undici (использует @xmcl/file-transfer)
  setGlobalDispatcher(dispatcher);

  // Функция для удаления файла, если загрузка была повреждена
  const safeRemove = (file?: string) => {
    if (file && fs.existsSync(file)) {
      try {
        fs.rmSync(file, { force: true });
      } catch (err) {
        console.warn("Не удалось удалить поврежденный файл:", file, err);
      }
    }
  };

  const maxAttempts = 3;

  try {
    addToConfig([{ name: "id", value: aVersion.id }]);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const installAllTask: Task<ResolvedVersion> = installTask(
        aVersion,
        minecraft
      );

      sendDownloadStatus(
        `Устанавливаем Minecraft... (попытка ${attempt}/${maxAttempts})`,
        0,
        true
      );

      try {
        await installAllTask.startAndWait({
          onStart(task: Task<any>) {
            const total = task.total || 1;
            sendDownloadStatus(
              `Старт: ${task.path || "install"}`,
              Math.floor((task.progress / total) * 100),
              true
            );
          },
          onUpdate(task: Task<any>) {
            const total = task.total || 1;
            const percent = Math.floor((task.progress / total) * 100);
            sendDownloadStatus(
              `Загрузка: ${task.path || "install"}`,
              percent,
              true
            );
            // Обновляем общий прогресс корневой задачи
            const rootTotal = installAllTask.total || 1;
            const rootPercent = Math.floor(
              (installAllTask.progress / rootTotal) * 100
            );
            sendDownloadStatus(
              `Установка Minecraft... (попытка ${attempt}/${maxAttempts})`,
              rootPercent,
              true
            );
          },
          onFailed(task: Task<any>, error: any) {
            console.error("Install task failed:", task.path, error);
          },
          onSucceed() {
            sendDownloadStatus("Установка Minecraft завершена", 100, false);
          },
        });

        // если дошли сюда — успех, выходим из цикла
        return;
      } catch (e: any) {
        // Очистим поврежденные файлы из AggregateError, если есть
        const errors: any[] = Array.isArray(e?.errors) ? e.errors : [];
        for (const err of errors) {
          if (err?.file) safeRemove(err.file);
          if (err?.destination) safeRemove(err.destination);
        }

        console.error(`Попытка ${attempt} не удалась:`, e);
        if (attempt === maxAttempts) {
          sendDownloadStatus("Ошибка установки Minecraft", 0, false);
          throw e;
        }
        // небольшая пауза перед повтором
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  } catch (e) {
    sendDownloadStatus("Ошибка установки Minecraft", 0, false);
    throw e;
  }
}
