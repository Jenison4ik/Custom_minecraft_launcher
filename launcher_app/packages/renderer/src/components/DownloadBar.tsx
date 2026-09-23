import { useEffect, useRef, useState } from "react";
import type { DownloadStatus } from "@jenison/shared";

const EMPTY: DownloadStatus = {
  active: false,
  title: "",
  loadedBytes: null,
  totalBytes: null,
};

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

type SpeedSample = {
  title: string;
  loaded: number;
  at: number;
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
  const percent = known
    ? Math.round((status.loadedBytes! / status.totalBytes!) * 100)
    : null;

  const parts: string[] = [];
  if (status.title) parts.push(status.title);
  if (known && percent != null) {
    parts.push(
      `${formatBytes(status.loadedBytes!)} / ${formatBytes(status.totalBytes!)}`
    );
    parts.push(`${percent}%`);
    if (speed != null && speed > 0) parts.push(`${formatBytes(speed)}/s`);
  }

  const width = known ? `${percent}%` : status.active ? "100%" : "0%";

  return (
    <div
      className={`launcher-download${status.active ? " launcher-download--visible" : ""}`}
    >
      <div className="launcher-download-progress" style={{ width }}>
        <div className="launcher-download-animation"></div>
      </div>
      <p className="launcher-download-message">{parts.join(" · ")}</p>
    </div>
  );
}
