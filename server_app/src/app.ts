import fs from "fs";
import path from "path";
import express from "express";
import type { Express } from "express";
import type { AppConfig } from "./config.js";
import { legacyRouter } from "./routes/legacy.js";
import { authRouter } from "./routes/v1/auth.js";
import { publicRouter } from "./routes/v1/public.js";
import { adminRouter } from "./routes/v1/admin.js";

export function createApp(config: AppConfig): Express {
  fs.mkdirSync(config.gameDir, { recursive: true });
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.launcherDir, { recursive: true });
  fs.mkdirSync(config.uploadsDir, { recursive: true });

  const app = express();
  app.disable("x-powered-by");

  if (config.corsOrigin) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin === config.corsOrigin) {
        res.setHeader("Access-Control-Allow-Origin", config.corsOrigin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, version");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      }
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
      next();
    });
  }

  app.use(express.json({ limit: "2mb" }));

  app.get("/", (_req, res) => {
    res.send("Hello, from Jenison`s MC Launcher!");
  });

  app.use("/minecraft/api/v1/auth", authRouter(config));
  app.use("/minecraft/api/v1/admin", adminRouter(config));
  app.use("/minecraft/api/v1", publicRouter(config));
  app.use("/minecraft/api", legacyRouter(config));

  if (fs.existsSync(config.adminDist)) {
    app.use("/admin", express.static(config.adminDist));
    app.get(/^\/admin(?:\/.*)?$/, (_req, res) => {
      res.sendFile(path.join(config.adminDist, "index.html"));
    });
  }

  return app;
}
