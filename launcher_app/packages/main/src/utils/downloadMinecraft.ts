import { byteProgress, sendPhase } from "../services/notifyService";
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

    sendPhase("Waiting for download...");

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
      byteProgress("Downloading Minecraft", loaded, total);
    });

    await pipeline(response.data, writer); // correctly write the stream to disk

    sendPhase("Download complete, preparing directory...");
    fs.rmSync(path.join(BASE_DIR, "mods"), { recursive: true, force: true }); // remove old mods folder if present

    sendPhase("Download complete, extracting Minecraft...");
    // Extract archive
    await extract(zipPath, { dir: BASE_DIR });

    sendPhase("Minecraft extracted successfully", false);
  } catch (e) {
    sendPhase("Error downloading Minecraft: " + e, false);
    throw e;
  }
}
