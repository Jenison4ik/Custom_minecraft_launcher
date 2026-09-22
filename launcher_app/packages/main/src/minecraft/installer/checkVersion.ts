import {
  MinecraftLocation,
  ResolvedVersion,
  Version,
  diagnose,
} from "@xmcl/core";
import { MinecraftVersion } from "@xmcl/installer";
import { isErrorWithMessage } from "./types";

/**
 * Checks that the Minecraft version exists and is valid
 * @param mcDir - Minecraft directory
 * @param version - Version ID to check
 * @returns ResolvedVersion if the version exists and is valid
 * @throws Error if the version is missing or corrupted
 */
export default async function checkVersionFiles(
  mcDir: MinecraftLocation,
  version: MinecraftVersion["id"]
): Promise<ResolvedVersion> {
  try {
    // Parse version
    const resolvedVersion: ResolvedVersion = await Version.parse(
      mcDir,
      version
    );

    // Diagnose version
    const report = await diagnose(resolvedVersion.id, mcDir);

    // Check version issues (versionJson, minecraftJar)
    const versionIssues = report.issues.filter(
      (issue) => issue.role === "versionJson" || issue.role === "minecraftJar"
    );

    if (versionIssues.length > 0) {
      const issuesList = versionIssues
        .map((i) => {
          if ("file" in i && i.file) return i.file;
          return `${i.role}: issue detected`;
        })
        .join(", ");
      throw new Error(
        `Version issues detected for ${version}: ${issuesList}`
      );
    }

    console.log(`Version ${version} verified successfully`);
    return resolvedVersion;
  } catch (error: unknown) {
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : String(error);
    if (
      errorMessage.includes("not found") ||
      errorMessage.includes("Version not found")
    ) {
      throw new Error(`Version ${version} not found. Installation required.`);
    }
    throw new Error(`Version check failed for ${version}: ${errorMessage}`);
  }
}
