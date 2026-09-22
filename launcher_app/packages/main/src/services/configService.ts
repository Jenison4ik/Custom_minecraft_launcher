import { app } from "electron";
import fs from "fs";
import path from "path";
import type { ConfigEntry } from "@jenison/shared";

function getConfigPath(): string {
  const baseDir = app.getPath("userData");
  const configPath = path.join(baseDir, "config.json");

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, "{}", "utf8");
    console.log("Created config.json\n");
  }
  return configPath;
}

class ConfigService {
  private readonly configPath: string;
  private data: Record<string, unknown>;

  constructor() {
    this.configPath = getConfigPath();
    this.data = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
  }

  getAll(): Record<string, unknown> {
    return this.data;
  }

  addEntries(entries: ConfigEntry[]): void {
    try {
      entries.forEach((entry) => {
        this.data[entry.name] = entry.value;
      });
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.data, null, 2),
        "utf-8"
      );
      this.data = JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.log("Error while writing to config, details: " + errorMessage);
    }
  }
}

const configService = new ConfigService();
export default configService;
