export type McCore = "vanilla" | "fabric" | "forge" | "quilt" | "neoforge";

import { MinecraftVersion } from "@xmcl/installer";

const launcherProperties = {
  url: "https://jenison.ru/minecraft/api",
  /** Vanilla Minecraft version, e.g. 1.16.4 */
  mcVersion: "1.16.4" as MinecraftVersion["id"],
  /** Mod loader to install on top of mcVersion */
  mcCore: "fabric" as McCore,
  /**
   * Mod loader version (Forge / Fabric / Quilt / NeoForge).
   * Examples: "35.1.37" (Forge), "0.16.14" (Fabric).
   * Empty string — use recommended/latest for mcVersion.
   */
  loaderVersion: "0.16.14",
  servers: [
    {
      ip: "jenison.ru",
      lable: "Chikadrilo Online",
    },
  ],
};

export default launcherProperties;
