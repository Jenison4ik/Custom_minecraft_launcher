import {
  getForgeVersionList,
  installForge,
  type ForgeVersion,
} from "@xmcl/installer";
import { sendDownloadStatus } from "../../services/notifyService";
import {
  findVersionId,
  listInstalledVersionIds,
  tryParseVersion,
} from "./versionLookup";

function pickForgeVersion(
  versions: ForgeVersion[],
  loaderVersion?: string
): ForgeVersion {
  if (!versions.length) {
    throw new Error("Forge version list is empty");
  }

  if (loaderVersion) {
    const found = versions.find(
      (v) =>
        v.version === loaderVersion ||
        v.version.includes(loaderVersion) ||
        `${v.mcversion}-${v.version}` === loaderVersion
    );
    if (!found) {
      throw new Error(
        `Forge ${loaderVersion} not found for Minecraft ${versions[0]?.mcversion}`
      );
    }
    return found;
  }

  return (
    versions.find((v) => v.type === "recommended") ??
    versions.find((v) => v.type === "latest") ??
    versions[0]
  );
}

export default async function installForgeLoader(options: {
  mcVersion: string;
  mcDir: string;
  loaderVersion?: string;
  javaPath?: string;
}): Promise<string> {
  const { mcVersion, mcDir, loaderVersion, javaPath } = options;

  sendDownloadStatus("Fetching Forge version list...", 55, true);
  const list = await getForgeVersionList({ minecraft: mcVersion });
  const forgeMeta = pickForgeVersion(list.versions, loaderVersion);

  const expectedIds = [
    `${mcVersion}-forge-${forgeMeta.version}`,
    `${mcVersion}-forge${forgeMeta.version}`,
    `${forgeMeta.mcversion}-forge-${forgeMeta.version}`,
  ];

  const installed = listInstalledVersionIds(mcDir);
  const existingId =
    expectedIds.find((id) => installed.includes(id)) ??
    findVersionId(installed, [
      (id) =>
        id.includes("forge") &&
        id.includes(mcVersion) &&
        id.includes(forgeMeta.version),
    ]);

  if (existingId) {
    const parsed = await tryParseVersion(mcDir, existingId);
    if (parsed) {
      sendDownloadStatus(`Forge already installed: ${existingId}`, 70, true);
      return existingId;
    }
  }

  sendDownloadStatus(
    `Installing Forge ${forgeMeta.version} for ${mcVersion}...`,
    60,
    true
  );

  const versionId = await installForge(
    {
      mcversion: forgeMeta.mcversion,
      version: forgeMeta.version,
      installer: forgeMeta.installer,
    },
    mcDir,
    javaPath ? { java: javaPath, side: "client" } : { side: "client" }
  );

  sendDownloadStatus(`Forge installed: ${versionId}`, 75, true);
  return versionId;
}
