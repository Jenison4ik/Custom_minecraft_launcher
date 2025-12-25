import { MinecraftLocation, ResolvedVersion, diagnose } from "@xmcl/core";
import { isErrorWithMessage } from "./types";

/**
 * Проверяет ассеты для версии Minecraft
 * @param mcDir - Директория Minecraft
 * @param resolvedVersion - Разрешенная версия Minecraft
 * @returns Promise<void> если все ассеты присутствуют и корректны
 * @throws Error если ассеты отсутствуют или повреждены
 */
export default async function checkAssetFiles(
  mcDir: MinecraftLocation,
  resolvedVersion: ResolvedVersion
): Promise<void> {
  try {
    // Проверяем ассеты через diagnose
    const report = await diagnose(resolvedVersion.id, mcDir);

    // Фильтруем проблемы с ассетами
    const assetIssues = report.issues.filter(
      (issue) => issue.role === "asset" || issue.role === "assetIndex"
    );

    if (assetIssues.length > 0) {
      const issuesList = assetIssues
        .map((i) => {
          if ("file" in i && i.file) return i.file;
          return "ассет отсутствует или поврежден";
        })
        .join(", ");
      throw new Error(`Обнаружены проблемы с ассетами: ${issuesList}`);
    }

    console.log(
      `Assets for version ${resolvedVersion.id} verified successfully`
    );
  } catch (error: unknown) {
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : String(error);
    throw new Error(
      `Ошибка проверки ассетов для версии ${resolvedVersion.id}: ${errorMessage}`
    );
  }
}
