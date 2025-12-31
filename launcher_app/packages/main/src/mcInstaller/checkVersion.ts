import {
  MinecraftLocation,
  ResolvedVersion,
  Version,
  diagnose,
} from "@xmcl/core";
import { MinecraftVersion } from "@xmcl/installer";
import { isErrorWithMessage } from "./types";

/**
 * Проверяет наличие и корректность версии Minecraft
 * @param mcDir - Директория Minecraft
 * @param version - ID версии для проверки
 * @returns ResolvedVersion если версия существует и корректна
 * @throws Error если версия не найдена или повреждена
 */
export default async function checkVersionFiles(
  mcDir: MinecraftLocation,
  version: MinecraftVersion["id"]
): Promise<ResolvedVersion> {
  try {
    // Парсим версию
    const resolvedVersion: ResolvedVersion = await Version.parse(
      mcDir,
      version
    );

    // Проверяем версию через diagnose
    const report = await diagnose(resolvedVersion.id, mcDir);

    // Проверяем проблемы с версией (versionJson, minecraftJar)
    const versionIssues = report.issues.filter(
      (issue) => issue.role === "versionJson" || issue.role === "minecraftJar"
    );

    if (versionIssues.length > 0) {
      const issuesList = versionIssues
        .map((i) => {
          if ("file" in i && i.file) return i.file;
          return `${i.role}: проблема обнаружена`;
        })
        .join(", ");
      throw new Error(
        `Обнаружены проблемы с версией ${version}: ${issuesList}`
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
      errorMessage.includes("не найдена") ||
      errorMessage.includes("Version not found")
    ) {
      throw new Error(`Версия ${version} не найдена. Требуется установка.`);
    }
    throw new Error(`Ошибка проверки версии ${version}: ${errorMessage}`);
  }
}
