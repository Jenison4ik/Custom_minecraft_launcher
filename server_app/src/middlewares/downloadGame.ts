import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs'; // для statSync

export default async function downloadGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const LAUNCHER_DIR = path.join(process.cwd(), "launcher");
    const files = await fs.readdir(LAUNCHER_DIR);

    if (files.length === 0) {
      res.status(404).send("No file found in launcher directory");
      return;
    }

    const filePath = path.join(LAUNCHER_DIR, files[0]);

    // Используем только res.sendFile — он корректно ставит Content-Length
    res.setHeader("Content-Type", "application/x-msdownload");
    res.setHeader("Content-Disposition", `attachment; filename="${files[0]}"`);

    res.sendFile(filePath, { dotfiles: 'deny' }, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        if (!res.headersSent) res.status(500).send("Error downloading file");
        next(err);
      }
    });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: 'Error downloading file', details: err });
    next(err);
  }
}
