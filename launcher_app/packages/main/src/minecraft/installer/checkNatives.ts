import { MinecraftLocation, ResolvedVersion, diagnose } from "@xmcl/core";
import { isErrorWithMessage } from "./types";

/**
 * Checks native files for a Minecraft version
 * @param mcDir - Minecraft directory
 * @param resolvedVersion - Resolved Minecraft version
 * @returns Promise<void> if all native files are present and valid
 * @throws Error if native files are missing or corrupted
 */
export default async function checkNativeFiles(
  mcDir: MinecraftLocation,
  resolvedVersion: ResolvedVersion
): Promise<void> {
  try {
    // Diagnose native files
    const report = await diagnose(resolvedVersion.id, mcDir);

    // Filter native-related issues (usually part of libraries)
    // Native files may be part of libraries, so check via library issues
    const nativeIssues = report.issues.filter(
      (issue) =>
        issue.role === "library" &&
        ("file" in issue ? issue.file?.includes("natives") : false)
    );

    if (nativeIssues.length > 0) {
      const issuesList = nativeIssues
        .map((i) => {
          if ("file" in i && i.file) return i.file;
          return "native file missing or corrupted";
        })
        .join(", ");
      throw new Error(`Native file issues detected: ${issuesList}`);
    }

    console.log(
      `Native files for version ${resolvedVersion.id} verified successfully`
    );
  } catch (error: unknown) {
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : String(error);
    throw new Error(
      `Native files check failed for version ${resolvedVersion.id}: ${errorMessage}`
    );
  }
}
