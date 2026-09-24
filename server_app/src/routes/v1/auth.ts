import { Router } from "express";
import type { AppConfig } from "../../config.js";
import { safeEqual, signAdminToken } from "../../services/auth.js";

export function authRouter(config: AppConfig): Router {
  const router = Router();

  router.post("/login", async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!config.jwtSecret || !config.adminUsername || !config.adminPassword) {
      res.status(503).json({ error: "Auth is not configured" });
      return;
    }

    const usernameOk = safeEqual(username, config.adminUsername);
    const passwordOk = safeEqual(password, config.adminPassword);
    if (!usernameOk || !passwordOk) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const token = await signAdminToken(config.adminUsername, config.jwtSecret, config.jwtExpires);
    res.json({ token, expiresIn: config.jwtExpires });
  });

  return router;
}
