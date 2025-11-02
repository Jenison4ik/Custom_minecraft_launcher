import sendDownloadStatus from "./sendDownloadStatus";
import fs from "fs";
import path from "path";
import axios from "axios";
import { mcPath } from "./createLauncherDir";
import { app } from "electron";
import extract from "extract-zip";
import url from "./url";
import { pipeline } from "stream/promises";

export default async function downloadMinecraft() {
  try {
    const BASE_DIR = path.join(app.getPath("userData"), mcPath);
    await fs.promises.mkdir(BASE_DIR, { recursive: true });

    const zipPath = path.join(BASE_DIR, "minecraft.zip");

    sendDownloadStatus("Waiting Minecraft Download...", 0, true);

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
          `Downloading Minecraft: ${Math.floor(loaded / 1048576)} MB of ${Math.floor(total / 1048576)} MB`,
          percent,
          true
        );
      }
    });

    await pipeline(response.data, writer); // корректная запись потока на диск

    sendDownloadStatus("Download completed, preparing directory...", 100, true);
    fs.rmSync(path.join(BASE_DIR, "mods"), { recursive: true, force: true }); // удаление старого архива, если он есть

    sendDownloadStatus("Download completed, unpacking Minecraft...", 100, true);
    // Распаковка архива
    await extract(zipPath, { dir: BASE_DIR });

    sendDownloadStatus("Minecraft unpacked successfully", 100, false);
  } catch (e) {
    sendDownloadStatus("Error during Minecraft download: " + e, 0, false);
    throw e;
  }
}
