import { MinecraftLocation, ResolvedVersion, diagnose } from "@xmcl/core";
import { isErrorWithMessage } from "./types";

/**
 * Checks that all libraries for a Minecraft version exist and are valid
 * @param mcDir - Minecraft directory
 * @param resolvedVersion - Resolved Minecraft version
 * @returns Promise<void> if all libraries are present and valid
 * @throws Error if libraries are missing or corrupted
 */
export default async function checkLibraryFiles(
  mcDir: MinecraftLocation,
  resolvedVersion: ResolvedVersion
): Promise<void> {
  try {
    // Diagnose libraries
    const report = await diagnose(resolvedVersion.id, mcDir);

    // Filter library issues
    const libraryIssues = report.issues.filter(
      (issue) => issue.role === "library"
    );

    if (libraryIssues.length > 0) {
      const issuesList = libraryIssues
        .map((i) => {
          if ("file" in i && i.file) return i.file;
          return "library missing or corrupted";
        })
        .join(", ");
      throw new Error(`Library issues detected: ${issuesList}`);
    }

    console.log(
      `Libraries for version ${resolvedVersion.id} verified successfully`
    );
  } catch (error: unknown) {
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : String(error);
    throw new Error(
      `Libraries check failed for version ${resolvedVersion.id}: ${errorMessage}`
    );
  }
}
