/**
 * Настройки лаунчера
 */
export interface LauncherConfig {
  /** Никнейм игрока */
  nickname: string;

  /** Оперативная память в МБ */
  ram: number;

  /** Отключить скачивание файлов */
  disableDownload: boolean;

  /** Версия Minecraft (например: 1.18.2) */
  id: string;
  core: "fabric" | "forge" | "vanilla";
}
