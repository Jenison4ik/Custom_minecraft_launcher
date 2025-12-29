// config/Config.ts
import fs from "fs";
import path from "path";
import { LauncherConfig } from "./types/LauncherConfig";

export class Config {
  private static instance: Config;

  private config: LauncherConfig;
  private readonly configPath: string;

  private constructor() {
    this.configPath = path.resolve(process.cwd(), "config.json");
    this.config = this.load();
  }

  /** Получить singleton */
  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /** Загрузка из файла */
  private load(): LauncherConfig {
    if (!fs.existsSync(this.configPath)) {
      const defaultConfig: LauncherConfig = {
        nickname: "Steve",
        ram: 2048,
        disableDownload: false,
        id: "",
        core: "vanilla",
      };
      fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }

    return JSON.parse(
      fs.readFileSync(this.configPath, "utf-8")
    ) as LauncherConfig;
  }

  /** Сохранение */
  private save() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  // ======================
  // Public API
  // ======================

  get(): LauncherConfig {
    return this.config;
  }

  getValue<K extends keyof LauncherConfig>(key: K): LauncherConfig[K] {
    return this.config[key];
  }

  setValue<K extends keyof LauncherConfig>(key: K, value: LauncherConfig[K]) {
    this.config[key] = value;
    this.save();
  }

  update(partial: Partial<LauncherConfig>) {
    this.config = { ...this.config, ...partial };
    this.save();
  }
}
