import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import fsExtra from 'fs-extra';

export default async function uploadYML(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const DATA_DIR = path.join(process.cwd(), "data");

    // Получаем YAML как текстовое поле 'yml'
    const ymlContent = req.body.yml as string | undefined;
    if (!ymlContent) {
      res.status(400).json({ error: "No YML content provided" });
      return;
    }

    // Создаём папку data, если её нет
    await fsExtra.ensureDir(DATA_DIR);

    // Сохраняем YAML
    const ymlPath = path.join(DATA_DIR, "latest.yml");
    fs.writeFileSync(ymlPath, ymlContent, "utf-8");

    console.log("YML saved to", ymlPath);
    res.status(200).json({ message: "YML uploaded successfully" });

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error uploading YML", details: err });
    next(err);
  }
}
