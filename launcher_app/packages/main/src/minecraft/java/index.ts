import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import {
  sendError,
  sendDownloadStatus,
} from "../../services/notifyService";
import { getUndiciAgent } from "../../utils/undiciAgent";
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
    console.log(`Downloading Java${javaVersion.majorVersion}...`);
    const dispatcher = getUndiciAgent();
    const manifest = await fetchJavaRuntimeManifest({
      target: javaVersion.component,
    });
    console.log("Manifest ready");
    const task = installJavaRuntimeTask({
      destination: basePath,
      manifest,
    });

    await task.startAndWait({
      onStart(t) {
        console.log(`Starting Java install: ${t.path}`);
      },
      onUpdate(t, chunk) {
        sendDownloadStatus(`${t.total}`, t.progress, true);
      },
      onFailed(t, err) {
        console.error(`Java install failed: ${t.path}`, err);
        sendDownloadStatus(`${t.total}`, t.progress, false);
      },
      onSucceed(t) {
        console.log(`Java installed: ${t.path}`);
        sendDownloadStatus(`${t.total}`, t.progress, false);
      },
    });

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
    sendError(`${e}`);
    throw e;
  }
}
