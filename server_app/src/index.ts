import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { error } from 'console';

//Middlewares
import uploadFile from './middlewares/uploadFile.js';
import downloadFile from './middlewares/downloadFile.js';
import generateManifest from './middlewares/generateManifest.js';
import downloadGame from './middlewares/downloadGame.js';
import uploadGame from './middlewares/uploadGame.js';

interface RequestWithManifest extends Request {
  manifest?: any;
}

// Загружаем переменные окружения из .env файла
dotenv.config({ path: './.env' });

const app = express();
const upload = multer({ dest: 'uploads/' });
// Получаем переменные окружения
const PORT: number = parseInt(process.env.PORT || '8080', 10);
const GAME_DIR = process.env.GAME_DIR || path.resolve("game_dir");

function getFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}



// Пример маршрута
app.get('/', (req: Request, res: Response) => {
  res.send('Hello, Minecraft Launcher!');
});

app.post("/upload", upload.single("file"), uploadFile, generateManifest,(req,res,next)=>{
  try{
    if(!(req as RequestWithManifest).manifest){
      throw new Error("Manifest is not generated");
    }
    fs.writeFileSync(path.join(GAME_DIR, "manifest.json"), JSON.stringify((req as RequestWithManifest).manifest, null, 2));
  }catch (e) {
    console.error("❌ Error while saving manifest:", e);
    next(e);
  }
});

app.get("/download", downloadFile);

app.get("/manifest", async (req: RequestWithManifest, res) => {
  try {
    const manifestPath = path.join(GAME_DIR, "manifest.json");

    // пробуем прочитать готовый манифест
    try {
      const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf-8"));
      return res.json(manifest);
    } catch {
      // файла нет — генерим новый
      await generateManifest(req, res, () => {});
      return res.json((req as RequestWithManifest).manifest);
    }
  } catch (e) {
    console.error("❌ Error in /manifest:", e);
    res.status(500).json({ error: "Manifest is not generated" });
  }
});

app.get("/downloadGame",downloadGame);

app.post("/uploadGame", upload.single('file') ,uploadGame);

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});