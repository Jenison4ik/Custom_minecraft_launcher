import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import extract from "extract-zip";
import { app } from "electron";
import sendError from "./sendError";
import sendDownloadStatus from "./sendDownloadStatus";

const javaBaseDir = path.join(app.getPath("userData"), "java");
const java25Path = path.join(javaBaseDir, "temurin-25");
const os =
  process.platform === "win32"
    ? "windows"
    : process.platform === "darwin"
      ? "mac"
      : "linux";
const arch = process.arch === "x64" ? "x64" : "aarch64";

// URL для Temurin 25 (требуется для версии Minecraft с java-runtime-epsilon)
// Используем latest для получения последней доступной версии Java 25
// Если Java 25 недоступна, попробуем Java 23 (также поддерживает --sun-misc-unsafe-memory-access=allow)
const JAVA_URL_25 = `https://api.adoptium.net/v3/binary/latest/25/ga/${os}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`;
const JAVA_URL_23 = `https://api.adoptium.net/v3/binary/latest/23/ga/${os}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`;

export async function ensureJava21(): Promise<string> {
  let stopAnimation = () => {};
  try {
    const javaExecutable = path.join(
      java25Path,
      "bin",
      process.platform === "win32" ? "java.exe" : "java"
    );

    if (fs.existsSync(javaExecutable)) {
      return javaExecutable;
    }
    sendDownloadStatus("Java 25 не найдена, загружаем...", 0, true);

    const zipPath = path.join(app.getPath("temp"), "java25.zip");

    let javaUrl = JAVA_URL_25;
    let javaVersion = "25";

    // Пробуем загрузить Java 25, если не получается - пробуем Java 23
    try {
      const writer = fs.createWriteStream(zipPath);
      const response = await axios.get(javaUrl, {
        responseType: "stream",
        onDownloadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          if (total) {
            const percent = Math.round((loaded * 100) / total);
            console.log(
              `\r Загрузка Java${javaVersion} ${Math.floor(loaded / 1048576)} MB from ${Math.floor(total / 1048576)} MB`
            );
            sendDownloadStatus(
              `Загрузка Java ${javaVersion}: loaded ${Math.floor(loaded / 1048576)} MB from ${Math.floor(total / 1048576)} MB`,
              percent,
              true
            );
          } else {
            sendDownloadStatus(
              `Загрузка Java ${javaVersion}: ${loaded} bytes`,
              100,
              false
            );
          }
        },
      });

      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
    } catch (error) {
      // Если Java 25 недоступна, пробуем Java 23
      console.log("Java 25 недоступна, пробуем Java 23...");
      javaUrl = JAVA_URL_23;
      javaVersion = "23";
      sendDownloadStatus("Java 25 недоступна, загружаем Java 23...", 0, true);

      const writer = fs.createWriteStream(zipPath);
      const response = await axios.get(javaUrl, {
        responseType: "stream",
        onDownloadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          if (total) {
            const percent = Math.round((loaded * 100) / total);
            console.log(
              `\r Загрузка Java${javaVersion} ${Math.floor(loaded / 1048576)} MB from ${Math.floor(total / 1048576)} MB`
            );
            sendDownloadStatus(
              `Загрузка Java ${javaVersion}: loaded ${Math.floor(loaded / 1048576)} MB from ${Math.floor(total / 1048576)} MB`,
              percent,
              true
            );
          } else {
            sendDownloadStatus(
              `Загрузка Java ${javaVersion}: ${loaded} bytes`,
              100,
              false
            );
          }
        },
      });

      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
    }

    sendDownloadStatus(
      `Загрузка завершена, распаковываем Java ${javaVersion}...`,
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

    fs.renameSync(path.join(javaBaseDir, extractedDir), java25Path);

    sendDownloadStatus(`Установка Java ${javaVersion} завершена!`, 100, false);
    console.log(`Java ${javaVersion} установлен\n`);
    return javaExecutable;
  } catch (e: unknown) {
    if (e instanceof Error) {
      sendError(`Ошибка при загрузке Java: ${e.message}`);
      throw e;
    }
    // Handle non-Error objects
    sendError("Ошибка при загрузке Java: Неизвестная ошибка");
    throw new Error("Неизвестная ошибка");
  }
}
