import { app } from "electron";
import fs from "fs";
import path from "path";

export default function getConfig() {
  const baseDir = app.getPath("userData"); //C:\Users\Имя\AppData\Roaming
  const configPath = path.join(baseDir, "config.json");

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, "{}", "utf8");
    console.log("Created config.json\n");
  }
  return configPath;
}
