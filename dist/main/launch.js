"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMinecraft = runMinecraft;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const createLauncherDir_1 = require("./createLauncherDir"); // mcPath должен быть экспортирован без циклов
const electron_1 = require("electron");
const downloadJava_1 = require("./downloadJava");
async function runMinecraft() {
    const VERSION_ID = "1.20.1";
    const NICKNAME = "Player123";
    const JAVA_PATH = await (0, downloadJava_1.ensureJava17)(); //проверка и установка Java
    const RAM = "2G";
    // Пути
    const BASE_DIR = path.join(electron_1.app.getPath('userData'), createLauncherDir_1.mcPath); // корень .minecraft
    const VERSION_DIR = path.join(BASE_DIR, "versions", VERSION_ID);
    const VERSION_JAR = path.join(VERSION_DIR, `${VERSION_ID}.jar`);
    const LIBRARIES_DIR = path.join(BASE_DIR, "libraries");
    const NATIVES_DIR = path.join(VERSION_DIR, "natives");
    const ASSETS_DIR = path.join(BASE_DIR, "assets");
    const ASSETS_INDEX = "1.20.1"; // или свой индекс
    console.log("mcPath:", createLauncherDir_1.mcPath);
    // Проверка наличия jar-файла
    if (!fs.existsSync(VERSION_JAR)) {
        console.error("Minecraft jar did not found:", VERSION_JAR);
        return;
    }
    // Сборка classpath
    function getClasspath(librariesDir) {
        const jars = [];
        function walk(d) {
            for (const file of fs.readdirSync(d)) {
                const full = path.join(d, file);
                if (fs.statSync(full).isDirectory())
                    walk(full);
                else if (file.endsWith(".jar"))
                    jars.push(full);
            }
        }
        walk(librariesDir);
        jars.push(VERSION_JAR);
        return jars.join(path.delimiter);
    }
    const classpath = getClasspath(LIBRARIES_DIR);
    // JVM + game args
    const jvmArgs = [
        `-Xmx${RAM}`,
        `-Djava.library.path=${NATIVES_DIR}`,
        "-cp", classpath
    ];
    const mainClass = "net.minecraft.client.main.Main";
    const gameArgs = [
        "--username", NICKNAME,
        "--version", VERSION_ID,
        "--gameDir", BASE_DIR,
        "--assetsDir", ASSETS_DIR,
        "--assetIndex", ASSETS_INDEX,
        "--accessToken", "0",
        "--userType", "legacy"
    ];
    const args = [...jvmArgs, mainClass, ...gameArgs];
    console.log(`🚀 Запуск Minecraft из ${BASE_DIR}`);
    const mc = (0, child_process_1.spawn)(JAVA_PATH, args, { cwd: BASE_DIR });
    mc.stdout.on("data", (data) => process.stdout.write(data));
    mc.stderr.on("data", (data) => process.stderr.write(data));
    mc.on("exit", (code) => console.log(`Minecraft ended with code: ${code}`));
}
