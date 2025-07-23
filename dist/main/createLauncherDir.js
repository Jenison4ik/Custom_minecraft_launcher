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
exports.mcPath = void 0;
exports.createLauncherDirectory = createLauncherDirectory;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const path_1 = require("path");
const configPath = (0, path_1.join)(electron_1.app.getAppPath(), 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
let pathName = config?.['minecraft-path-name'] || '.minecraft';
exports.mcPath = pathName;
function createLauncherDirectory() {
    // Путь к пользовательской директории приложения
    const baseDir = electron_1.app.getPath('userData'); // например: C:\Users\Имя\AppData\Roaming\Custom_minecraft_launcher
    const launcherDir = path.join(baseDir, `${config['minecraft-path-name']}`); // директория лаунчера
    // Подкаталоги
    //const subdirs = [ 'mods', 'resourcepacks', 'shaderpacks', 'logs', 'configs','versions'];
    try {
        if (!fs.existsSync(launcherDir)) {
            fs.mkdirSync(launcherDir, { recursive: true });
            console.log('Создана директория лаунчера:', launcherDir);
        }
    }
    catch (err) {
        console.error('Ошибка при создании директорий лаунчера:', err);
    }
    return launcherDir;
}
