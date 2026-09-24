import path from "path";
import dotenv from "dotenv";

export interface AppConfig {
  port: number;
  jwtSecret: string;
  jwtExpires: string;
  adminUsername: string;
  adminPassword: string;
  corsOrigin: string;
  gameDir: string;
  dataDir: string;
  launcherDir: string;
  uploadsDir: string;
  adminDist: string;
  curseforgeApiKey: string;
}

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || "8080", 10),
    jwtSecret: process.env.JWT_SECRET || "",
    jwtExpires: process.env.JWT_EXPIRES || "12h",
    adminUsername: process.env.ADMIN_USERNAME || "",
    adminPassword: process.env.ADMIN_PASSWORD || "",
    corsOrigin: process.env.CORS_ORIGIN || "",
    gameDir: process.env.GAME_DIR || path.join(process.cwd(), "game"),
    dataDir: process.env.DATA_DIR || path.join(process.cwd(), "data"),
    launcherDir: process.env.LAUNCHER_DIR || path.join(process.cwd(), "launcher"),
    uploadsDir: process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"),
    adminDist: process.env.ADMIN_DIST || path.join(process.cwd(), "admin", "dist"),
    curseforgeApiKey: (process.env.CURSEFORGE_API_KEY || "").replaceAll("$$", "$"),
  };
}
