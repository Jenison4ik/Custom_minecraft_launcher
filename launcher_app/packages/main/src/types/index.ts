// Common types used throughout the launcher

export interface Config {
  name: string;
  value: any;
}

export interface LauncherConfig {
  nickname?: string;
  ram?: number;
  disableDownload?: boolean;
  [key: string]: any;
}

export interface MinecraftVersion {
  id: string;
  type: string;
  time: string;
  releaseTime: string;
  url: string;
}

export interface MinecraftArguments {
  game?: ArgumentEntry[];
  jvm?: ArgumentEntry[];
}

export interface ArgumentEntry {
  value: string | string[];
  rules?: MinecraftRule[];
}

export interface MinecraftRule {
  action: 'allow' | 'disallow';
  os?: {
    name?: string;
    version?: string;
    arch?: string;
  };
  features?: Record<string, boolean>;
}

export interface MinecraftLibrary {
  name: string;
  downloads?: {
    artifact?: {
      path: string;
      url: string;
      sha1: string;
      size: number;
    };
  };
  natives?: {
    [os: string]: string;
  };
  rules?: MinecraftRule[];
}

export interface MinecraftVersionJson {
  id: string;
  time: string;
  releaseTime: string;
  type: string;
  assets: string;
  libraries: MinecraftLibrary[];
  mainClass: string;
  arguments?: MinecraftArguments;
  inheritsFrom?: string;
  jar?: string;
}

export interface FileEntry {
  sha1: string;
  size: number;
}

export interface FilesObject {
  files: Record<string, FileEntry>;
}

export interface ManifestResponse {
  files: Record<string, FileEntry>;
}

export interface ServerInfo {
  ip: string;
  label: string;
}

export interface LauncherProperties {
  url: string;
  mcCore: 'fabric' | 'forge' | 'vanilla';
  servers: ServerInfo[];
}

export interface DownloadStatus {
  message: string;
  progress: number;
  isDownloading: boolean;
}

export interface LogMessage {
  type: 'log' | 'error' | 'warn' | 'info';
  msg: string;
}