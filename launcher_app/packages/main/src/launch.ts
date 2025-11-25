import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { mcPath } from "./createLauncherDir";
import { app, BrowserWindow } from "electron";
import { ensureJava17 } from "./downloadJava";
import sendError from "./sendError";
import sendDownloadStatus from "./sendDownloadStatus";
import generateManifest from "./generateManifest";
import axios from "axios";
import deepEqual from "./deepEqual";
import addServer from "./addServer";
import getConfig from "./getConfigPath";
import downloadMinecraft from "./downloadMinecraft";
import launcherProperties, { McCore } from "./launcherProperties";
import Status from "./status";

type LaunchArgs = [versionID: string, nickname: string, ram: string];

type FileEntry = {
  sha1: string;
  size: number;
};

type FilesObject = {
  files: Record<string, FileEntry>;
};

export async function runMinecraft(params: LaunchArgs) {
  const window = BrowserWindow.getAllWindows()[0];
  window.webContents.send("launch-minecraft", true);
  Status.setStatus(true);

  try {
    addServer();
    sendDownloadStatus("Checking Java17", 10, true);

    // Параметры запуска
    const requestedVersionId = params[0]; // например "1.21.1-fabric"
    const NICKNAME = params[1];
    const JAVA_PATH = await ensureJava17();
    const RAM = params[2];
    // Пути
    const BASE_DIR = path.join(app.getPath("userData"), mcPath);
    const VERSION_ID = resolveVersionDirectory(BASE_DIR, requestedVersionId);
    const VERSION_DIR = path.join(BASE_DIR, "versions", VERSION_ID);
    const VERSION_JAR = path.join(VERSION_DIR, `${VERSION_ID}.jar`);
    const LIBRARIES_DIR = path.join(BASE_DIR, "libraries");
    const NATIVES_DIR = path.join(VERSION_DIR, "natives");
    const ASSETS_DIR = path.join(BASE_DIR, "assets");
    const versionJsonPath = path.join(VERSION_DIR, `${VERSION_ID}.json`);

    const configPath = getConfig();
    const selectedCore = resolveMcCore(launcherProperties.mcCore);

    const targetFile = path.join(BASE_DIR, "mods.zip"); //фикс бага
    if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
      fs.unlinkSync(targetFile);
      console.log("mods.zip deleted.");
    } else {
      console.log("mods.zip did not found");
    }

    // Проверка файлов
    const data = fs.readFileSync(configPath, "utf-8");
    const configs = JSON.parse(data);
    const disableDownload = configs.disableDownload ?? false;
    if (!disableDownload) {
      sendDownloadStatus("Проверяем файлы Minecraft", 20, true);
      const manifest = (await generateManifest(".minecraft").then((res) => {
        console.log(res);
        return res;
      })) as FilesObject;
      const server_manifest = (
        await axios.get(launcherProperties.url + "/manifest")
      ).data;
      const needDownload = await deepEqual(manifest, server_manifest);
      if (!needDownload) {
        process.stdout.write("\n\ndone\n\n");
        await downloadMinecraft();
      }
    }

    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, "utf-8"));
    const ASSETS_INDEX = versionJson.assets;

    if (!fs.existsSync(VERSION_JAR)) {
      throw new Error("Minecraft jar не найден: " + VERSION_JAR); //Вдруг скачалось не то
    }
    if (NICKNAME.length < 3 || NICKNAME.length > 16) {
      throw new Error("Никнейм должен содержать от 3 до 16 символов"); //Формат никнейма для майнкрафта
    }

    // Сборка classpath (все библиотеки + версия)
    function getClasspath(librariesDir: string, versionJar: string): string {
      const jars: string[] = [];

      function walk(d: string) {
        for (const file of fs.readdirSync(d)) {
          const full = path.join(d, file);
          if (fs.statSync(full).isDirectory()) walk(full);
          else if (file.endsWith(".jar")) jars.push(full);
        }
      }

      walk(librariesDir);
      jars.push(versionJar);
      return jars.join(path.delimiter);
    }

    sendDownloadStatus("Сборка classpath", 15, true);
    const classpath = getClasspath(LIBRARIES_DIR, VERSION_JAR);
    const launcherPlaceholders = buildPlaceholderMap({
      assetsDir: ASSETS_DIR,
      assetsIndex: ASSETS_INDEX,
      baseDir: BASE_DIR,
      classpath,
      nickname: NICKNAME,
      nativesDir: NATIVES_DIR,
      ram: RAM,
      versionId: VERSION_ID,
      versionType: selectedCore,
    });

    const versionArguments = (versionJson.arguments ?? {}) as VersionArguments;
    const versionJvmArgs = buildArgsFromArgumentEntries(
      versionArguments.jvm,
      launcherPlaceholders
    );
    const versionGameArgs = buildArgsFromArgumentEntries(
      versionArguments.game,
      launcherPlaceholders
    );

    const baseJvmArgs = [
      `-Xmx${RAM}M`,
      `-Djava.library.path=${NATIVES_DIR}`,
      "-cp",
      classpath,
    ];

    const baseGameArgs = [
      "--username",
      NICKNAME,
      "--version",
      VERSION_ID,
      "--gameDir",
      BASE_DIR,
      "--assetsDir",
      ASSETS_DIR,
      "--assetIndex",
      ASSETS_INDEX,
      "--accessToken",
      "0",
      "--userType",
      "legacy",
    ];

    let mainClass: string;
    let jvmArgsToUse: string[] = [];
    let gameArgsToUse: string[] = [];

    switch (selectedCore) {
      case "vanilla":
        mainClass = versionJson.mainClass ?? "net.minecraft.client.main.Main";
        jvmArgsToUse =
          versionJvmArgs.length > 0
            ? applyMemoryLimit(versionJvmArgs, RAM)
            : baseJvmArgs;
        gameArgsToUse =
          versionGameArgs.length > 0 ? versionGameArgs : baseGameArgs;
        break;
      case "forge":
        mainClass = versionJson.mainClass ?? "cpw.mods.modlauncher.Launcher";
        jvmArgsToUse =
          versionJvmArgs.length > 0
            ? applyMemoryLimit(versionJvmArgs, RAM)
            : baseJvmArgs;
        gameArgsToUse =
          versionGameArgs.length > 0 ? versionGameArgs : baseGameArgs;
        if (versionGameArgs.length === 0) {
          const forgeArgs = extractForgeArguments(
            versionArguments.game,
            launcherPlaceholders
          );
          const fallbackForgeArgs =
            forgeArgs.length > 0
              ? forgeArgs
              : ["--launchTarget", "forgeclient"];
          gameArgsToUse = mergeArgs(gameArgsToUse, fallbackForgeArgs);
        }
        break;
      default:
        mainClass = "net.fabricmc.loader.launch.knot.KnotClient";
        jvmArgsToUse = baseJvmArgs;
        gameArgsToUse = baseGameArgs;
        break;
    }

    const args = [...jvmArgsToUse, mainClass, ...gameArgsToUse];

    //Запуск майнкрафта
    sendDownloadStatus("Запуск JVM", 30, true);
    const mc = spawn(JAVA_PATH, args, { cwd: BASE_DIR });

    mc.stdout.on("data", (data: Buffer) => {
      const line = data.toString();
      if (line.includes("Setting user"))
        sendDownloadStatus("Инициализация сессии", 50, true);
      if (line.includes("LWJGL"))
        sendDownloadStatus("Загрузка графики", 80, true);
      if (line.includes("OpenAL initialized"))
        sendDownloadStatus("Minecraft запущен", 100, false);
      console.log(line); //Вывод логов в консоль
    });

    mc.stderr.on("data", (data: Buffer) => process.stderr.write(data));
    mc.on("exit", (code: number) => {
      console.log(`Minecraft завершен с кодом: ${code}`);
      sendDownloadStatus("Minecraft завершен", 0, false);
      window.webContents.send("launch-minecraft", false); //Отправка события в главное окно
      Status.setStatus(false); //Установка статуса в false
    });
  } catch (e) {
    sendError("Ошибка при запуске Minecraft, " + e);
    sendDownloadStatus("Ошибка при запуске Minecraft", 0, false);
    window.webContents.send("launch-minecraft", false); //Отправка события в главное окно
    Status.setStatus(false); //Установка статуса в false
  }
}

function resolveVersionDirectory(baseDir: string, fallbackId: string): string {
  const versionsRoot = path.join(baseDir, "versions");
  try {
    const entries = fs.readdirSync(versionsRoot, { withFileTypes: true });
    const firstDir = entries.find((entry) => entry.isDirectory());
    if (firstDir) {
      return firstDir.name;
    }
  } catch (err) {
    console.warn("Не удалось прочитать каталог versions:", err);
    sendError("Не удалось прочитать каталог versions:", "error");
  }
  return fallbackId;
}

type FeatureFlags = Record<string, boolean>;

interface PlaceholderParams {
  assetsDir: string;
  assetsIndex: string;
  baseDir: string;
  classpath: string;
  nickname: string;
  nativesDir: string;
  ram: string;
  versionId: string;
  versionType: McCore;
}

interface MinecraftRule {
  action: "allow" | "disallow";
  os?: { name?: string };
  features?: Record<string, boolean>;
}

type ArgumentEntry =
  | string
  | { value: string | string[]; rules?: MinecraftRule[] };

interface VersionArguments {
  game?: ArgumentEntry[];
  jvm?: ArgumentEntry[];
}

function resolveMcCore(core?: McCore): McCore {
  if (core === "forge" || core === "vanilla") {
    return core;
  }
  return "fabric";
}

function buildPlaceholderMap(
  params: PlaceholderParams
): Record<string, string> {
  const {
    assetsDir,
    assetsIndex,
    baseDir,
    classpath,
    nickname,
    nativesDir,
    ram,
    versionId,
    versionType,
  } = params;

  return {
    auth_access_token: "0",
    auth_player_name: nickname,
    auth_session: "0",
    auth_uuid: "0",
    auth_xuid: "0",
    assets_index_name: assetsIndex,
    assets_root: assetsDir,
    classpath,
    clientid: "0",
    game_assets: assetsDir,
    game_directory: baseDir,
    launcher_name: "CustomLauncher",
    launcher_version: app.getVersion(),
    natives_directory: nativesDir,
    quickPlayPath: "",
    quickPlaySingleplayer: "",
    quickPlayMultiplayer: "",
    quickPlayRealms: "",
    resolution_width: "854",
    resolution_height: "480",
    user_properties: "{}",
    user_type: "legacy",
    version_name: versionId,
    version_type: versionType,
    ram,
  };
}

function buildArgsFromArgumentEntries(
  entries: ArgumentEntry[] | undefined,
  placeholders: Record<string, string>
): string[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  const result: string[] = [];
  for (const entry of entries) {
    if (typeof entry === "string") {
      result.push(applyPlaceholders(entry, placeholders));
      continue;
    }
    if (!shouldIncludeArgument(entry.rules)) {
      continue;
    }
    const values = Array.isArray(entry.value) ? entry.value : [entry.value];
    for (const value of values) {
      result.push(applyPlaceholders(value, placeholders));
    }
  }
  return result.filter((value) => value !== "");
}

function shouldIncludeArgument(rules?: MinecraftRule[]): boolean {
  if (!Array.isArray(rules) || rules.length === 0) {
    return true;
  }

  const currentOs =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "osx"
        : "linux";

  const featureDefaults: FeatureFlags = {
    has_custom_resolution: false,
    has_quick_plays_support: false,
    is_demo_user: false,
  };

  let decision = false;
  for (const rule of rules) {
    let matches = true;
    if (rule.os?.name && rule.os.name !== currentOs) {
      matches = false;
    }
    if (matches && rule.features) {
      matches = Object.entries(rule.features).every(
        ([feature, expected]) => featureDefaults[feature] === expected
      );
    }
    if (matches) {
      decision = rule.action === "allow";
    }
  }

  return decision;
}

function applyPlaceholders(
  value: string,
  placeholders: Record<string, string>
): string {
  return value.replace(/\$\{(.+?)\}/g, (_, key) => placeholders[key] ?? "");
}

function applyMemoryLimit(args: string[], ramLimit: string): string[] {
  let hasMemoryArg = false;
  const updated = args.map((arg) => {
    if (arg.startsWith("-Xmx")) {
      hasMemoryArg = true;
      return `-Xmx${ramLimit}M`;
    }
    return arg;
  });
  if (!hasMemoryArg) {
    updated.unshift(`-Xmx${ramLimit}M`);
  }
  return updated;
}

function extractForgeArguments(
  entries: ArgumentEntry[] | undefined,
  placeholders: Record<string, string>
): string[] {
  if (!Array.isArray(entries)) {
    return [];
  }
  const targetKeys = new Set([
    "--launchTarget",
    "--fml.forgeVersion",
    "--fml.mcVersion",
    "--fml.mcpVersion",
    "--versionType",
  ]);
  const resolvedArgs = buildArgsFromArgumentEntries(entries, placeholders);
  const extras: string[] = [];
  for (let i = 0; i < resolvedArgs.length; i++) {
    const token = resolvedArgs[i];
    if (targetKeys.has(token)) {
      extras.push(token);
      if (i + 1 < resolvedArgs.length) {
        extras.push(resolvedArgs[i + 1]);
        i += 1;
      }
    }
  }
  return extras;
}

function mergeArgs(base: string[], extras: string[]): string[] {
  if (extras.length === 0) {
    return base;
  }
  const result = [...base];
  const existingKeys = new Set(base.filter((token) => token.startsWith("--")));

  for (let i = 0; i < extras.length; i++) {
    const token = extras[i];
    if (token.startsWith("--")) {
      if (existingKeys.has(token)) {
        if (i + 1 < extras.length && !extras[i + 1].startsWith("--")) {
          i += 1;
        }
        continue;
      }
      existingKeys.add(token);
      result.push(token);
      if (i + 1 < extras.length && !extras[i + 1].startsWith("--")) {
        result.push(extras[i + 1]);
        i += 1;
      }
    } else {
      result.push(token);
    }
  }

  return result;
}
