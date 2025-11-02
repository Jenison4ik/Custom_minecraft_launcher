import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";

export default async function downloadFile(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const zipPath = path.join(process.cwd(), "data", "minecraft_files.zip");

    if (!fs.existsSync(zipPath)) {
      return res
        .status(404)
        .json({ error: "Archive not found. Upload game first." });
    }

    // получаем размер файла
    const stats = fs.statSync(zipPath);
    const fileSize = stats.size;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="minecraft_files.zip"'); 
  res.setHeader("Content-Length", fileSize.toString());

    // 4. Передаем файл клиенту
    const readStream = fs.createReadStream(zipPath);

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
