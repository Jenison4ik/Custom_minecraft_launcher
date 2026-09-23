import {
  getQuiltLoaderVersionsByMinecraft,
  installQuiltVersion,
  type QuiltLoaderArtifact,
} from "@xmcl/installer";
import { sendPhase } from "../../services/notifyService";
import {
  findVersionId,
  listInstalledVersionIds,
  tryParseVersion,
} from "./versionLookup";

function pickQuiltArtifact(
  artifacts: QuiltLoaderArtifact[],
  loaderVersion?: string
): QuiltLoaderArtifact {
  if (!artifacts.length) {
    throw new Error("Quilt version list is empty");
  }

  if (loaderVersion) {
    const found = artifacts.find(
      (a) =>
        a.loader.version === loaderVersion ||
        a.loader.version.includes(loaderVersion)
    );
    if (!found) {
      throw new Error(`Quilt loader ${loaderVersion} not found`);
    }
    return found;
  }

  return artifacts.find((a) => a.loader.stable) ?? artifacts[0];
}

export default async function installQuiltLoader(options: {
  mcVersion: string;
  mcDir: string;
  loaderVersion?: string;
}): Promise<string> {
  const { mcVersion, mcDir, loaderVersion } = options;

  sendPhase("Fetching Quilt version list...");
  const artifacts = await getQuiltLoaderVersionsByMinecraft({
    minecraftVersion: mcVersion,
  });
  const artifact = pickQuiltArtifact(artifacts, loaderVersion);
  const loaderVer = artifact.loader.version;

  const installed = listInstalledVersionIds(mcDir);
  const existingId = findVersionId(installed, [
    (id) =>
      id.toLowerCase().includes("quilt") &&
      id.includes(mcVersion) &&
      id.includes(loaderVer),
  ]);

  if (existingId) {
    const parsed = await tryParseVersion(mcDir, existingId);
    if (parsed) {
      sendPhase(`Quilt already installed: ${existingId}`);
      return existingId;
    }
  }

  sendPhase(`Installing Quilt Loader ${loaderVer}...`);

  const versionId = await installQuiltVersion({
    minecraftVersion: mcVersion,
    version: loaderVer,
    minecraft: mcDir,
    side: "client",
  });

  sendPhase(`Quilt installed: ${versionId}`);
  return versionId;
}
