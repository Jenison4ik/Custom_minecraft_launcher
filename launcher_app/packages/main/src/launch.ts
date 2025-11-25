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
    const requestedVersionId = params[0]; // например "1.21.1-fabric" или "1.20.1-forge-xx"
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
    let selectedCore = resolveMcCore(launcherProperties.mcCore);

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

    if (!fs.existsSync(versionJsonPath)) {
      throw new Error("version.json не найден: " + versionJsonPath);
    }
    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, "utf-8"));
    const ASSETS_INDEX = versionJson.assets;

    if (!fs.existsSync(VERSION_JAR)) {
      throw new Error("Minecraft jar не найден: " + VERSION_JAR); //Вдруг скачалось не то
    }
    if (NICKNAME.length < 3 || NICKNAME.length > 16) {
      throw new Error("Никнейм должен содержать от 3 до 16 символов"); //Формат никнейма для майнкрафта
    }

    // Если launcherProperties.mcCore не явный (например 'fabric' по умолчанию),
    // попытаемся определить ядро по JSON версии
    const autoDetected = detectCoreFromJson(versionJson);
    if (autoDetected) {
      // разрешаем автоопределение ядра — если обнаружен forge/vanilla/fabric
      selectedCore = autoDetected;
    }
    console.log("Selected core:", selectedCore);

    // Сборка classpath (разные подходы для Forge и для других)
    function getClasspath(librariesDir: string, versionJar: string): string {
      const jars: string[] = [];

      function walk(d: string) {
        if (!fs.existsSync(d)) return;
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

    function getForgeClasspath(versionJsonInner: any, baseDir: string): string {
      const jars: string[] = [];

      if (Array.isArray(versionJsonInner.libraries)) {
        for (const lib of versionJsonInner.libraries) {
          // учитываем только те библиотеки, у которых задан downloads.artifact.path
          try {
            const artifact = lib?.downloads?.artifact?.path;
            if (!artifact) continue;
            const full = path.join(baseDir, "libraries", artifact);
            if (fs.existsSync(full)) {
              jars.push(full);
            } else {
              // на всякий случай: если нет по path, попробуем собрать из name (maven coords)
              if (lib.name) {
                const alt = mavenPathFromName(lib.name);
                const altFull = path.join(baseDir, "libraries", alt);
                if (fs.existsSync(altFull)) jars.push(altFull);
              }
            }
          } catch (err) {
            // просто пропускаем некорректные записи
            continue;
          }
        }
      }

      // Добавляем version jar в конец (как у тебя было)
      const vjar = path.join(
        baseDir,
        "versions",
        versionJsonInner.id,
        `${versionJsonInner.id}.jar`
      );
      if (fs.existsSync(vjar)) {
        jars.push(vjar);
      }

      return jars.join(path.delimiter);
    }

    // Вспомогательное: собрать maven-путь из group:artifact:version
    function mavenPathFromName(name: string): string {
      // group:artifact:version[:classifier@ext]
      // примеры: com.mojang:patchy:1.1
      const parts = name.split(":");
      if (parts.length < 3) return name;
      const group = parts[0];
      const artifact = parts[1];
      const version = parts[2];
      let classifierExt = "";
      if (parts.length >= 4) {
        classifierExt = parts[3]; // classifier или classifier@ext
      }
      const groupPath = group.replace(/\./g, "/");
      let filename = `${artifact}-${version}`;
      if (classifierExt) {
        // если classifierExt содержит '@', то часть после '@' — расширение
        if (classifierExt.includes("@")) {
          const [classifier, ext] = classifierExt.split("@");
          if (classifier) filename += `-${classifier}`;
          filename += `.${ext || "jar"}`;
        } else {
          filename += `-${classifierExt}.jar`;
        }
      } else {
        filename += ".jar";
      }
      return path.join(groupPath, artifact, version, filename);
    }

    sendDownloadStatus("Сборка classpath", 15, true);

    // Выбираем classpath в зависимости от ядра
    const classpath =
      selectedCore === "forge"
        ? getForgeClasspath(versionJson, BASE_DIR)
        : getClasspath(LIBRARIES_DIR, VERSION_JAR);

    // Теперь строим placeholder map (Classpath нужен внутри)
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
        // Для forge используем mainClass из json или стандартный модлаунчер
        mainClass = versionJson.mainClass ?? "cpw.mods.modlauncher.Launcher";

        // JVM аргументы: используются либо из JSON, либо базовые
        jvmArgsToUse =
          versionJvmArgs.length > 0
            ? applyMemoryLimit(versionJvmArgs, RAM)
            : baseJvmArgs;

        // Игровые аргументы: либо из JSON, либо базовые + фордж-специфичные
        if (versionGameArgs.length > 0) {
          gameArgsToUse = versionGameArgs;
        } else {
          // пытаемся извлечь специфичные args для forge
          const forgeArgs = extractForgeArguments(
            versionArguments.game,
            launcherPlaceholders
          );
          const fallbackForgeArgs =
            forgeArgs.length > 0
              ? forgeArgs
              : ["--launchTarget", "forgeclient"];
          gameArgsToUse = mergeArgs(baseGameArgs, fallbackForgeArgs);
        }

        break;

      default: // fabric (или другое)
        mainClass =
          versionJson.mainClass ?? "net.fabricmc.loader.launch.knot.KnotClient";
        jvmArgsToUse =
          versionJvmArgs.length > 0
            ? applyMemoryLimit(versionJvmArgs, RAM)
            : baseJvmArgs;
        gameArgsToUse =
          versionGameArgs.length > 0 ? versionGameArgs : baseGameArgs;
        break;
    }

    // Собираем итоговый массив аргументов
    // Для JVM: уже содержится "-cp", classpath внутри baseJvmArgs или versionJvmArgs
    // Поэтому просто собираем jvmArgs + mainClass + gameArgs
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
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.send("launch-minecraft", false);
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

/**
 * Попытка определить ядро по содержимому version.json
 * Возвращает "forge" | "fabric" | "vanilla"
 */
function detectCoreFromJson(versionJson: any): McCore | undefined {
  try {
    const main = (versionJson.mainClass || "").toString().toLowerCase();
    const id = (versionJson.id || "").toString().toLowerCase();

    if (
      main.includes("modlauncher") ||
      main.includes("fml") ||
      id.includes("forge")
    ) {
      return "forge";
    }
    if (
      main.includes("knot") ||
      main.includes("fabric") ||
      id.includes("fabric")
    ) {
      return "fabric";
    }
    // fallback: если есть флаги fml в arguments.game
    const gameArgs = versionJson.arguments?.game;
    if (Array.isArray(gameArgs)) {
      for (const item of gameArgs) {
        if (
          typeof item === "string" &&
          item.includes("--launchTarget") &&
          item.includes("forge")
        ) {
          return "forge";
        }
      }
    }
    // иначе считаем vanilla
    return "vanilla";
  } catch (err) {
    return undefined;
  }
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
      const resolved = applyPlaceholders(entry, placeholders);
      if (resolved) {
        result.push(resolved);
      }
      continue;
    }
    if (!shouldIncludeArgument(entry.rules)) {
      continue;
    }
    const values = Array.isArray(entry.value) ? entry.value : [entry.value];
    for (const value of values) {
      const resolved = applyPlaceholders(value, placeholders);
      if (resolved) {
        result.push(resolved);
      }
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
  value: string | undefined,
  placeholders: Record<string, string>
): string {
  if (!value) {
    return "";
  }
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
    "--fml.forgeGroup",
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
