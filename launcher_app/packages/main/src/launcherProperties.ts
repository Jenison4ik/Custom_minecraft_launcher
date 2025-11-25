export type McCore = "fabric" | "forge" | "vanilla";

const launcherProperties = {
  url: "https://jenison.ru/minecraft/api",
  mcCore: "fabric" as McCore,
  servers: [
    {
      ip: "jenison.ru",
      lable: "Chikadrilo Online",
    },
  ],
};

export default launcherProperties;
