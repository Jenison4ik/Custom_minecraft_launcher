import extract from 'extract-zip';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import fsExtra from 'fs-extra';

export default async function uploadGame(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const LAUNCHER_DIR = path.join(process.cwd(), "launcher");
      const secret = Buffer.from(process.env.SECRET_KEY || "");
      const provided = Buffer.from(req.headers["x-secret-key"] as string || "");
  
      if (
        secret.length !== provided.length ||
        !crypto.timingSafeEqual(secret, provided)
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      
      if(!req.headers["version"]){
        res.status(400).json({ error: "Version or download URL not specified" });
      }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      if (path.extname(req.file.originalname).toLowerCase() !== '.zip') {
        res.status(400).json({ error: "Only .zip files are allowed" });
        return;
      }
  
      const zipPath = req.file.path;
      await fsExtra.emptyDir(LAUNCHER_DIR);//очистка директории
      await extract(zipPath, { dir: path.resolve(LAUNCHER_DIR) }); // распаковка файла
      fs.unlinkSync(zipPath);
  
      res.status(200).json({ message: "File uploaded successfully" });
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error uploading file", details: err });
      next(err);
    }
  }