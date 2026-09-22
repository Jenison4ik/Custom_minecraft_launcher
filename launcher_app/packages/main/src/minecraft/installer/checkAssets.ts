import { MinecraftLocation, ResolvedVersion, diagnose } from "@xmcl/core";
import { isErrorWithMessage } from "./types";

/**
 * Checks assets for a Minecraft version
 * @param mcDir - Minecraft directory
 * @param resolvedVersion - Resolved Minecraft version
 * @returns Promise<void> if all assets are present and valid
 * @throws Error if assets are missing or corrupted
 */
export default async function checkAssetFiles(
  mcDir: MinecraftLocation,
  resolvedVersion: ResolvedVersion
): Promise<void> {
  try {
    // Diagnose assets
    const report = await diagnose(resolvedVersion.id, mcDir);

    // Filter asset issues
    const assetIssues = report.issues.filter(
      (issue) => issue.role === "asset" || issue.role === "assetIndex"
    );

    if (assetIssues.length > 0) {
      const issuesList = assetIssues
        .map((i) => {
          if ("file" in i && i.file) return i.file;
          return "asset missing or corrupted";
        })
        .join(", ");
      throw new Error(`Asset issues detected: ${issuesList}`);
    }

    console.log(
      `Assets for version ${resolvedVersion.id} verified successfully`
    );
  } catch (error: unknown) {
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : String(error);
    throw new Error(
      `Assets check failed for version ${resolvedVersion.id}: ${errorMessage}`
    );
  }
}
