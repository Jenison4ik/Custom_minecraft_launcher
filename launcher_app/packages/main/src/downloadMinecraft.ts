import sendDownloadStatus from "./sendDownloadStatus";
import fs from "fs";
import path from "path";
import axios from "axios";
import { mcPath } from "./createLauncherDir";
import { app } from "electron";
import extract from "extract-zip";
import url from "./launcherProperties";
import { pipeline } from "stream/promises";

export default async function downloadMinecraft() {
  try {
    const BASE_DIR = path.join(app.getPath("userData"), mcPath);
    await fs.promises.mkdir(BASE_DIR, { recursive: true });

    const zipPath = path.join(BASE_DIR, "minecraft.zip");

    sendDownloadStatus("Ожидание Загрузки...", 0, true);

    const response = await axios.get(url + "/download", {
      responseType: "stream",
      decompress: false, // важно, чтобы не декодировать gzip
      headers: { "Accept-Encoding": "identity" },
      validateStatus: (status) => status === 200,
    });

    const total = parseInt(response.headers["content-length"] || "0", 10);
    let loaded = 0;

    const writer = fs.createWriteStream(zipPath);

    response.data.on("data", (chunk: Buffer) => {
      loaded += chunk.length;
      if (total) {
        const percent = Math.round((loaded * 100) / total);
        sendDownloadStatus(
          `Загрузка Minecraft: ${Math.floor(loaded / 1048576)} MB of ${Math.floor(total / 1048576)} MB`,
          percent,
          true
        );
      }
    });

    await pipeline(response.data, writer); // корректная запись потока на диск

    sendDownloadStatus(
      "Загрузка завершена, подготавливается каталог...",
      100,
      true
    );
    fs.rmSync(path.join(BASE_DIR, "mods"), { recursive: true, force: true }); // удаление старого архива, если он есть

    sendDownloadStatus(
      "Загрузка завершена, распаковываем Minecraft...",
      100,
      true
    );
    // Распаковка архива
    await extract(zipPath, { dir: BASE_DIR });

    sendDownloadStatus("Minecraft успешно распакован", 100, false);
  } catch (e) {
    sendDownloadStatus("Ошибка при загрузке Minecraft: " + e, 0, false);
    throw e;
  }
}
