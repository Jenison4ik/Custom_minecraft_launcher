import {
  getLoaderArtifactListFor,
  installFabric,
  type FabricLoaderArtifact,
} from "@xmcl/installer";
import { sendPhase } from "../../services/notifyService";
import {
  findVersionId,
  listInstalledVersionIds,
  tryParseVersion,
} from "./versionLookup";

function pickFabricArtifact(
  artifacts: FabricLoaderArtifact[],
  loaderVersion?: string
): FabricLoaderArtifact {
  if (!artifacts.length) {
    throw new Error("Fabric version list is empty");
  }

  if (loaderVersion) {
    const found = artifacts.find(
      (a) =>
        a.loader.version === loaderVersion ||
        a.loader.version.includes(loaderVersion)
    );
    if (!found) {
      throw new Error(`Fabric loader ${loaderVersion} not found`);
    }
    return found;
  }

  return artifacts.find((a) => a.loader.stable) ?? artifacts[0];
}

export default async function installFabricLoader(options: {
  mcVersion: string;
  mcDir: string;
  loaderVersion?: string;
}): Promise<string> {
  const { mcVersion, mcDir, loaderVersion } = options;

  sendPhase("Fetching Fabric version list...");
  const artifacts = await getLoaderArtifactListFor(mcVersion);
  const artifact = pickFabricArtifact(artifacts, loaderVersion);
  const loaderVer = artifact.loader.version;

  const installed = listInstalledVersionIds(mcDir);
  const existingId = findVersionId(installed, [
    (id) =>
      id.toLowerCase().includes("fabric") &&
      id.includes(mcVersion) &&
      id.includes(loaderVer),
    (id) => id === `${mcVersion}-fabric${loaderVer}`,
    (id) => id === `fabric-loader-${loaderVer}-${mcVersion}`,
  ]);

  if (existingId) {
    const parsed = await tryParseVersion(mcDir, existingId);
    if (parsed) {
      sendPhase(`Fabric already installed: ${existingId}`);
      return existingId;
    }
  }

  sendPhase(`Installing Fabric Loader ${loaderVer}...`);

  const versionId = await installFabric({
    minecraftVersion: mcVersion,
    version: loaderVer,
    minecraft: mcDir,
    side: "client",
  });

  sendPhase(`Fabric installed: ${versionId}`);
  return versionId;
}
