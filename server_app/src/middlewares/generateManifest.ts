import { NextFunction, Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

interface Manifest {
  version: string;
  files: {
    [key: string]: {
      sha1: string;
      size: number;
    };
  };
}

export default async function generateManifest(req: Request, res: Response, next: NextFunction) {
  const GAME_DIR = path.join(process.cwd(), "game");

  async function sha1(filePath: string) {
    const data = await fs.readFile(filePath);
    return crypto.createHash("sha1").update(data).digest("hex");
  }

  async function getFiles(dir: string): Promise<string[]> {
    let result: string[] = [];
    const list = await fs.readdir(dir);

    for (const file of list) {
      const filepath = path.join(dir, file);
      const filestat = await fs.stat(filepath);

      if (filestat.isDirectory()) {
        const subfiles = await getFiles(filepath);
        result = result.concat(subfiles);
      } else {
        result.push(filepath);
      }
    }
    return result;
  }

  try {
    const files = await getFiles(GAME_DIR);
    const manifest: Manifest = {
      version: Date.now().toString(),
      files: {},
    };

    for (const file of files) {
      const relPath = path.relative(GAME_DIR, file).replace(/\\/g, "/");
      const hash = await sha1(file);
      const stat = await fs.stat(file);

      manifest.files[relPath] = {
        sha1: hash,
        size: stat.size,
      };
    }

    // кладём в req для следующих хендлеров
    (req as any).manifest = manifest;

    next();
  } catch (e) {
    console.error("❌ Error while generating manifest:", e);
    next(e); // отдаём ошибку в Express
  }
}
