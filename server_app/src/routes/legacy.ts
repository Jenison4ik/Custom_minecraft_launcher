import fs from "fs";
import path from "path";
import { Router } from "express";
import type { AppConfig } from "../config.js";
import { ensureZip } from "../services/archive.js";
import { ensureManifest } from "../services/manifest.js";

export function legacyRouter(config: AppConfig): Router {
  const router = Router();

  router.get("/manifest", async (_req, res) => {
    try {
      const manifest = await ensureManifest(config.gameDir, config.dataDir);
      res.json(manifest);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Manifest is not generated" });
    }
  });

  router.get("/download", async (_req, res) => {
    try {
      await ensureManifest(config.gameDir, config.dataDir);
      const archive = await ensureZip(config.gameDir, config.dataDir);
      res.download(archive, "minecraft_files.zip", (error) => {
        if (error && !res.headersSent) {
          res.status(500).json({ error: "Error generating archive" });
        }
      });
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.status(500).json({ error: "Error generating archive" });
    }
  });

  router.get("/latest", (_req, res) => {
    try {
      const versionPath = path.join(config.dataDir, "version.json");
      const data = JSON.parse(fs.readFileSync(versionPath, "utf-8")) as { version?: string };
      res.json({ version: data.version, url: "https://jenison.ru/download" });
    } catch {
      res.status(500).json({ error: "No version data" });
    }
  });

  router.get("/latest.yml", (_req, res) => {
    const ymlPath = path.join(config.dataDir, "latest.yml");
    res.sendFile(ymlPath, (error) => {
      if (error && !res.headersSent) {
        res.status(500).send("Error reading latest.yml");
      }
    });
  });

  router.get("/downloadGame.exe", async (_req, res) => {
    try {
      const entries = await fs.promises.readdir(config.launcherDir, { withFileTypes: true });
      const file = entries.find((entry) => entry.isFile());
      if (!file) {
        res.status(404).send("No file found in launcher directory");
        return;
      }
      const filePath = path.join(config.launcherDir, file.name);
      res.setHeader("Content-Type", "application/x-msdownload");
      res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
      res.sendFile(filePath, { dotfiles: "deny" }, (error) => {
        if (error && !res.headersSent) res.status(500).send("Error downloading file");
      });
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.status(500).json({ error: "Error downloading file" });
    }
  });

  return router;
}
