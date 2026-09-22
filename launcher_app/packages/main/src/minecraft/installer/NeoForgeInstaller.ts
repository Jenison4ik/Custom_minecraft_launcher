import { installNeoForged } from "@xmcl/installer";
import { sendDownloadStatus } from "../../services/notifyService";
import {
  findVersionId,
  listInstalledVersionIds,
  tryParseVersion,
} from "./versionLookup";

/**
 * NeoForged version strings look like "20.4.237" (aligned with MC 1.20.4).
 * When loaderVersion is omitted, fetch the latest matching release from Maven.
 */
async function resolveNeoForgeVersion(
  mcVersion: string,
  loaderVersion?: string
): Promise<string> {
  if (loaderVersion) {
    return loaderVersion;
  }

  const res = await fetch(
    "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge"
  );
  if (!res.ok) {
    throw new Error(
      `Failed to fetch NeoForge version list (${res.status}). Set loaderVersion in launcherProperties.`
    );
  }

  const data = (await res.json()) as { versions?: string[] };
  const versions = data.versions ?? [];
  if (!versions.length) {
    throw new Error(
      "NeoForge version list is empty. Set loaderVersion in launcherProperties."
    );
  }

  // MC 1.20.4 → prefix "20.4."; MC 1.21 → "21.0." / "21."
  const parts = mcVersion.split(".");
  const major = parts[1];
  const minor = parts[2] ?? "0";
  const prefix = `${major}.${minor}.`;

  const matching = versions.filter((v) => v.startsWith(prefix));
  const pool = matching.length ? matching : versions;
  return pool[pool.length - 1];
}

export default async function installNeoForgeLoader(options: {
  mcVersion: string;
  mcDir: string;
  loaderVersion?: string;
  javaPath?: string;
}): Promise<string> {
  const { mcVersion, mcDir, loaderVersion, javaPath } = options;

  sendDownloadStatus("Resolving NeoForge version...", 55, true);
  const neoVersion = await resolveNeoForgeVersion(mcVersion, loaderVersion);

  const installed = listInstalledVersionIds(mcDir);
  const existingId = findVersionId(installed, [
    (id) =>
      id.toLowerCase().includes("neoforge") &&
      (id.includes(neoVersion) || id.includes(mcVersion)),
  ]);

  if (existingId) {
    const parsed = await tryParseVersion(mcDir, existingId);
    if (parsed) {
      sendDownloadStatus(`NeoForge already installed: ${existingId}`, 70, true);
      return existingId;
    }
  }

  sendDownloadStatus(
    `Installing NeoForge ${neoVersion}...`,
    60,
    true
  );

  const versionId = await installNeoForged(
    "neoforge",
    neoVersion,
    mcDir,
    javaPath ? { java: javaPath, side: "client" } : { side: "client" }
  );

  sendDownloadStatus(`NeoForge installed: ${versionId}`, 75, true);
  return versionId;
}
