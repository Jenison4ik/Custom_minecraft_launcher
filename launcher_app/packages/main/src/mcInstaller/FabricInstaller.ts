import {
  FabricLoaderArtifact,
  getFabricLoaderArtifact,
  installFabric,
} from "@xmcl/installer";
import { LauncherConfig } from "../types/LauncherConfig";
import { Version } from "@xmcl/core";
import { send } from "process";
import sendDownloadStatus from "../sendDownloadStatus";

//-----------------
// HELPER FUNCTIONS
//-----------------
async function isFabricInstalled(
  mcDir: string,
  fabricArtifact: FabricLoaderArtifact,
  config: LauncherConfig
) {
  try {
    const version = await Version.parse(
      mcDir,
      `${config.id}-fabric${fabricArtifact.loader.version}`
    );
    console.log(version);
    console.log(fabricArtifact.loader.version);
    return version;
  } catch (e) {
    console.error(
      `Error ${e}: Fabric loader version ${fabricArtifact.loader?.version} for Minecraft ${config.id} is not installed.`
    );
    return new Error("Fabric not installed");
  }
}

//-----------------
// MAIN FUNCTION
//-----------------
export default async function FabricInstaller(
  config: LauncherConfig,
  mcDir: string
) {
  const fabricVersion = config.loader?.version ?? null;
  const artifactList = (await getFabricLoaderArtifact(
    config.id,
    ""
  )) as unknown as FabricLoaderArtifact[];

  //Версия из конфига либо последняя стабильная
  const fabricArtifact = (() => {
    if (!artifactList || artifactList.length === 0) {
      // console.warn("No fabric artifacts found for", config.id);
      return new Error(`No fabric artifacts found for ${config.id}`);
    }
    if (fabricVersion) {
      const found = artifactList.find((a) => {
        return a.loader?.version?.includes(fabricVersion);
      });
      return (
        found ??
        new Error(
          `Fabric version ${fabricVersion} not found for Minecraft ${config.id}`
        )
      );
    }
    return (
      artifactList.find((a) => {
        return a.loader.stable === true;
      }) ?? artifactList[0]
    );
  })();

  if (fabricArtifact instanceof Error) {
    throw fabricArtifact;
  }

  let installed = await isFabricInstalled(mcDir, fabricArtifact, config);

  if (installed instanceof Error) {
    sendDownloadStatus(
      `Установка Fabric Loader ${fabricArtifact.loader.version}...`,
      60,
      true
    );
    await installFabric({
      minecraftVersion: config.id,
      side: "client",
      version: fabricArtifact.loader.version,
      minecraft: mcDir,
    });
    sendDownloadStatus(
      `Fabric Loader ${fabricArtifact.loader.version} установлен.`,
      100,
      false
    );
    installed = await isFabricInstalled(mcDir, fabricArtifact, config);
    if (installed instanceof Error) {
      throw new Error("Fabric installation failed");
    }
    return installed;
  } else {
    return installed;
  }
}
