import { Request, Response, NextFunction } from 'express';
import path from 'path';
import archiver from 'archiver';

export default function downloadFile(req: Request, res: Response, next: NextFunction): void {
    try {
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=minecraft_files.zip");
      res.status(200)
        
      const GAME_DIR = process.env.GAME_DIR || path.resolve("game_dir");
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      archive.pipe(res);
      archive.directory(GAME_DIR, false);
      archive.finalize();
  
      archive.on('end', () => {
        next();
      });
      archive.on('error', (err) => {
        res.status(500).json({ error: 'Error downloading files', details: err });
        next(err);
      });
    } catch (err) {
      res.status(500).json({ error: 'Error downloading files', details: err });
      next(err);
    }
  }