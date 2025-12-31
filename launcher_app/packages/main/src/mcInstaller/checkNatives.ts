import { MinecraftLocation, ResolvedVersion, diagnose } from "@xmcl/core";
import { isErrorWithMessage } from "./types";

/**
 * Проверяет наличие и корректность нативных файлов для версии Minecraft
 * @param mcDir - Директория Minecraft
 * @param resolvedVersion - Разрешенная версия Minecraft
 * @returns Promise<void> если все нативные файлы присутствуют и корректны
 * @throws Error если нативные файлы отсутствуют или повреждены
 */
export default async function checkNativeFiles(
  mcDir: MinecraftLocation,
  resolvedVersion: ResolvedVersion
): Promise<void> {
  try {
    // Проверяем нативные файлы через diagnose
    const report = await diagnose(resolvedVersion.id, mcDir);

    // Фильтруем проблемы с нативными файлами (обычно это часть библиотек)
    // Нативные файлы могут быть частью библиотек, поэтому проверяем их через library issues
    const nativeIssues = report.issues.filter(
      (issue) =>
        issue.role === "library" &&
        ("file" in issue ? issue.file?.includes("natives") : false)
    );

    if (nativeIssues.length > 0) {
      const issuesList = nativeIssues
        .map((i) => {
          if ("file" in i && i.file) return i.file;
          return "нативный файл отсутствует или поврежден";
        })
        .join(", ");
      throw new Error(`Обнаружены проблемы с нативными файлами: ${issuesList}`);
    }

    console.log(
      `Native files for version ${resolvedVersion.id} verified successfully`
    );
  } catch (error: unknown) {
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : String(error);
    throw new Error(
      `Ошибка проверки нативных файлов для версии ${resolvedVersion.id}: ${errorMessage}`
    );
  }
}
