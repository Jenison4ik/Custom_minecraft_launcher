import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import extract from "extract-zip";
import { app } from "electron";

const javaBaseDir = path.join(app.getPath("userData"), "java");
const java17Path = path.join(javaBaseDir, "temurin-17");

// URL для Windows x64
const JAVA_URL = "https://api.adoptium.net/v3/binary/version/jdk-17.0.10+7/windows/x64/jdk/hotspot/normal/eclipse?project=jdk";

export async function ensureJava17(): Promise<string> {
  const javaExecutable = path.join(java17Path, "bin", "java.exe");

  if (fs.existsSync(javaExecutable)) {
    return javaExecutable;
  }

  console.log("Java 17 not found, downloading...");

  const zipPath = path.join(app.getPath("temp"), "java17.zip");

  const writer = fs.createWriteStream(zipPath);
  const response = await axios.get(JAVA_URL, { responseType: "stream" });
  response.data.pipe(writer);

  await new Promise<void>((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  console.log("Unpacking Java...");
  await extract(zipPath, { dir: javaBaseDir });

  // Найдём название извлечённой папки
  const extractedDir = fs.readdirSync(javaBaseDir).find(d => d.includes("jdk") || d.includes("jre"));
  if (!extractedDir) throw new Error("The extracted Java folder could not be found");

  fs.renameSync(path.join(javaBaseDir, extractedDir), java17Path);

  console.log("Java 17 installed");
  return javaExecutable;
}
