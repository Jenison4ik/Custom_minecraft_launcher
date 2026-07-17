export type McCore = "fabric" | "forge" | "vanilla";
import { MinecraftVersion } from "@xmcl/installer";

const launcherProperties = {
  url: "https://jenison.ru/minecraft/api",
  mcVersion: "1.16.4" as MinecraftVersion["id"],
  mcCore: "forge" as McCore,
  servers: [
    {
      ip: "jenison.ru",
      lable: "Chikadrilo Online",
    },
  ],
};

export default launcherProperties;
