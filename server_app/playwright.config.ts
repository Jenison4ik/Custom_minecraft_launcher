import fs from "fs";
import os from "os";
import path from "path";
import { defineConfig, devices } from "@playwright/test";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-e2e-"));
const apiPort = "8099";
const panelPort = "5174";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${panelPort}/admin/`,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npx tsx src/index.ts",
      port: Number(apiPort),
      reuseExistingServer: false,
      env: {
        ...process.env,
        PORT: apiPort,
        JWT_SECRET: "e2e-secret-e2e-secret-e2e-secret",
        JWT_EXPIRES: "12h",
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: "secret",
        CORS_ORIGIN: `http://127.0.0.1:${panelPort}`,
        GAME_DIR: path.join(root, "game"),
        DATA_DIR: path.join(root, "data"),
        LAUNCHER_DIR: path.join(root, "launcher"),
        UPLOADS_DIR: path.join(root, "uploads"),
        ADMIN_DIST: path.join(root, "no-admin-dist"),
      },
    },
    {
      command: `npx vite --port ${panelPort} --strictPort --host 127.0.0.1`,
      cwd: "./admin",
      port: Number(panelPort),
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_API_PROXY: `http://127.0.0.1:${apiPort}`,
      },
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
