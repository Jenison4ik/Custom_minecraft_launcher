import { MinecraftLocation, ResolvedVersion, diagnose } from "@xmcl/core";
import { isErrorWithMessage } from "./types";

/**
 * Проверяет наличие и корректность всех библиотек для версии Minecraft
 * @param mcDir - Директория Minecraft
 * @param resolvedVersion - Разрешенная версия Minecraft
 * @returns Promise<void> если все библиотеки присутствуют и корректны
 * @throws Error если библиотеки отсутствуют или повреждены
 */
export default async function checkLibraryFiles(
  mcDir: MinecraftLocation,
  resolvedVersion: ResolvedVersion
): Promise<void> {
  try {
    // Проверяем библиотеки через diagnose
    const report = await diagnose(resolvedVersion.id, mcDir);

    // Фильтруем проблемы с библиотеками
    const libraryIssues = report.issues.filter(
      (issue) => issue.role === "library"
    );

    if (libraryIssues.length > 0) {
      const issuesList = libraryIssues
        .map((i) => {
          if ("file" in i && i.file) return i.file;
          return "библиотека отсутствует или повреждена";
        })
        .join(", ");
      throw new Error(`Обнаружены проблемы с библиотеками: ${issuesList}`);
    }

    console.log(
      `Libraries for version ${resolvedVersion.id} verified successfully`
    );
  } catch (error: unknown) {
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : String(error);
    throw new Error(
      `Ошибка проверки библиотек для версии ${resolvedVersion.id}: ${errorMessage}`
    );
  }
}
