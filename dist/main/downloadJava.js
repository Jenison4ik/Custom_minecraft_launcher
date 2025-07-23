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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureJava17 = ensureJava17;
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const extract_zip_1 = __importDefault(require("extract-zip"));
const electron_1 = require("electron");
const javaBaseDir = path.join(electron_1.app.getPath("userData"), "java");
const java17Path = path.join(javaBaseDir, "temurin-17");
// URL для Windows x64
const JAVA_URL = "https://api.adoptium.net/v3/binary/version/jdk-17.0.10+7/windows/x64/jdk/hotspot/normal/eclipse?project=jdk";
async function ensureJava17() {
    const javaExecutable = path.join(java17Path, "bin", "java.exe");
    if (fs.existsSync(javaExecutable)) {
        return javaExecutable;
    }
    console.log("Java 17 not found, downloading...");
    const zipPath = path.join(electron_1.app.getPath("temp"), "java17.zip");
    const writer = fs.createWriteStream(zipPath);
    const response = await axios_1.default.get(JAVA_URL, { responseType: "stream" });
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });
    console.log("Unpacking Java...");
    await (0, extract_zip_1.default)(zipPath, { dir: javaBaseDir });
    // Найдём название извлечённой папки
    const extractedDir = fs.readdirSync(javaBaseDir).find(d => d.includes("jdk") || d.includes("jre"));
    if (!extractedDir)
        throw new Error("The extracted Java folder could not be found");
    fs.renameSync(path.join(javaBaseDir, extractedDir), java17Path);
    console.log("Java 17 installed");
    return javaExecutable;
}
