import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import { getDownloadDispatcher } from "../../utils/undiciAgent";
import { trackTask } from "../installer/trackTask";
import { readLaunchPrefs } from "../launchPrefs";
import {
  fetchJavaRuntimeManifest,
  installJavaRuntimeTask,
  resolveJava,
} from "@xmcl/installer";
import type { JavaVersion } from "@xmcl/core";

export async function ensureJava(javaVersion: JavaVersion): Promise<string> {
  try {
    const basePath = path.join(
      app.getPath("userData"),
      "java",
      `java${javaVersion.majorVersion}`
    );

    // Create directory if it does not exist
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }

    // Only look for Java inside the launcher folder
    const javaBinPath = path.join(
      basePath,
      "bin",
      process.platform === "win32" ? "java.exe" : "java"
    );

    if (fs.existsSync(javaBinPath)) {
      const javaInfo = await resolveJava(javaBinPath);
      if (javaInfo && javaInfo.majorVersion === javaVersion.majorVersion) {
        console.log(`✔️ Java found in launcher: ${javaInfo.version}`);
        return javaBinPath;
      }
    }

    // Download and install Java
    const title = `Загрузка Java ${javaVersion.majorVersion}`;
    console.log(title);
    const dispatcher = getDownloadDispatcher();
    const manifest = await fetchJavaRuntimeManifest({
      target: javaVersion.component,
      dispatcher,
    });
    await trackTask(
      installJavaRuntimeTask({
        destination: basePath,
        manifest,
        dispatcher,
      }),
      title
    );

    // Verify path after installation
    const installedJavaInfo = await resolveJava(javaBinPath);
    if (
      installedJavaInfo &&
      installedJavaInfo.majorVersion === javaVersion.majorVersion
    ) {
      console.log(`✔️ Java installed successfully: ${installedJavaInfo.version}`);
      return javaBinPath;
    }

    throw new Error("Java was installed but could not be found afterwards.");
  } catch (e) {
    console.error("Error in ensureJava:", e);
    throw e;
  }
}

/**
 * Uses a user-selected Java binary when config.javaPath is set and the
 * major version matches. Otherwise downloads the runtime the game asks for.
 */
export async function resolveLaunchJava(
  required: JavaVersion
): Promise<string> {
  const { javaPath } = readLaunchPrefs();
  if (!javaPath) return ensureJava(required);

  if (!fs.existsSync(javaPath)) {
    throw new Error(`Выбранная Java не найдена: ${javaPath}`);
  }

  const info = await resolveJava(javaPath);
  if (!info || info.majorVersion !== required.majorVersion) {
    const found = info ? String(info.majorVersion) : "неизвестна";
    throw new Error(
      `Нужна Java ${required.majorVersion}, выбрана Java ${found}`
    );
  }

  return javaPath;
}
