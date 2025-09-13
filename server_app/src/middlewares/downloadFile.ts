import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import os from "os";
import archiver from "archiver";

export default async function downloadFile(req: Request, res: Response, next: NextFunction) {
  try {
    const GAME_DIR = path.join(process.cwd(), "game");
    const tempZipPath = path.join(os.tmpdir(), "minecraft_files.zip");

    // 1. Создаём write stream в temp-файл
    const output = fs.createWriteStream(tempZipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(GAME_DIR, false);
    await archive.finalize();

    // Ждём окончания записи
    await new Promise<void>((resolve, reject) => {
      output.on("close", resolve);
      output.on("error", reject);
    });

    // 2. Получаем размер ZIP
    const stats = fs.statSync(tempZipPath);
    const fileSize = stats.size;

    // 3. Отправляем файл с Content-Length
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="minecraft_files.zip"');
    res.setHeader("Content-Length", fileSize.toString());

    // 4. Передаем файл клиенту
    const readStream = fs.createReadStream(tempZipPath);

    // Можно отслеживать прогресс
    let sent = 0;
    readStream.on("data", (chunk) => {
      sent += chunk.length;
      const percent = ((sent / fileSize) * 100).toFixed(2);
      process.stdout.write(`\rОтправлено: ${percent}%`);
    });

    readStream.pipe(res);

    readStream.on("end", () => {
      console.log("\n✅ Отправка архива завершена");
      fs.unlink(tempZipPath, (err) => {
      if (err) console.error("Ошибка удаления temp архива:", err);
      });
      next();
    });

    readStream.on("error", (err) => {
      console.error("Ошибка при отправке файла:", err);
      res.status(500).send("Error sending file");
      next(err);
    });
  } catch (err) {
    console.error("Ошибка генерации архива:", err);
    res.status(500).json({ error: "Error generating archive", details: err });
    next(err);
  }
}
