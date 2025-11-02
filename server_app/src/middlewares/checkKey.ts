import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export default async function checkKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const SECRET_KEY = Buffer.from(process.env.SECRET_KEY || "");
  const provided = Buffer.from((req.headers["x-secret-key"] as string) || "");
  if (
    SECRET_KEY.length !== provided.length ||
    !crypto.timingSafeEqual(SECRET_KEY, provided)
  ) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
