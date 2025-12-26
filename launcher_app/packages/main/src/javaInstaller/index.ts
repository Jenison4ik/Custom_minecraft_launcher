import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import sendError from "../sendError";
import sendDownloadStatus from "../sendDownloadStatus";
import { getUndiciAgent } from "../undiciAgent";
import {
  fetchJavaRuntimeManifest,
  installJavaRuntimeTask,
  resolveJava,
} from "@xmcl/installer";
import type { JavaVersion } from "@xmcl/core";

export async function ensureJava(javaVersion: JavaVersion): Promise<string> {
  try {
    const basePath = path.join(
      app.getPath("userData"),
      "java",
      `java${javaVersion.majorVersion}`
    );

    // Создаём директорию, если её нет
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }

    //Проверяем Java только в папке лаунчера
    const javaBinPath = path.join(
      basePath,
      "bin",
      process.platform === "win32" ? "java.exe" : "java"
    );

    if (fs.existsSync(javaBinPath)) {
      const javaInfo = await resolveJava(javaBinPath);
      if (javaInfo && javaInfo.majorVersion === javaVersion.majorVersion) {
        console.log(`✔️ Java найдена в лаунчере: ${javaInfo.version}`);
        return javaBinPath;
      }
    }

    // Скачиваем и устанавливаем Java
    console.log(`Downloading Java${javaVersion.majorVersion}...`);
    const dispatcher = getUndiciAgent();
    const manifest = await fetchJavaRuntimeManifest({
      target: javaVersion.component,
    });
    console.log("Manifest ready");
    const task = installJavaRuntimeTask({
      destination: basePath,
      manifest,
    });

    await task.startAndWait({
      onStart(t) {
        console.log(`Начало установки Java: ${t.path}`);
      },
      onUpdate(t, chunk) {
        sendDownloadStatus(`${t.total}`, t.progress, true);
      },
      onFailed(t, err) {
        console.error(`Ошибка установки Java: ${t.path}`, err);
        sendDownloadStatus(`${t.total}`, t.progress, false);
      },
      onSucceed(t) {
        console.log(`Java установлена: ${t.path}`);
        sendDownloadStatus(`${t.total}`, t.progress, false);
      },
    });

    // Проверяем путь после установки
    const installedJavaInfo = await resolveJava(javaBinPath);
    if (
      installedJavaInfo &&
      installedJavaInfo.majorVersion === javaVersion.majorVersion
    ) {
      console.log(`✔️ Java успешно установлена: ${installedJavaInfo.version}`);
      return javaBinPath;
    }

    throw new Error("Java установлена, но не найдена после установки.");
  } catch (e) {
    console.error("Error in ensureJava:", e);
    sendError(`${e}`);
    throw e;
  }
}
