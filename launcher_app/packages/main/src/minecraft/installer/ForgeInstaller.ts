import {
  getForgeVersionList,
  installForgeTask,
  type ForgeVersion,
} from "@xmcl/installer";
import { trackTask } from "./trackTask";
import { sendPhase } from "../../services/notifyService";
import { getDownloadDispatcher } from "../../utils/undiciAgent";
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

  if (loaderVersion) {
    const installed = listInstalledVersionIds(mcDir);
    const existingId =
      [
        `${mcVersion}-forge-${loaderVersion}`,
        `${mcVersion}-forge${loaderVersion}`,
      ].find((id) => installed.includes(id)) ??
      findVersionId(installed, [
        (id) =>
          id.includes("forge") &&
          id.includes(mcVersion) &&
          id.includes(loaderVersion),
      ]);
    if (existingId) {
      const parsed = await tryParseVersion(mcDir, existingId);
      if (parsed) {
        sendPhase(`Forge уже установлен`);
        return existingId;
      }
    }
  }

  sendPhase("Список версий Forge");
  const dispatcher = getDownloadDispatcher();
  const list = await getForgeVersionList({ minecraft: mcVersion, dispatcher });
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
      sendPhase(`Forge уже установлен`);
      return existingId;
    }
  }

  sendPhase(`Установка Forge ${forgeMeta.version}`);

  const versionId = await trackTask(
    installForgeTask(
      {
        mcversion: forgeMeta.mcversion,
        version: forgeMeta.version,
        installer: forgeMeta.installer,
      },
      mcDir,
      {
        side: "client",
        dispatcher: getDownloadDispatcher(),
        ...(javaPath ? { java: javaPath } : {}),
      }
    ),
    `Установка Forge ${forgeMeta.version}`
  );

  sendPhase(`Forge установлен`);
  return versionId;
}
