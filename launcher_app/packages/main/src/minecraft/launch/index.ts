import { createHash } from "crypto";
import { app } from "electron";
import fs from "fs/promises";
import path from "path";
import { DEFAULT_EXTRA_JVM_ARGS, LaunchPrecheck, Version, launch } from "@xmcl/core";
import { ChildProcess, spawn } from "child_process";
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
import { loadLaunchContext } from "../loadLaunchContext";
import { syncModFiles } from "../syncMods";
import addServer from "../../utils/addServer";
import {
  findVersionId,
  listInstalledVersionIds,
  tryParseVersion,
} from "../installer/versionLookup";
import type { GameSpec } from "../../types/LauncherConfig";
import type { JavaVersion } from "@xmcl/core";

let gameProcess: ChildProcess | null = null;

function processIsAlive(proc: ChildProcess | null): proc is ChildProcess {
  return proc != null && proc.exitCode == null && proc.signalCode == null;
}

export function canStopMinecraft(): boolean {
  return processIsAlive(gameProcess);
}

export function stopMinecraft(): boolean {
  const proc = gameProcess;
  if (!processIsAlive(proc) || proc.pid == null) return false;

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
      windowsHide: true,
    });
    killer.on("error", () => {
      proc.kill();
    });
  } else {
    proc.kill("SIGTERM");
  }
  return true;
}

const DEFAULT_JAVA: JavaVersion = {
  majorVersion: 8,
  component: "jre-legacy",
};

/** Same algorithm as Java `UUID.nameUUIDFromBytes("OfflinePlayer:" + name)`. */
function offlinePlayerId(name: string): string {
  const hash = createHash("md5").update(`OfflinePlayer:${name}`, "utf8").digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function cleanupOnError(errorMessage: string): void {
  sendError(errorMessage);
  sendPhase("Error launching Minecraft", false);
  sendLaunchStatus(false);
  Status.end();
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
    if (gameProcess === proc) gameProcess = null;
    showMainWindow();
    cleanupOnError("Error launching Minecraft: " + error.message);
  });

  proc.on("exit", (code: number | null, signal: string | null) => {
    console.log(`Minecraft ended with code: ${code}, signal: ${signal}`);
    if (gameProcess === proc) gameProcess = null;
    showMainWindow();
    sendPhase("Minecraft exited", false);
    sendLaunchStatus(false);
    Status.end();
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
  if (!Status.tryBegin()) return;
  sendLaunchStatus(true);

  try {
    const provided = spec !== undefined;
    const context = provided
      ? { spec, online: !spec.disableDownload, servers: [] }
      : await loadLaunchContext();
    const gameSpec = context.spec;
    const BASE_DIR = path.join(app.getPath("userData"), mcPath);
    await fs.mkdir(BASE_DIR, { recursive: true });
    if (!provided) {
      await addServer(context.servers);
    }
    let versionId: string;
    const skipNetwork = !context.online || gameSpec.disableDownload;

    if (!skipNetwork) {
      try {
        versionId = await mcInstall(gameSpec);
        await syncModFiles(BASE_DIR);
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
          gameSpec.disableDownload
            ? "Game is not installed and file checks are disabled (disableDownload)."
            : "Сборка не установлена, а сервер недоступен"
        );
      }
      versionId = existing;
    }

    const resolvedVersion = await Version.parse(BASE_DIR, versionId);
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

    const proc: ChildProcess = await launch({
      gamePath: BASE_DIR,
      javaPath: javaPath,
      version: versionId,
      prechecks: [LaunchPrecheck.checkVersion, LaunchPrecheck.checkNatives],
      gameProfile: {
        name: gameSpec.nickname || "Player",
        id: offlinePlayerId(gameSpec.nickname || "Player"),
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

    gameProcess = proc;
    setupProcessHandlers(proc);
    sendLaunchStatus(true, true);

    if (prefs.closeOnLaunch) {
      hideMainWindow();
    }
  } catch (e) {
    console.error("Launch error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    cleanupOnError("Error launching Minecraft: " + errorMessage);
  }
}
