import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { app } from "electron";
import sendError from "./sendError";
import { updates } from "./gameFiles";

interface Manifest {
  files: {
    [key: string]: {
      sha1: string;
      size: number;
    };
  };
}

export default async function generateManifest(file: string) {
  const baseDir = app.getPath("userData");
  const FILE_DIR = path.join(baseDir, file);

  async function sha1(filePath: string) {
    const data = await fs.readFile(filePath);
    return crypto.createHash("sha1").update(data).digest("hex");
  }

  async function getFiles(dir: string): Promise<string[]> {
    let result: string[] = [];
    const list = await fs.readdir(dir);

    for (const file of list) {
      const filepath = path.join(dir, file);
      const filestat = await fs.stat(filepath);
      const shortpath = filepath.slice(baseDir.length);
      const shouldSkip = !updates.some((exclusion) =>
        shortpath.includes(exclusion)
      );

      if (shouldSkip) {
        continue;
      }
      // process.stdout.write(shortpath + '\n');
      if (filestat.isDirectory()) {
        const subfiles = await getFiles(filepath);
        result = result.concat(subfiles);
      } else {
        result.push(filepath);
      }
    }
    return result;
  }

  try {
    const files = await getFiles(FILE_DIR);
    const manifest: Manifest = {
      files: {},
    };

    for (const file of files) {
      const relPath = path.relative(FILE_DIR, file).replace(/\\/g, "/");
      const hash = await sha1(file);
      const stat = await fs.stat(file);

      manifest.files[relPath] = {
        sha1: hash,
        size: stat.size,
      };
    }

    await fs.writeFile(
      path.join(baseDir, "manifest.json"),
      JSON.stringify(manifest)
    );
    return manifest;
  } catch (e) {
    sendError(`❌ Error while generating manifest: ${e}`);
  }
}
