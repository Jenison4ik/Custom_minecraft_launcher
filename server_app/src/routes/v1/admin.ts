import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import extract from "extract-zip";
import type { AppConfig } from "../../config.js";
import { requireAuth } from "../../middlewares/requireAuth.js";
import {
  deleteGameFile,
  isSafePathError,
  listGameFiles,
  saveGameFile,
} from "../../services/gameFiles.js";
import { withFsLock } from "../../services/lock.js";
import { CatalogError, installCatalogMod, searchCatalog } from "../../services/catalog.js";

function statusOf(error: unknown): number {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return 500;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function adminRouter(config: AppConfig): Router {
  const router = Router();
  const upload = multer({ dest: config.uploadsDir });
  router.use(requireAuth(config));

  router.get("/files", async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limit = clampInt(req.query.limit, 50, 1, 200);
    const offset = clampInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const page = await listGameFiles(config, q, limit, offset);
    res.json(page);
  });

  router.put("/files", upload.single("file"), async (req, res) => {
    try {
      const relativePath = typeof req.body?.path === "string" ? req.body.path : "";
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      if (!relativePath) {
        await fs.promises.rm(req.file.path, { force: true });
        res.status(400).json({ error: "Path is required" });
        return;
      }
      if (path.extname(relativePath).toLowerCase() !== ".jar") {
        await fs.promises.rm(req.file.path, { force: true });
        res.status(400).json({ error: "Only .jar files are allowed" });
        return;
      }
      const entry = await saveGameFile(config, relativePath, req.file.path);
      res.json({ path: relativePath.replace(/\\/g, "/"), ...entry });
    } catch (error) {
      if (req.file) await fs.promises.rm(req.file.path, { force: true });
      if (isSafePathError(error)) {
        res.status(400).json({ error: "Invalid path" });
        return;
      }
      console.error(error);
      res.status(statusOf(error)).json({ error: "Error uploading file" });
    }
  });

  router.delete("/files", async (req, res) => {
    try {
      const relativePath = typeof req.body?.path === "string" ? req.body.path : "";
      if (!relativePath) {
        res.status(400).json({ error: "Path is required" });
        return;
      }
      await deleteGameFile(config, relativePath);
      res.json({ ok: true });
    } catch (error) {
      if (isSafePathError(error)) {
        res.status(400).json({ error: "Invalid path" });
        return;
      }
      const status = statusOf(error);
      if (status >= 500) console.error(error);
      res.status(status).json({ error: status === 404 ? "File not found" : "Error deleting file" });
    }
  });

  router.get("/mods/search", async (req, res) => {
    try {
      const source = typeof req.query.source === "string" ? req.query.source : "";
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const gameVersion = typeof req.query.gameVersion === "string" ? req.query.gameVersion : "";
      const loader = typeof req.query.loader === "string" ? req.query.loader : "";
      const offset = clampInt(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
      const page = await searchCatalog(config, source, q, gameVersion, loader, offset);
      res.json(page);
    } catch (error) {
      const status = error instanceof CatalogError ? error.status : statusOf(error);
      if (status >= 500) console.error(error);
      res.status(status).json({ error: error instanceof CatalogError ? error.message : "Error searching mods" });
    }
  });

  router.post("/mods/install", async (req, res) => {
    try {
      const source = typeof req.body?.source === "string" ? req.body.source : "";
      const projectId = typeof req.body?.projectId === "string" ? req.body.projectId : "";
      const gameVersion = typeof req.body?.gameVersion === "string" ? req.body.gameVersion : "";
      const loader = typeof req.body?.loader === "string" ? req.body.loader : "";
      const installed = await installCatalogMod(config, source, projectId, gameVersion, loader);
      res.json(installed);
    } catch (error) {
      const status = error instanceof CatalogError ? error.status : statusOf(error);
      if (status >= 500) console.error(error);
      res.status(status).json({ error: error instanceof CatalogError ? error.message : "Error installing mod" });
    }
  });

  router.get("/launcher", async (_req, res) => {
    let version: string | null = null;
    let yml: string | null = null;
    try {
      const raw = await fs.promises.readFile(path.join(config.dataDir, "version.json"), "utf-8");
      version = (JSON.parse(raw) as { version?: string }).version ?? null;
    } catch {
      version = null;
    }
    try {
      yml = await fs.promises.readFile(path.join(config.dataDir, "latest.yml"), "utf-8");
    } catch {
      yml = null;
    }
    res.json({ version, yml });
  });

  router.post("/launcher", upload.single("file"), async (req, res) => {
    try {
      const version = typeof req.headers.version === "string" ? req.headers.version : "";
      const yml = typeof req.body?.yml === "string" ? req.body.yml : "";
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }
      if (!version) {
        await fs.promises.rm(req.file.path, { force: true });
        res.status(400).json({ error: "Version is required" });
        return;
      }
      if (!yml) {
        await fs.promises.rm(req.file.path, { force: true });
        res.status(400).json({ error: "No YML content provided" });
        return;
      }
      if (path.extname(req.file.originalname).toLowerCase() !== ".zip") {
        await fs.promises.rm(req.file.path, { force: true });
        res.status(400).json({ error: "Only .zip files are allowed" });
        return;
      }

      await withFsLock(async () => {
        await fs.promises.mkdir(config.launcherDir, { recursive: true });
        const entries = await fs.promises.readdir(config.launcherDir);
        await Promise.all(
          entries.map((entry) =>
            fs.promises.rm(path.join(config.launcherDir, entry), { recursive: true, force: true })
          )
        );
        await extract(req.file!.path, { dir: path.resolve(config.launcherDir) });
        await fs.promises.rm(req.file!.path, { force: true });
        await fs.promises.mkdir(config.dataDir, { recursive: true });
        await fs.promises.writeFile(path.join(config.dataDir, "latest.yml"), yml, "utf-8");
        await fs.promises.writeFile(
          path.join(config.dataDir, "version.json"),
          JSON.stringify({ version })
        );
      });

      res.json({ message: "Launcher uploaded", version });
    } catch (error) {
      if (req.file) await fs.promises.rm(req.file.path, { force: true });
      console.error(error);
      res.status(500).json({ error: "Error uploading launcher" });
    }
  });

  return router;
}
