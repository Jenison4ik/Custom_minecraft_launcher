import { MinecraftLocation, ResolvedVersion } from "@xmcl/core";
import { app } from "electron";
import path from "path";
import { mcPath } from "../../services/paths";
import { MinecraftVersion } from "@xmcl/installer";
import checkVersionFiles from "./checkVersion";
import checkLibraryFiles from "./checkLibraries";
import checkNativeFiles from "./checkNatives";
import checkAssetFiles from "./checkAssets";
import { isErrorWithMessage } from "./types";

export interface CheckFilesResult {
  isValid: boolean;
  missingComponents: string[];
  resolvedVersion?: ResolvedVersion;
}

/**
 * Checks all Minecraft files before download
 * Verifies version, libraries, native files, and assets
 * @param version - Minecraft version ID to check
 * @returns CheckFilesResult with check results
 */
export default async function checkFiles(
  version: MinecraftVersion["id"]
): Promise<CheckFilesResult> {
  const mcDir: MinecraftLocation = path.join(app.getPath("userData"), mcPath);
  const missingComponents: string[] = [];
  let resolvedVersion: ResolvedVersion | undefined;

  try {
    // 1. Version check
    console.log(`Checking version ${version}...`);
    resolvedVersion = await checkVersionFiles(mcDir, version);
    console.log("✓ Version verified");
  } catch (error: unknown) {
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : String(error);
    console.error("✗ Version check error:", errorMessage);
    missingComponents.push("version");
    return {
      isValid: false,
      missingComponents,
    };
  }

  if (!resolvedVersion) {
    return {
      isValid: false,
      missingComponents: ["version"],
    };
  }

  // 2. Libraries check
  try {
    console.log("Checking libraries...");
    await checkLibraryFiles(mcDir, resolvedVersion);
    console.log("✓ Libraries verified");
  } catch (error: unknown) {
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : String(error);
    console.error("✗ Libraries check error:", errorMessage);
    missingComponents.push("libraries");
  }

  // 3. Native files check
  try {
    console.log("Checking native files...");
    await checkNativeFiles(mcDir, resolvedVersion);
    console.log("✓ Native files verified");
  } catch (error: unknown) {
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : String(error);
    console.error("✗ Native files check error:", errorMessage);
    missingComponents.push("natives");
  }

  // 4. Assets check
  try {
    console.log("Checking assets...");
    await checkAssetFiles(mcDir, resolvedVersion);
    console.log("✓ Assets verified");
  } catch (error: unknown) {
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : String(error);
    console.error("✗ Assets check error:", errorMessage);
    missingComponents.push("assets");
  }

  const isValid = missingComponents.length === 0;

  if (isValid) {
    console.log(`All files for version ${version} verified successfully!`);
  } else {
    console.log(`Missing components detected: ${missingComponents.join(", ")}`);
  }

  return {
    isValid,
    missingComponents,
    resolvedVersion,
  };
}
