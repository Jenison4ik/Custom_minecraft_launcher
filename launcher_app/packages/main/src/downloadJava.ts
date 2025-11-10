import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import extract from "extract-zip";
import { app } from "electron";
import sendError from "./sendError";
import sendDownloadStatus from "./sendDownloadStatus";

const javaBaseDir = path.join(app.getPath("userData"), "java");
const java17Path = path.join(javaBaseDir, "temurin-17");
const os =
  process.platform === "win32"
    ? "windows"
    : process.platform === "darwin"
      ? "mac"
      : "linux";
const arch = process.arch === "x64" ? "x64" : "aarch64";

//URL для Windows x64
const JAVA_URL = `https://api.adoptium.net/v3/binary/version/jdk-17.0.10+7/${os}/${arch}/jdk/hotspot/normal/eclipse?project=jdk`;

export async function ensureJava17(): Promise<string> {
  let stopAnimation = () => {};
  try {
    const javaExecutable = path.join(
      java17Path,
      "bin",
      process.platform === "win32" ? "java.exe" : "java"
    );

    if (fs.existsSync(javaExecutable)) {
      return javaExecutable;
    }
    sendDownloadStatus("Java 17 не найдена, загружаем...", 0, true);

    const zipPath = path.join(app.getPath("temp"), "java17.zip");

    const writer = fs.createWriteStream(zipPath);

    const response = await axios.get(JAVA_URL, {
      responseType: "stream",
      onDownloadProgress: (progressEvent) => {
        const { loaded, total } = progressEvent;
        if (total) {
          const percent = Math.round((loaded * 100) / total);
          console.log(
            `\r Загрузка Java17 ${Math.floor(loaded / 1048576)} MB from ${Math.floor(total / 1048576)} MB`
          );
          sendDownloadStatus(
            `Загрузка Java 17: loaded ${Math.floor(loaded / 1048576)} MB from ${Math.floor(total / 1048576)} MB`,
            percent,
            true
          );
        } else {
          sendDownloadStatus(`Загрузка Java 17: ${loaded} bytes`, 100, false);
        }
      },
    });

    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    sendDownloadStatus("Загрузка завершена, распаковываем Java...", 100, true);
    console.log("Распаковка Java...\n");
    await extract(zipPath, { dir: javaBaseDir });

    //название извлечённой папки
    const extractedDir = fs
      .readdirSync(javaBaseDir)
      .find((d) => d.includes("jdk") || d.includes("jre"));
    if (!extractedDir) throw new Error("Извлеченная папка Java не найдена");

    fs.renameSync(path.join(javaBaseDir, extractedDir), java17Path);

    sendDownloadStatus("Установка Java 17 завершена!", 100, false);
    console.log("Java 17 установлен\n");
    return javaExecutable;
  } catch (e: unknown) {
    if (e instanceof Error) {
      sendError(`Ошибка при загрузке Java 17: ${e.message}`);
      throw e;
    }
    // Handle non-Error objects
    sendError("Ошибка при загрузке Java 17: Неизвестная ошибка");
    throw new Error("Неизвестная ошибка");
  }
}
