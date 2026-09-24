import fs from "fs/promises";
import { Router } from "express";
import type { AppConfig } from "../../config.js";
import { ensureManifest } from "../../services/manifest.js";
import { ProfileError, readProfile } from "../../services/profile.js";
import { resolveInside, SafePathError } from "../../services/safePath.js";

function fileParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join("/");
  return value ?? "";
}

export function publicRouter(config: AppConfig): Router {
  const router = Router();

  router.get("/profile", async (_req, res) => {
    try {
      const profile = await readProfile(config.dataDir);
      if (!profile) {
        res.status(404).json({ error: "Profile is not set" });
        return;
      }
      res.json(profile);
    } catch (error) {
      console.error(error);
      const status = error instanceof ProfileError ? error.status : 500;
      res.status(status).json({ error: error instanceof ProfileError ? error.message : "Profile is invalid" });
    }
  });

  router.get("/manifest", async (_req, res) => {
    try {
      const manifest = await ensureManifest(config.gameDir, config.dataDir);
      res.json(manifest);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Manifest is not generated" });
    }
  });

  router.get("/files/*filePath", async (req, res) => {
    try {
      const relativePath = fileParam((req.params as { filePath?: string | string[] }).filePath);
      const absolute = resolveInside(config.gameDir, relativePath);
      const stat = await fs.stat(absolute).catch(() => null);
      if (!stat || !stat.isFile()) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      res.sendFile(absolute, { dotfiles: "allow" }, (error) => {
        if (error && !res.headersSent) res.status(500).json({ error: "Error sending file" });
      });
    } catch (error) {
      if (error instanceof SafePathError) {
        res.status(400).json({ error: "Invalid path" });
        return;
      }
      console.error(error);
      if (!res.headersSent) res.status(500).json({ error: "Error sending file" });
    }
  });

  return router;
}
