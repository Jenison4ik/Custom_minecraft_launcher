import { app } from "electron";
import path from "path";
import { Version, launch } from "@xmcl/core";
import { ChildProcess } from "child_process";
import { mcPath } from "../../services/paths";
import { ensureJava } from "../java";
import {
  sendError,
  sendDownloadStatus,
  sendLaunchStatus,
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

const PROGRESS_CHECK_JAVA = 10;
const PROGRESS_PARSE_VERSION = 20;
const PROGRESS_LAUNCH = 30;
const PROGRESS_INIT_SESSION = 50;
const PROGRESS_FORGE = 60;
const PROGRESS_LOAD_GRAPHICS = 80;
const PROGRESS_COMPLETE = 100;

const DEFAULT_JAVA: JavaVersion = {
  majorVersion: 8,
  component: "jre-legacy",
};

function cleanupOnError(errorMessage: string): void {
  sendError(errorMessage);
  sendDownloadStatus("Error launching Minecraft", 0, false);
  sendLaunchStatus(false);
  Status.setStatus(false);
}

function setupProcessHandlers(proc: ChildProcess): void {
  proc.stdout?.on("data", (data: Buffer) => {
    const line = data.toString();
    console.log("[MC]", line);

    if (line.includes("Setting user")) {
      sendDownloadStatus("Initializing session", PROGRESS_INIT_SESSION, true);
    }
    if (line.includes("LWJGL") || line.includes("OpenGL")) {
      sendDownloadStatus("Loading graphics", PROGRESS_LOAD_GRAPHICS, true);
    }
    if (
      line.includes("OpenAL initialized") ||
      line.includes("Sound engine started") ||
      line.includes("Successfully loaded")
    ) {
      sendDownloadStatus("Minecraft launched", PROGRESS_COMPLETE, false);
    }
  });

  proc.stderr?.on("data", (data: Buffer) => {
    const line = data.toString();
    console.error("[MC ERROR]", line);

    if (
      line.includes("Launching wrapped minecraft") ||
      line.includes("ModLauncher running")
    ) {
      sendDownloadStatus("Starting Forge", PROGRESS_FORGE, true);
    }
  });

  proc.on("error", (error: Error) => {
    cleanupOnError("Error launching Minecraft: " + error.message);
  });

  proc.on("exit", (code: number | null, signal: string | null) => {
    console.log(`Minecraft ended with code: ${code}, signal: ${signal}`);
    sendDownloadStatus("Minecraft exited", 0, false);
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

    sendDownloadStatus(
      "Parsing Minecraft version",
      PROGRESS_PARSE_VERSION,
      true
    );
    const resolvedVersion = await Version.parse(BASE_DIR, versionId);

    sendDownloadStatus("Checking Java", PROGRESS_CHECK_JAVA, true);
    const javaPath = await ensureJava(
      resolvedVersion.javaVersion ?? DEFAULT_JAVA
    );

    console.log("Resolved Version:", resolvedVersion.id);
    console.log("Base Dir:", BASE_DIR);
    console.log("Java Path:", javaPath);
    console.log("Version ID:", versionId);

    sendDownloadStatus("Launching Minecraft", PROGRESS_LAUNCH, true);
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
    });

    setupProcessHandlers(proc);
  } catch (e) {
    console.error("Launch error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    cleanupOnError("Error launching Minecraft: " + errorMessage);
  }
}
