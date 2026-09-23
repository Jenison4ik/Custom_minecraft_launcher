import fs from "fs";
import path from "path";
import archiver from "archiver";
import { withFsLock } from "./lock.js";
import { manifestPath } from "./manifest.js";

export function zipPath(dataDir: string): string {
  return path.join(dataDir, "minecraft_files.zip");
}

function statMtime(filePath: string): number | null {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

export function rebuildZip(gameDir: string, dataDir: string): Promise<string> {
  return withFsLock(async () => {
    await fs.promises.mkdir(dataDir, { recursive: true });
    await fs.promises.mkdir(gameDir, { recursive: true });
    const target = zipPath(dataDir);
    const temp = `${target}.tmp`;
    await fs.promises.rm(temp, { force: true });

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(temp);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", () => resolve());
      output.on("error", reject);
      archive.on("error", reject);
      archive.pipe(output);
      archive.glob("**/*", { cwd: gameDir, dot: true });
      void archive.finalize();
    });

    await fs.promises.rename(temp, target);
    return target;
  });
}

export async function ensureZip(gameDir: string, dataDir: string): Promise<string> {
  const target = zipPath(dataDir);
  const zipMtime = statMtime(target);
  const manifestMtime = statMtime(manifestPath(dataDir));
  const stale = zipMtime === null || manifestMtime === null || zipMtime < manifestMtime;
  if (!stale) return target;
  return rebuildZip(gameDir, dataDir);
}
