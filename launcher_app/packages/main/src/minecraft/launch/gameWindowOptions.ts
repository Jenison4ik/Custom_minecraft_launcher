import fs from "fs";
import path from "path";

const WINDOW_KEYS = ["fullscreen", "overrideWidth", "overrideHeight"] as const;

/**
 * Minecraft keeps the last window mode in options.txt and prefers it
 * over --width/--height/--fullscreen on the next start.
 */
export function applyGameWindowOptions(
  mcDir: string,
  options: { width: number; height: number; fullscreen: boolean }
): void {
  const filePath = path.join(mcDir, "options.txt");
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";
  const newline = existing.includes("\r\n") ? "\r\n" : "\n";
  const lines = existing.length > 0 ? existing.split(/\r?\n/) : [];
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const values: Record<(typeof WINDOW_KEYS)[number], string> = {
    fullscreen: options.fullscreen ? "true" : "false",
    overrideWidth: String(options.width),
    overrideHeight: String(options.height),
  };
  const seen = new Set<string>();

  const next = lines.map((line) => {
    const separator = line.indexOf(":");
    if (separator <= 0) return line;
    const key = line.slice(0, separator);
    if (!WINDOW_KEYS.includes(key as (typeof WINDOW_KEYS)[number])) {
      return line;
    }
    seen.add(key);
    return `${key}:${values[key as (typeof WINDOW_KEYS)[number]]}`;
  });

  for (const key of WINDOW_KEYS) {
    if (!seen.has(key)) {
      next.push(`${key}:${values[key]}`);
    }
  }

  fs.writeFileSync(filePath, `${next.join(newline)}${newline}`, "utf8");
}
