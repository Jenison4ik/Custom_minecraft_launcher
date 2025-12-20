import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import extract from "extract-zip";
import { app } from "electron";
import sendError from "./sendError";
import sendDownloadStatus from "./sendDownloadStatus";

const javaBaseDir = path.join(app.getPath("userData"), "java");
const java21Path = path.join(javaBaseDir, "temurin-21");
const os =
  process.platform === "win32"
    ? "windows"
    : process.platform === "darwin"
      ? "mac"
      : "linux";
const arch = process.arch === "x64" ? "x64" : "aarch64";

// URL для Temurin 21
const JAVA_URL = `https://api.adoptium.net/v3/binary/version/jdk-21.0.3+9/${os}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`;

export async function ensureJava21(): Promise<string> {
  let stopAnimation = () => {};
  try {
    const javaExecutable = path.join(
      java21Path,
      "bin",
      process.platform === "win32" ? "java.exe" : "java"
    );

    if (fs.existsSync(javaExecutable)) {
      return javaExecutable;
    }
    sendDownloadStatus("Java 21 не найдена, загружаем...", 0, true);

    const zipPath = path.join(app.getPath("temp"), "java21.zip");

    const writer = fs.createWriteStream(zipPath);

    const response = await axios.get(JAVA_URL, {
      responseType: "stream",
      onDownloadProgress: (progressEvent) => {
        const { loaded, total } = progressEvent;
        if (total) {
          const percent = Math.round((loaded * 100) / total);
          console.log(
            `\r Загрузка Java21 ${Math.floor(loaded / 1048576)} MB from ${Math.floor(total / 1048576)} MB`
          );
          sendDownloadStatus(
            `Загрузка Java 21: loaded ${Math.floor(loaded / 1048576)} MB from ${Math.floor(total / 1048576)} MB`,
            percent,
            true
          );
        } else {
          sendDownloadStatus(`Загрузка Java 21: ${loaded} bytes`, 100, false);
        }
      },
    });

    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    sendDownloadStatus(
      "Загрузка завершена, распаковываем Java 21...",
      100,
      true
    );
    console.log("Распаковка Java...\n");
    await extract(zipPath, { dir: javaBaseDir });

    //название извлечённой папки
    const extractedDir = fs
      .readdirSync(javaBaseDir)
      .find((d) => d.includes("jdk") || d.includes("jre"));
    if (!extractedDir) throw new Error("Извлеченная папка Java не найдена");

    fs.renameSync(path.join(javaBaseDir, extractedDir), java21Path);

    sendDownloadStatus("Установка Java 21 завершена!", 100, false);
    console.log("Java 21 установлен\n");
    return javaExecutable;
  } catch (e: unknown) {
    if (e instanceof Error) {
      sendError(`Ошибка при загрузке Java 21: ${e.message}`);
      throw e;
    }
    // Handle non-Error objects
    sendError("Ошибка при загрузке Java 21: Неизвестная ошибка");
    throw new Error("Неизвестная ошибка");
  }
}
