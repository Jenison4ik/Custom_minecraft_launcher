import fs from "fs/promises";
import {
  MinecraftFolder,
  Version,
  diagnose,
  diagnoseAssets,
  diagnoseLibraries,
  diagnoseJar,
  type MinecraftLocation,
  type ResolvedLibrary,
  type ResolvedVersion,
} from "@xmcl/core";

export interface MissingAsset {
  name: string;
  hash: string;
  size: number;
}

export async function isVanillaReady(
  mcDir: MinecraftLocation,
  versionId: string
): Promise<boolean> {
  try {
    const resolved = await Version.parse(mcDir, versionId);
    const jarIssue = await diagnoseJar(resolved, MinecraftFolder.from(mcDir));
    return !jarIssue;
  } catch {
    return false;
  }
}

export async function missingAssets(
  mcDir: MinecraftLocation,
  resolved: ResolvedVersion
): Promise<MissingAsset[]> {
  const folder = MinecraftFolder.from(mcDir);
  const indexPath = folder.getAssetsIndex(resolved.assets);
  const parsed = JSON.parse(await fs.readFile(indexPath, "utf8")) as {
    objects?: Record<string, { hash: string; size: number }>;
  };
  const issues = await diagnoseAssets(parsed.objects ?? {}, folder);
  return issues.map((issue) => issue.asset);
}

export async function missingLibraries(
  mcDir: MinecraftLocation,
  resolved: ResolvedVersion
): Promise<ResolvedLibrary[]> {
  const issues = await diagnoseLibraries(resolved, MinecraftFolder.from(mcDir));
  return issues.map((issue) => issue.library);
}

/**
 * One pass over the installed version: asset index, missing assets, missing libraries.
 * Version json/jar are checked separately via isVanillaReady so a missing install
 * does not hash thousands of files that are not there yet.
 */
export async function diagnoseInstall(
  mcDir: MinecraftLocation,
  versionId: string
): Promise<{
  needsAssetIndex: boolean;
  assets: MissingAsset[];
  libraries: ResolvedLibrary[];
}> {
  const report = await diagnose(versionId, mcDir);
  return {
    needsAssetIndex: report.issues.some((issue) => issue.role === "assetIndex"),
    assets: report.issues.flatMap((issue) =>
      issue.role === "asset" ? [issue.asset] : []
    ),
    libraries: report.issues.flatMap((issue) =>
      issue.role === "library" ? [issue.library] : []
    ),
  };
}
