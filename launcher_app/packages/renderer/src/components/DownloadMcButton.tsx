import { useEffect, useState } from "react";
export default function DownloadMcButton() {
  const [loadingText, setLoadingText] = useState("Загрузка");
  const [isLaunch, setIsLaunch] = useState(false); // initial value

  // Fetch status asynchronously on mount
  useEffect(() => {
    if (!window.launcherAPI) return;
    (async () => {
      const status = await window.launcherAPI.getStatus();
      setIsLaunch(status);
    })();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isLaunch) {
      let dots = 0;
      interval = setInterval(() => {
        dots++;
        setLoadingText(`Загрузка${".".repeat(dots % 4)}`);
      }, 500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLaunch]);

  useEffect(() => {
    if (!window.launcherAPI) return;
    const unsubscribe = window.launcherAPI.onMinecraft((status: boolean) => {
      setIsLaunch(status);
    });

    return () => {
      unsubscribe(); // remove only this listener
    };
  }, []);

  async function handleMcDownload() {
    await window.launcherAPI.downloadMinecraft();
  }

  return (
    <button
      type="button"
      onClick={handleMcDownload}
      disabled={isLaunch}
      className="launcher-restore"
    >
      {isLaunch ? loadingText : "Восстановить игровые файлы"}
    </button>
  );
}
