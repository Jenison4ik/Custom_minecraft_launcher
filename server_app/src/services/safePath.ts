import path from "path";

export class SafePathError extends Error {
  constructor(message = "Invalid path") {
    super(message);
    this.name = "SafePathError";
  }
}

export function resolveInside(rootDir: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("\0")) {
    throw new SafePathError();
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new SafePathError();
  }

  const root = path.resolve(rootDir);
  const absolute = path.resolve(root, ...segments);
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new SafePathError();
  }
  return absolute;
}

export function toManifestKey(rootDir: string, absolutePath: string): string {
  return path.relative(path.resolve(rootDir), absolutePath).replace(/\\/g, "/");
}
