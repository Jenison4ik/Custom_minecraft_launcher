import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "../config.js";
import { verifyAdminToken } from "../services/auth.js";

export function requireAuth(config: AppConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    if (!token || !config.jwtSecret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      await verifyAdminToken(token, config.jwtSecret);
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  };
}
