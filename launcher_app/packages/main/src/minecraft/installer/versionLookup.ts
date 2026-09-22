import fs from "fs";
import path from "path";
import { Version } from "@xmcl/core";

export function listInstalledVersionIds(mcDir: string): string[] {
  const versionsDir = path.join(mcDir, "versions");
  if (!fs.existsSync(versionsDir)) {
    return [];
  }
  return fs
    .readdirSync(versionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((id) => fs.existsSync(path.join(versionsDir, id, `${id}.json`)));
}

export async function tryParseVersion(mcDir: string, versionId: string) {
  try {
    return await Version.parse(mcDir, versionId);
  } catch {
    return null;
  }
}

export function findVersionId(
  installed: string[],
  predicates: Array<(id: string) => boolean>
): string | undefined {
  for (const pred of predicates) {
    const found = installed.find(pred);
    if (found) return found;
  }
  return undefined;
}
