import {
  getQuiltLoaderVersionsByMinecraft,
  installQuiltVersion,
  type QuiltLoaderArtifact,
} from "@xmcl/installer";
import { sendDownloadStatus } from "../../services/notifyService";
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

  sendDownloadStatus("Fetching Quilt version list...", 55, true);
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
      sendDownloadStatus(`Quilt already installed: ${existingId}`, 70, true);
      return existingId;
    }
  }

  sendDownloadStatus(`Installing Quilt Loader ${loaderVer}...`, 60, true);

  const versionId = await installQuiltVersion({
    minecraftVersion: mcVersion,
    version: loaderVer,
    minecraft: mcDir,
    side: "client",
  });

  sendDownloadStatus(`Quilt installed: ${versionId}`, 75, true);
  return versionId;
}
