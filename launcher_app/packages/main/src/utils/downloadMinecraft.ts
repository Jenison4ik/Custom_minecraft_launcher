import { sendDownloadStatus } from "../services/notifyService";
import fs from "fs";
import path from "path";
import axios from "axios";
import { mcPath } from "../services/paths";
import { app } from "electron";
import extract from "extract-zip";
import launcherProperties from "../config/launcherProperties";
import { pipeline } from "stream/promises";

export default async function downloadMinecraft() {
  try {
    const BASE_DIR = path.join(app.getPath("userData"), mcPath);
    await fs.promises.mkdir(BASE_DIR, { recursive: true });

    const zipPath = path.join(BASE_DIR, "minecraft.zip");

    sendDownloadStatus("Waiting for download...", 0, true);

    const response = await axios.get(launcherProperties.url + "/download", {
      responseType: "stream",
      decompress: false, // important: do not decode gzip
      headers: { "Accept-Encoding": "identity" },
      validateStatus: (status) => status === 200,
    });

    const contentLength = response.headers["content-length"];
    const total = parseInt(
      typeof contentLength === "string" ? contentLength : "0",
      10
    );
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

    await pipeline(response.data, writer); // correctly write the stream to disk

    sendDownloadStatus(
      "Download complete, preparing directory...",
      100,
      true
    );
    fs.rmSync(path.join(BASE_DIR, "mods"), { recursive: true, force: true }); // remove old mods folder if present

    sendDownloadStatus(
      "Download complete, extracting Minecraft...",
      100,
      true
    );
    // Extract archive
    await extract(zipPath, { dir: BASE_DIR });

    sendDownloadStatus("Minecraft extracted successfully", 100, false);
  } catch (e) {
    sendDownloadStatus("Error downloading Minecraft: " + e, 0, false);
    throw e;
  }
}
