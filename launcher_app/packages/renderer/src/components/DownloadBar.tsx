import { useEffect, useRef, useState } from "react";
import { Progress } from "@base-ui/react/progress";
import type { DownloadStatus } from "@jenison/shared";

const EMPTY: DownloadStatus = {
  active: false,
  title: "",
  loadedBytes: null,
  totalBytes: null,
  completedItems: null,
  totalItems: null,
};

const fileCount = new Intl.NumberFormat("ru-RU");

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function formatEta(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) return `~${rounded} с`;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `~${minutes} мин` : `~${minutes} мин ${rest} с`;
}

type SpeedSample = {
  title: string;
  loaded: number;
  at: number;
  startedAt: number;
  speed: number | null;
};

export default function DownloadBar() {
  const [status, setStatus] = useState<DownloadStatus>(EMPTY);
  const [speed, setSpeed] = useState<number | null>(null);
  const sample = useRef<SpeedSample | null>(null);

  useEffect(() => {
    if (!window.launcherAPI) return;

    const unsubscribe = window.launcherAPI.onDownloadStatus((next) => {
      setStatus(next);

      if (
        !next.active ||
        next.loadedBytes == null ||
        next.totalBytes == null
      ) {
        sample.current = null;
        setSpeed(null);
        return;
      }

      const now = performance.now();
      const prev = sample.current;
      if (
        prev &&
        prev.title === next.title &&
        next.loadedBytes >= prev.loaded
      ) {
        const dt = (now - prev.at) / 1000;
        if (dt >= 0.05) {
          const instant = (next.loadedBytes - prev.loaded) / dt;
          const smoothed =
            prev.speed == null ? instant : prev.speed * 0.7 + instant * 0.3;
          sample.current = {
            title: next.title,
            loaded: next.loadedBytes,
            at: now,
            startedAt: prev.startedAt,
            speed: smoothed,
          };
          setSpeed(smoothed);
          return;
        }
      }

      sample.current = {
        title: next.title,
        loaded: next.loadedBytes,
        at: now,
        startedAt: prev?.title === next.title ? prev.startedAt : now,
        speed: prev?.title === next.title ? prev.speed : null,
      };
      if (!prev || prev.title !== next.title) setSpeed(null);
    });

    return unsubscribe;
  }, []);

  const known =
    status.loadedBytes != null &&
    status.totalBytes != null &&
    status.totalBytes > 0;
  const itemsKnown =
    status.completedItems != null &&
    status.totalItems != null &&
    status.totalItems > 0;
  const bytePercent = known
    ? Math.round((status.loadedBytes! / status.totalBytes!) * 100)
    : null;
  const itemPercent = itemsKnown
    ? Math.round((status.completedItems! / status.totalItems!) * 100)
    : null;
  const percent = bytePercent ?? itemPercent;

  const measuredFor =
    sample.current && sample.current.title === status.title
      ? performance.now() - sample.current.startedAt
      : 0;
  const showEta = known && speed != null && speed > 0 && measuredFor >= 1000;
  const remainingBytes = known
    ? Math.max(0, status.totalBytes! - status.loadedBytes!)
    : 0;

  const parts: string[] = [];
  if (status.title) parts.push(status.title);
  if (itemsKnown) {
    parts.push(
      `${fileCount.format(status.completedItems!)} / ${fileCount.format(status.totalItems!)} файлов`
    );
  }
  if (percent != null) parts.push(`${percent} %`);
  if (known && speed != null && speed > 0) parts.push(`${formatBytes(speed)}/s`);
  if (showEta && remainingBytes > 0 && speed != null && speed > 0) {
    parts.push(
      `осталось ${formatBytes(remainingBytes)} (${formatEta(remainingBytes / speed)})`
    );
  }

  const value = percent ?? (status.active ? 100 : 0);

  return (
    <div
      className={`launcher-download${status.active ? " launcher-download--visible" : ""}`}
    >
      <Progress.Root className="launcher-download-progress" value={value} max={100}>
        <Progress.Track className="launcher-download-track">
          <Progress.Indicator className="launcher-download-fill">
            <span className="launcher-download-animation" />
          </Progress.Indicator>
        </Progress.Track>
      </Progress.Root>
      <p className="launcher-download-message">{parts.join(", ")}</p>
    </div>
  );
}
