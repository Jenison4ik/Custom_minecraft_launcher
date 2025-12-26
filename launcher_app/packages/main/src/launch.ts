// import { spawn } from "child_process";
// import * as path from "path";
// import * as fs from "fs";
// import { mcPath } from "./createLauncherDir";
// import { app, BrowserWindow } from "electron";
// import { ensureJava21 } from "./downloadJava";
// import sendError from "./sendError";
// import sendDownloadStatus from "./sendDownloadStatus";
// import generateManifest from "./generateManifest";
// import axios from "axios";
// import deepEqual from "./deepEqual";
// import addServer from "./addServer";
// import getConfig from "./getConfigPath";
// import downloadMinecraft from "./downloadMinecraft";
// import launcherProperties, { McCore } from "./launcherProperties";
// import Status from "./status";

// type LaunchArgs = [versionID: string, nickname: string, ram: string];

// type FileEntry = {
//   sha1: string;
//   size: number;
// };

// type FilesObject = {
//   files: Record<string, FileEntry>;
// };

// export async function runMinecraft(params: LaunchArgs) {
//   const windows = BrowserWindow.getAllWindows();
//   if (windows.length === 0) {
//     sendError("Окно приложения не найдено");
//     return;
//   }
//   const window = windows[0];
//   window.webContents.send("launch-minecraft", true);
//   Status.setStatus(true);

//   try {
//     addServer();
//     sendDownloadStatus("Checking Java22", 10, true);

//     const requestedVersionId = params[0];
//     const NICKNAME = params[1];
//     const JAVA_PATH = await ensureJava21();
//     const RAM = params[2];

//     const BASE_DIR = path.join(app.getPath("userData"), mcPath);
//     const VERSION_ID = resolveVersionDirectory(BASE_DIR, requestedVersionId);
//     const VERSION_DIR = path.join(BASE_DIR, "versions", VERSION_ID);
//     const VERSION_JAR = path.join(VERSION_DIR, `${VERSION_ID}.jar`);
//     const LIBRARIES_DIR = path.join(BASE_DIR, "libraries");
//     const NATIVES_DIR = path.join(VERSION_DIR, "natives");
//     const ASSETS_DIR = path.join(BASE_DIR, "assets");
//     const versionJsonPath = path.join(VERSION_DIR, `${VERSION_ID}.json`);

//     const configPath = getConfig();

//     // Защита от undefined
//     if (!launcherProperties || typeof launcherProperties !== "object") {
//       throw new Error("launcherProperties не загружен корректно");
//     }

//     const selectedCore = resolveMcCore(launcherProperties.mcCore);

//     const targetFile = path.join(BASE_DIR, "mods.zip");
//     if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
//       fs.unlinkSync(targetFile);
//       console.log("mods.zip deleted.");
//     }

//     // Проверка файлов
//     const data = fs.readFileSync(configPath, "utf-8");
//     const configs = JSON.parse(data);
//     const disableDownload = configs.disableDownload ?? false;
//     if (!disableDownload) {
//       sendDownloadStatus("Проверяем файлы Minecraft", 20, true);
//       const manifest = (await generateManifest(".minecraft")) as FilesObject;
//       const manifestUrl = launcherProperties?.url
//         ? launcherProperties.url + "/manifest"
//         : "https://jenison.ru/minecraft/api/manifest";
//       const server_manifest = (await axios.get(manifestUrl)).data;
//       const needDownload = await deepEqual(manifest, server_manifest);
//       if (!needDownload) {
//         process.stdout.write("\n\ndone\n\n");
//         await downloadMinecraft();
//       }
//     }

//     // Загрузка JSON с поддержкой inheritsFrom
//     const versionJson = await loadVersionJson(
//       VERSION_DIR,
//       VERSION_ID,
//       BASE_DIR
//     );
//     const ASSETS_INDEX = versionJson.assets;

//     if (!fs.existsSync(VERSION_JAR)) {
//       throw new Error("Minecraft jar не найден: " + VERSION_JAR);
//     }
//     if (NICKNAME.length < 3 || NICKNAME.length > 16) {
//       throw new Error("Никнейм должен содержать от 3 до 16 символов");
//     }

//     sendDownloadStatus("Сборка classpath", 15, true);

//     // Сборка classpath
//     const classpath =
//       selectedCore === "forge"
//         ? getForgeClasspath(versionJson, LIBRARIES_DIR, VERSION_JAR, BASE_DIR)
//         : getClasspath(LIBRARIES_DIR, VERSION_JAR);

//     const launcherPlaceholders = buildPlaceholderMap({
//       assetsDir: ASSETS_DIR,
//       assetsIndex: ASSETS_INDEX,
//       baseDir: BASE_DIR,
//       classpath,
//       nickname: NICKNAME,
//       nativesDir: NATIVES_DIR,
//       ram: RAM,
//       versionId: VERSION_ID,
//       versionType: selectedCore,
//     });

//     const versionArguments = (versionJson.arguments ?? {}) as VersionArguments;
//     const versionJvmArgs = buildArgsFromArgumentEntries(
//       versionArguments.jvm,
//       launcherPlaceholders
//     );
//     const versionGameArgs = buildArgsFromArgumentEntries(
//       versionArguments.game,
//       launcherPlaceholders
//     );

//     const baseJvmArgs = [
//       `-Xmx${RAM}M`,
//       `-Xms512M`,
//       `-Djava.library.path=${NATIVES_DIR}`,
//       "-cp",
//       classpath,
//     ];

//     const baseGameArgs = [
//       "--username",
//       NICKNAME,
//       "--version",
//       VERSION_ID,
//       "--gameDir",
//       BASE_DIR,
//       "--assetsDir",
//       ASSETS_DIR,
//       "--assetIndex",
//       ASSETS_INDEX,
//       "--accessToken",
//       "0",
//       "--userType",
//       "legacy",
//     ];

//     let mainClass: string;
//     let jvmArgsToUse: string[] = [];
//     let gameArgsToUse: string[] = [];

//     switch (selectedCore) {
//       case "vanilla":
//         mainClass = versionJson.mainClass ?? "net.minecraft.client.main.Main";
//         jvmArgsToUse =
//           versionJvmArgs.length > 0
//             ? applyMemoryLimit(versionJvmArgs, RAM)
//             : baseJvmArgs;
//         gameArgsToUse =
//           versionGameArgs.length > 0 ? versionGameArgs : baseGameArgs;
//         break;

//       case "forge":
//         mainClass =
//           versionJson.mainClass ??
//           "cpw.mods.bootstraplauncher.BootstrapLauncher";

//         // КРИТИЧЕСКИ ВАЖНО: JVM аргументы для Java 21 + Forge
//         const java17Args = [
//           // Аргументы для открытия внутренних модулей Java (ДОЛЖНЫ БЫТЬ ПЕРВЫМИ)
//           "--add-opens",
//           "java.base/java.lang.invoke=ALL-UNNAMED",
//           "--add-opens",
//           "java.base/java.util.jar=ALL-UNNAMED",
//           "--add-opens",
//           "java.base/sun.security.util=ALL-UNNAMED",
//           "--add-opens",
//           "java.base/java.nio.file=ALL-UNNAMED",
//           "--add-opens",
//           "java.base/java.io=ALL-UNNAMED",
//           "--add-exports",
//           "java.base/sun.security.util=ALL-UNNAMED",
//           "--add-exports",
//           "jdk.naming.dns/com.sun.jndi.dns=ALL-UNNAMED,java.naming",
//         ];

//         // Начинаем с Java 21 аргументов
//         let forgeJvmArgs = [...java17Args];

//         // Добавляем память
//         forgeJvmArgs.push(`-Xmx${RAM}M`, `-Xms512M`);

//         // Forge-специфичные системные свойства
//         forgeJvmArgs.push(
//           `-Dminecraft.client.jar=${VERSION_JAR}`,
//           `-Dfml.ignoreInvalidMinecraftCertificates=true`,
//           `-Dfml.ignorePatchDiscrepancies=true`,
//           `-Djava.library.path=${NATIVES_DIR}`,
//           `-Dlog4j.configurationFile=${path.join(VERSION_DIR, "log4j2.xml")}`
//         );

//         // Если есть аргументы из версии JSON, добавляем их (кроме памяти и тех что уже есть)
//         if (versionJvmArgs.length > 0) {
//           const filteredVersionArgs = versionJvmArgs.filter(
//             (arg) =>
//               !arg.startsWith("-Xmx") &&
//               !arg.startsWith("-Xms") &&
//               !arg.startsWith("-Djava.library.path") &&
//               !java17Args.includes(arg)
//           );
//           forgeJvmArgs.push(...filteredVersionArgs);
//         }

//         // ВАЖНО: classpath должен быть в конце JVM аргументов
//         forgeJvmArgs.push("-cp", classpath);

//         jvmArgsToUse = forgeJvmArgs;

//         // Game аргументы для Forge
//         if (versionGameArgs.length > 0) {
//           gameArgsToUse = versionGameArgs;
//           // Убедимся что есть --launchTarget
//           if (!gameArgsToUse.includes("--launchTarget")) {
//             gameArgsToUse.push("--launchTarget", "forgeclient");
//           }
//         } else {
//           gameArgsToUse = [...baseGameArgs, "--launchTarget", "forgeclient"];
//         }
//         break;

//       default:
//         // Fabric
//         mainClass = "net.fabricmc.loader.launch.knot.KnotClient";
//         jvmArgsToUse = baseJvmArgs;
//         gameArgsToUse = baseGameArgs;
//         break;
//     }

//     const args = [...jvmArgsToUse, mainClass, ...gameArgsToUse];

//     console.log("=== LAUNCH DEBUG ===");
//     console.log("Core:", selectedCore);
//     console.log("Java Path:", JAVA_PATH);
//     console.log("Main Class:", mainClass);
//     console.log("Working Dir:", BASE_DIR);
//     console.log("Version Jar:", VERSION_JAR);
//     console.log("\nJVM Args:");
//     jvmArgsToUse.forEach((arg, i) => console.log(`  [${i}]`, arg));
//     console.log("\nGame Args:");
//     gameArgsToUse.forEach((arg, i) => console.log(`  [${i}]`, arg));
//     console.log("===================\n");

//     sendDownloadStatus("Запуск JVM", 30, true);
//     const mc = spawn(JAVA_PATH, args, { cwd: BASE_DIR });

//     mc.stdout.on("data", (data: Buffer) => {
//       const line = data.toString();
//       console.log("[MC]", line);

//       if (line.includes("Setting user"))
//         sendDownloadStatus("Инициализация сессии", 50, true);
//       if (line.includes("LWJGL") || line.includes("OpenGL"))
//         sendDownloadStatus("Загрузка графики", 80, true);
//       if (
//         line.includes("OpenAL initialized") ||
//         line.includes("Sound engine started") ||
//         line.includes("Successfully loaded")
//       )
//         sendDownloadStatus("Minecraft запущен", 100, false);
//     });

//     mc.stderr.on("data", (data: Buffer) => {
//       const line = data.toString();
//       console.error("[MC ERROR]", line);

//       // Forge часто выводит важную информацию в stderr
//       if (
//         line.includes("Launching wrapped minecraft") ||
//         line.includes("ModLauncher running")
//       ) {
//         sendDownloadStatus("Запуск Forge", 60, true);
//       }
//     });

//     mc.on("exit", (code: number) => {
//       console.log(`Minecraft завершен с кодом: ${code}`);
//       sendDownloadStatus("Minecraft завершен", 0, false);
//       const windows = BrowserWindow.getAllWindows();
//       if (windows.length > 0) {
//         windows[0].webContents.send("launch-minecraft", false);
//       }
//       Status.setStatus(false);
//     });
//   } catch (e) {
//     console.error("Launch error:", e);
//     const errorMessage = e instanceof Error ? e.message : String(e);
//     sendError("Ошибка при запуске Minecraft: " + errorMessage);
//     sendDownloadStatus("Ошибка при запуске Minecraft", 0, false);
//     const windows = BrowserWindow.getAllWindows();
//     if (windows.length > 0) {
//       windows[0].webContents.send("launch-minecraft", false);
//     }
//     Status.setStatus(false);
//   }
// }

// // Загрузка JSON с поддержкой inheritsFrom
// async function loadVersionJson(
//   versionDir: string,
//   versionId: string,
//   baseDir: string
// ): Promise<any> {
//   const versionJsonPath = path.join(versionDir, `${versionId}.json`);
//   const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, "utf-8"));

//   // Если есть inheritsFrom, загружаем родительскую версию
//   if (versionJson.inheritsFrom) {
//     const parentVersionId = versionJson.inheritsFrom;
//     const parentDir = path.join(baseDir, "versions", parentVersionId);
//     const parentJsonPath = path.join(parentDir, `${parentVersionId}.json`);

//     if (fs.existsSync(parentJsonPath)) {
//       const parentJson = JSON.parse(fs.readFileSync(parentJsonPath, "utf-8"));
//       return mergeVersionJsons(parentJson, versionJson);
//     }
//   }

//   return versionJson;
// }

// // Объединение JSON версий
// function mergeVersionJsons(parent: any, child: any): any {
//   const merged = { ...parent, ...child };

//   // Объединяем libraries
//   if (parent.libraries && child.libraries) {
//     merged.libraries = [...parent.libraries, ...child.libraries];
//   }

//   // Объединяем arguments
//   if (parent.arguments && child.arguments) {
//     merged.arguments = {
//       game: [...(parent.arguments.game || []), ...(child.arguments.game || [])],
//       jvm: [...(parent.arguments.jvm || []), ...(child.arguments.jvm || [])],
//     };
//   }

//   return merged;
// }

// // Специальный classpath для Forge (без дубликатов)
// function getForgeClasspath(
//   versionJson: any,
//   librariesDir: string,
//   versionJar: string,
//   baseDir: string
// ): string {
//   const jarPaths = new Set<string>(); // Используем Set для избежания дубликатов

//   // Forge использует libraries из JSON в определенном порядке
//   if (versionJson.libraries && Array.isArray(versionJson.libraries)) {
//     for (const lib of versionJson.libraries) {
//       // Пропускаем native библиотеки
//       if (lib.natives) continue;

//       // Проверяем rules
//       if (lib.rules && !shouldIncludeLibrary(lib.rules)) continue;

//       const libPath = getLibraryPath(lib, librariesDir);
//       if (libPath && fs.existsSync(libPath)) {
//         jarPaths.add(libPath);
//       }
//     }
//   }

//   ensureForgeBootstrapJars(jarPaths, baseDir);

//   // Добавляем основной JAR в конец
//   jarPaths.add(versionJar);

//   return Array.from(jarPaths).join(path.delimiter);
// }

// // Получение пути к библиотеке
// function getLibraryPath(library: any, librariesDir: string): string | null {
//   if (!library.name) return null;

//   // Парсим Maven координаты: group:artifact:version
//   const parts = library.name.split(":");
//   if (parts.length < 3) return null;

//   const [group, artifact, version] = parts;
//   const groupPath = group.replace(/\./g, path.sep);
//   const fileName = `${artifact}-${version}.jar`;

//   // Если есть downloads.artifact.path, используем его
//   if (library.downloads?.artifact?.path) {
//     const directPath = path.join(librariesDir, library.downloads.artifact.path);
//     if (fs.existsSync(directPath)) {
//       return directPath;
//     }
//   }

//   // Иначе строим путь вручную
//   const manualPath = path.join(
//     librariesDir,
//     groupPath,
//     artifact,
//     version,
//     fileName
//   );
//   if (fs.existsSync(manualPath)) {
//     return manualPath;
//   }

//   // Фолбэк: ищем любую доступную версию библиотеки, чтобы не сыпаться на неполных дистрибутивах
//   return findFallbackLibraryJar(librariesDir, groupPath, artifact);
// }

// function findFallbackLibraryJar(
//   librariesDir: string,
//   groupPath: string,
//   artifact: string
// ): string | null {
//   const artifactRoot = path.join(librariesDir, groupPath, artifact);
//   if (!fs.existsSync(artifactRoot)) {
//     return null;
//   }

//   const availableVersions = fs
//     .readdirSync(artifactRoot, { withFileTypes: true })
//     .filter((entry) => entry.isDirectory())
//     .map((entry) => entry.name)
//     .sort()
//     .reverse();

//   for (const versionDir of availableVersions) {
//     const jarCandidate = path.join(
//       artifactRoot,
//       versionDir,
//       `${artifact}-${versionDir}.jar`
//     );
//     if (fs.existsSync(jarCandidate)) {
//       return jarCandidate;
//     }
//   }

//   return null;
// }

// // Проверка rules для библиотек
// function shouldIncludeLibrary(rules: any[]): boolean {
//   if (!Array.isArray(rules) || rules.length === 0) {
//     return true;
//   }

//   const currentOs =
//     process.platform === "win32"
//       ? "windows"
//       : process.platform === "darwin"
//         ? "osx"
//         : "linux";

//   let allowed = false;

//   for (const rule of rules) {
//     let matches = true;

//     if (rule.os) {
//       if (rule.os.name && rule.os.name !== currentOs) {
//         matches = false;
//       }
//     }

//     if (matches) {
//       allowed = rule.action === "allow";
//     }
//   }

//   return allowed;
// }

// function resolveVersionDirectory(baseDir: string, fallbackId: string): string {
//   const versionsRoot = path.join(baseDir, "versions");
//   try {
//     const entries = fs.readdirSync(versionsRoot, { withFileTypes: true });
//     const firstDir = entries.find((entry) => entry.isDirectory());
//     if (firstDir) {
//       return firstDir.name;
//     }
//   } catch (err) {
//     console.warn("Не удалось прочитать каталог versions:", err);
//     sendError("Не удалось прочитать каталог versions:", "error");
//   }
//   return fallbackId;
// }

// function getClasspath(librariesDir: string, versionJar: string): string {
//   const jars: string[] = [];

//   function walk(d: string) {
//     for (const file of fs.readdirSync(d)) {
//       const full = path.join(d, file);
//       if (fs.statSync(full).isDirectory()) walk(full);
//       else if (file.endsWith(".jar")) jars.push(full);
//     }
//   }

//   walk(librariesDir);
//   jars.push(versionJar);
//   return jars.join(path.delimiter);
// }

// function ensureForgeBootstrapJars(jarPaths: Set<string>, baseDir: string) {
//   const librariesDir = path.join(baseDir, "libraries");
//   const importantLibs: Array<[string, string]> = [
//     ["cpw.mods", "securejarhandler"],
//     ["cpw.mods", "bootstraplauncher"],
//     ["cpw.mods", "modlauncher"],
//     ["org.apache.logging.log4j", "log4j-api"],
//     ["org.apache.logging.log4j", "log4j-core"],
//     ["net.sf.jopt-simple", "jopt-simple"],
//   ];

//   for (const [group, artifact] of importantLibs) {
//     const groupPath = group.replace(/\./g, path.sep);
//     const fallbackJar = findFallbackLibraryJar(
//       librariesDir,
//       groupPath,
//       artifact
//     );
//     if (fallbackJar) {
//       jarPaths.add(fallbackJar);
//     }
//   }
// }

// type FeatureFlags = Record<string, boolean>;

// interface PlaceholderParams {
//   assetsDir: string;
//   assetsIndex: string;
//   baseDir: string;
//   classpath: string;
//   nickname: string;
//   nativesDir: string;
//   ram: string;
//   versionId: string;
//   versionType: McCore;
// }

// interface MinecraftRule {
//   action: "allow" | "disallow";
//   os?: { name?: string };
//   features?: Record<string, boolean>;
// }

// type ArgumentEntry =
//   | string
//   | { value: string | string[]; rules?: MinecraftRule[] };

// interface VersionArguments {
//   game?: ArgumentEntry[];
//   jvm?: ArgumentEntry[];
// }

// function resolveMcCore(core?: McCore): McCore {
//   if (core === "forge" || core === "vanilla") {
//     return core;
//   }
//   return "fabric";
// }

// function buildPlaceholderMap(
//   params: PlaceholderParams
// ): Record<string, string> {
//   const {
//     assetsDir,
//     assetsIndex,
//     baseDir,
//     classpath,
//     nickname,
//     nativesDir,
//     ram,
//     versionId,
//     versionType,
//   } = params;

//   return {
//     auth_access_token: "0",
//     auth_player_name: nickname,
//     auth_session: "0",
//     auth_uuid: "0",
//     auth_xuid: "0",
//     assets_index_name: assetsIndex,
//     assets_root: assetsDir,
//     classpath,
//     classpath_separator: path.delimiter,
//     clientid: "0",
//     game_assets: assetsDir,
//     game_directory: baseDir,
//     launcher_name: "CustomLauncher",
//     launcher_version: app.getVersion(),
//     library_directory: path.join(baseDir, "libraries"),
//     natives_directory: nativesDir,
//     primary_jar: path.join(baseDir, "versions", versionId, `${versionId}.jar`),
//     quickPlayPath: "",
//     quickPlaySingleplayer: "",
//     quickPlayMultiplayer: "",
//     quickPlayRealms: "",
//     resolution_width: "854",
//     resolution_height: "480",
//     user_properties: "{}",
//     user_type: "legacy",
//     version_name: versionId,
//     version_type: versionType,
//     ram,
//   };
// }

// function buildArgsFromArgumentEntries(
//   entries: ArgumentEntry[] | undefined,
//   placeholders: Record<string, string>
// ): string[] {
//   if (!Array.isArray(entries)) {
//     return [];
//   }
//   const result: string[] = [];
//   for (const entry of entries) {
//     if (typeof entry === "string") {
//       result.push(applyPlaceholders(entry, placeholders));
//       continue;
//     }
//     if (!shouldIncludeArgument(entry.rules)) {
//       continue;
//     }
//     const values = Array.isArray(entry.value) ? entry.value : [entry.value];
//     for (const value of values) {
//       result.push(applyPlaceholders(value, placeholders));
//     }
//   }
//   return result.filter((value) => value !== "");
// }

// function shouldIncludeArgument(rules?: MinecraftRule[]): boolean {
//   if (!Array.isArray(rules) || rules.length === 0) {
//     return true;
//   }

//   const currentOs =
//     process.platform === "win32"
//       ? "windows"
//       : process.platform === "darwin"
//         ? "osx"
//         : "linux";

//   const featureDefaults: FeatureFlags = {
//     has_custom_resolution: false,
//     has_quick_plays_support: false,
//     is_demo_user: false,
//   };

//   let decision = false;
//   for (const rule of rules) {
//     let matches = true;
//     if (rule.os?.name && rule.os.name !== currentOs) {
//       matches = false;
//     }
//     if (matches && rule.features) {
//       matches = Object.entries(rule.features).every(
//         ([feature, expected]) => featureDefaults[feature] === expected
//       );
//     }
//     if (matches) {
//       decision = rule.action === "allow";
//     }
//   }

//   return decision;
// }

// function applyPlaceholders(
//   value: string | undefined | null,
//   placeholders: Record<string, string>
// ): string {
//   if (typeof value !== "string") {
//     return "";
//   }
//   return value.replace(/\$\{(.+?)\}/g, (_, key) => placeholders[key] ?? "");
// }

// function applyMemoryLimit(args: string[], ramLimit: string): string[] {
//   let hasMemoryArg = false;
//   const updated = args.map((arg) => {
//     if (arg.startsWith("-Xmx")) {
//       hasMemoryArg = true;
//       return `-Xmx${ramLimit}M`;
//     }
//     return arg;
//   });
//   if (!hasMemoryArg) {
//     updated.unshift(`-Xmx${ramLimit}M`);
//   }
//   return updated;
// }
