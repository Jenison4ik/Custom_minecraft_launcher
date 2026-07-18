import { useEffect, useState } from "react";
import "../styles/DownloadMcButton.scss";
export default function DownloadMcButton() {
  const [loadingText, setLoadingText] = useState("Загрузка");
  const [isLaunch, setIsLaunch] = useState(false); // initial value

  // Fetch status asynchronously on mount
  useEffect(() => {
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
    const unsubscribe = window.launcherAPI.onMinecraft((status: boolean) => {
      setIsLaunch(status);
    });

    return () => {
      unsubscribe(); // remove only this listener
    };
  }, []);

  async function handleMcDownload() {
    // Wait for download and update state
    await window.launcherAPI.downloadMinecraft();
    setIsLaunch(true);
  }

  return (
    <button
      onClick={handleMcDownload}
      disabled={isLaunch}
      className="restorebtn"
    >
      {isLaunch ? loadingText : "Восстановить игровые файлы"}
    </button>
  );
}
