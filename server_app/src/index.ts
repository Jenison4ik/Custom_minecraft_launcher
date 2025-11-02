import express from "express";
import type { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import archiver from "archiver";
//Middlewares
import uploadFile from "./middlewares/uploadFile.js";
import downloadFile from "./middlewares/downloadFile.js";
import generateManifest from "./middlewares/generateManifest.js";
import downloadGame from "./middlewares/downloadGame.js";
import uploadGame from "./middlewares/uploadGame.js";
import uploadYML from "./middlewares/uploadYML.js";

interface RequestWithManifest extends Request {
  manifest?: any;
}

// Загружаем переменные окружения из .env файла
dotenv.config({ path: "./.env" });

const app = express();
const upload = multer({ dest: "uploads/" });
// Получаем переменные окружения
const PORT: number = parseInt(process.env.PORT || "8080", 10);

const GAME_DIR = path.join(process.cwd(), "game");
const DATA_DIR = path.join(process.cwd(), "data");
// Пример маршрута
app.get("/", (req: Request, res: Response) => {
  res.send("Hello, from Jenison`s MC Launcher!");
});


app.post(
  "/minecraft/api/upload",
  upload.single("file"),
  uploadFile,
  generateManifest,
  async (req, res, next) => {
    try {
      if (!(req as RequestWithManifest).manifest) {
        throw new Error("Manifest is not generated");
      }

      // сохраняем манифест
      fs.writeFileSync(
        path.join(DATA_DIR, "manifest.json"),
        JSON.stringify((req as RequestWithManifest).manifest, null, 2)
      );

      const zipPath = path.join(DATA_DIR, "minecraft_files.zip");
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      // логирование ошибок
      archive.on("warning", (err) => console.warn("⚠️ Archive warning:", err));
      archive.on("error", (err) => { throw err });

      archive.pipe(output);

      // Добавляем абсолютно все файлы и скрытые тоже
      archive.glob("**/*", { cwd: GAME_DIR, dot: true });

      // ждём полного завершения
      await new Promise<void>((resolve, reject) => {
        output.on("close", () => {
          console.log(`✅ Архив создан: ${zipPath}, размер ${archive.pointer()} байт`);
          resolve();
        });
        archive.on("error", reject);
        archive.finalize();
      });

      res.status(200).json({
        message: "File uploaded and archive prepared successfully",
        archive: zipPath,
      });
    } catch (err) {
      console.error("❌ Error in uploadFile:", err);
      res.status(500).json({ error: "Error uploading file", details: err });
      next(err);
    }
  }
);
app.get("/minecraft/api/download", downloadFile);

app.get("/minecraft/api/latest", (req, res) => {
  try {
    const version_path = path.join(process.cwd(), "data", "version.json");
    const data = JSON.parse(fs.readFileSync(version_path, "utf-8"));

    res.json({ version: data.version, url: "https://jenison.ru/download" });
  } catch (e) {
    res.status(500).json({ error: "No version data" });
  }
});

app.get("/minecraft/api/manifest", async (req: RequestWithManifest, res) => {
  try {
    const manifestPath = path.join(DATA_DIR, "manifest.json");

    // пробуем прочитать готовый манифест
    try {
      const manifest = JSON.parse(
        await fs.promises.readFile(manifestPath, "utf-8")
      );
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

app.get("/minecraft/api/downloadGame.exe", downloadGame);

app.post("/minecraft/api/uploadGame", upload.single("file"), uploadGame,uploadYML, (req, res) => {
  try {
    const version = {
      version: req.headers["version"],
    };

    fs.writeFileSync(
      path.join(process.cwd(), "data", "version.json"),
      JSON.stringify(version),
      { flag: "w" }
    );
  } catch (e) {
    res.status(500).json({ error: "Can`t write version" });
  }
});

app.get("/minecraft/api/latest.yml", (req, res) => {
  res.sendFile(path.join(process.cwd(), "data", "latest.yml"), (err) => {
    if (err) {
      console.error("Error sending latest.yml:", err);
      res.status(500).send("Error reading latest.yml");
    }
  });
});

// Запуск сервера
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
