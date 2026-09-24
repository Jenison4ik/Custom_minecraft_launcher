import { MinecraftLocation, ResolvedVersion, Version } from "@xmcl/core";
import { app } from "electron";
import path from "path";
import { mcPath } from "../../services/paths";
import { MinecraftVersion } from "@xmcl/installer";
import checkNativeFiles from "./checkNatives";
import { diagnoseInstall, isVanillaReady } from "./diagnoseInstall";
import { isErrorWithMessage } from "./types";

export interface CheckFilesResult {
  isValid: boolean;
  missingComponents: string[];
  resolvedVersion?: ResolvedVersion;
}

/**
 * One diagnosis of the installed version: client, libraries, assets, natives.
 */
export default async function checkFiles(
  version: MinecraftVersion["id"]
): Promise<CheckFilesResult> {
  const mcDir: MinecraftLocation = path.join(app.getPath("userData"), mcPath);
  const missingComponents: string[] = [];

  const ready = await isVanillaReady(mcDir, version);
  if (!ready) missingComponents.push("version");

  let resolvedVersion: ResolvedVersion | undefined;
  if (ready) {
    resolvedVersion = await Version.parse(mcDir, version);
    const report = await diagnoseInstall(mcDir, version);
    if (report.needsAssetIndex || report.assets.length > 0) {
      missingComponents.push("assets");
    }
    if (report.libraries.length > 0) missingComponents.push("libraries");

    try {
      await checkNativeFiles(mcDir, resolvedVersion);
    } catch (error: unknown) {
      const errorMessage = isErrorWithMessage(error)
        ? error.message
        : String(error);
      console.error("Native files check error:", errorMessage);
      missingComponents.push("natives");
    }
  }

  return {
    isValid: missingComponents.length === 0,
    missingComponents,
    resolvedVersion,
  };
}
