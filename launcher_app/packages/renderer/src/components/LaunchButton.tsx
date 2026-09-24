import { useEffect, useState } from "react";

type LaunchButtonProps = {
  onClick: () => void;
};

export default function LaunchButton({ onClick }: LaunchButtonProps) {
  const [running, setRunning] = useState(false);
  const [canStop, setCanStop] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!window.launcherAPI) return;
    let cancelled = false;

    void window.launcherAPI.getStatus().then((status) => {
      if (!cancelled) setRunning(status);
    });
    void window.launcherAPI.canStopMinecraft?.().then((stoppable) => {
      if (!cancelled) setCanStop(stoppable);
    });

    const unsubscribeLaunch = window.launcherAPI.onMinecraft((status, stoppable) => {
      setRunning(status);
      setCanStop(Boolean(stoppable));
    });
    const unsubscribeDownload = window.launcherAPI.onDownloadStatus((status) => {
      setChecking(status.active);
    });

    return () => {
      cancelled = true;
      unsubscribeLaunch();
      unsubscribeDownload();
    };
  }, []);

  const exitMode = canStop;
  const blocked = !exitMode && (running || checking);

  return (
    <button
      type="button"
      className={
        exitMode ? "launcher-launch launcher-launch--exit" : "launcher-launch"
      }
      disabled={blocked}
      onClick={() => {
        if (blocked) return;
        if (exitMode) {
          void window.launcherAPI.stopMinecraft?.();
          return;
        }
        onClick();
      }}
    >
      {exitMode ? "Выйти" : "Запустить игру"}
    </button>
  );
}
