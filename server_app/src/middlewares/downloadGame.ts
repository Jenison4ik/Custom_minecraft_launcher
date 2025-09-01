import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';

export default async function downloadGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const LAUNCHER_DIR = process.env.LAUNCHER_DIR || path.resolve("launcher_dir");
    const files = await fs.readdir(LAUNCHER_DIR);

    if (files.length === 0) {
      res.status(404).send("No file found in launcher directory");
      return;
    }

    const filePath = path.join(LAUNCHER_DIR, files[0]);
    res.download(filePath, files[0], (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        res.status(500).send("Error downloading file");
        next(err);
      } else {
        res.status(200);
        next();
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error downloading file', details: err });
    next(err);
  }
}