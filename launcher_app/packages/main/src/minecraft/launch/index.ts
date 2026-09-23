import { app } from "electron";
import path from "path";
import { DEFAULT_EXTRA_JVM_ARGS, Version, launch } from "@xmcl/core";
import { ChildProcess } from "child_process";
import { mcPath } from "../../services/paths";
import { resolveLaunchJava } from "../java";
import { readLaunchPrefs } from "../launchPrefs";
import { applyGameWindowOptions } from "./gameWindowOptions";
import { hideMainWindow, showMainWindow } from "../../window/createWindow";
import {
  sendError,
  sendLaunchStatus,
  sendPhase,
} from "../../services/notifyService";
import Status from "../../services/statusService";
import mcInstall from "../installer";
import resolveGameSpec from "../resolveGameSpec";
import {
  findVersionId,
  listInstalledVersionIds,
  tryParseVersion,
} from "../installer/versionLookup";
import type { GameSpec } from "../../types/LauncherConfig";
import type { JavaVersion } from "@xmcl/core";

const DEFAULT_JAVA: JavaVersion = {
  majorVersion: 8,
  component: "jre-legacy",
};

function cleanupOnError(errorMessage: string): void {
  sendError(errorMessage);
  sendPhase("Error launching Minecraft", false);
  sendLaunchStatus(false);
  Status.setStatus(false);
}

function setupProcessHandlers(proc: ChildProcess): void {
  proc.stdout?.on("data", (data: Buffer) => {
    const line = data.toString();
    console.log("[MC]", line);

    if (line.includes("Setting user")) {
      sendPhase("Initializing session");
    }
    if (line.includes("LWJGL") || line.includes("OpenGL")) {
      sendPhase("Loading graphics");
    }
    if (
      line.includes("OpenAL initialized") ||
      line.includes("Sound engine started") ||
      line.includes("Successfully loaded")
    ) {
      sendPhase("Minecraft launched", false);
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const line = data.toString();
    console.error("[MC ERROR]", line);

    if (
      line.includes("Launching wrapped minecraft") ||
      line.includes("ModLauncher running")
    ) {
      sendPhase("Starting Forge");
    }
  });

  proc.on("error", (error: Error) => {
    showMainWindow();
    cleanupOnError("Error launching Minecraft: " + error.message);
  });

  proc.on("exit", (code: number | null, signal: string | null) => {
    console.log(`Minecraft ended with code: ${code}, signal: ${signal}`);
    showMainWindow();
    sendPhase("Minecraft exited", false);
    sendLaunchStatus(false);
    Status.setStatus(false);
  });
}

async function findExistingLaunchId(
  mcDir: string,
  spec: GameSpec
): Promise<string | null> {
  const installed = listInstalledVersionIds(mcDir);

  if (spec.loader === "vanilla") {
    const parsed = await tryParseVersion(mcDir, spec.mcVersion);
    return parsed ? spec.mcVersion : null;
  }

  const loaderKey = spec.loader === "neoforge" ? "neoforge" : spec.loader;
  const candidates = findVersionId(installed, [
    (id) =>
      id.toLowerCase().includes(loaderKey) &&
      id.includes(spec.mcVersion) &&
      (!spec.loaderVersion || id.includes(spec.loaderVersion)),
    (id) =>
      id.toLowerCase().includes(loaderKey) && id.includes(spec.mcVersion),
  ]);

  if (!candidates) return null;
  const parsed = await tryParseVersion(mcDir, candidates);
  return parsed ? candidates : null;
}

export default async function mcLaunch(spec?: GameSpec) {
  const gameSpec = spec ?? resolveGameSpec();
  sendLaunchStatus(true);
  Status.setStatus(true);

  try {
    const BASE_DIR = path.join(app.getPath("userData"), mcPath);
    let versionId: string;

    if (!gameSpec.disableDownload) {
      try {
        versionId = await mcInstall(gameSpec);
      } catch (installError) {
        const errorMessage =
          installError instanceof Error
            ? installError.message
            : String(installError);
        throw new Error(`Minecraft installation error: ${errorMessage}`);
      }
    } else {
      const existing = await findExistingLaunchId(BASE_DIR, gameSpec);
      if (!existing) {
        throw new Error(
          "Game is not installed and file checks are disabled (disableDownload)."
        );
      }
      versionId = existing;
    }

    sendPhase("Parsing Minecraft version");
    const resolvedVersion = await Version.parse(BASE_DIR, versionId);

    sendPhase("Checking Java");
    const prefs = readLaunchPrefs();
    const javaPath = await resolveLaunchJava(
      resolvedVersion.javaVersion ?? DEFAULT_JAVA
    );

    console.log("Resolved Version:", resolvedVersion.id);
    console.log("Base Dir:", BASE_DIR);
    console.log("Java Path:", javaPath);
    console.log("Version ID:", versionId);

    applyGameWindowOptions(BASE_DIR, {
      width: prefs.windowWidth,
      height: prefs.windowHeight,
      fullscreen: prefs.fullscreen,
    });

    sendPhase("Launching Minecraft");
    const proc: ChildProcess = await launch({
      gamePath: BASE_DIR,
      javaPath: javaPath,
      version: versionId,
      gameProfile: {
        name: gameSpec.nickname || "Player",
        id: "offline-id",
      },
      minMemory: Math.min(512, gameSpec.ram),
      maxMemory: gameSpec.ram,
      resolution: {
        width: prefs.windowWidth,
        height: prefs.windowHeight,
        fullscreen: prefs.fullscreen,
      },
      ...(prefs.jvmArgs.length > 0
        ? { extraJVMArgs: [...DEFAULT_EXTRA_JVM_ARGS, ...prefs.jvmArgs] }
        : {}),
    });

    setupProcessHandlers(proc);

    if (prefs.closeOnLaunch) {
      hideMainWindow();
    }
  } catch (e) {
    console.error("Launch error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    cleanupOnError("Error launching Minecraft: " + errorMessage);
  }
}
