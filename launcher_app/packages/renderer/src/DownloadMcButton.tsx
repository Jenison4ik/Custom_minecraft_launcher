import { useEffect, useState } from "react";
import "./styles/DownloadMcButton.scss";
export default function DownloadMcButton() {
  const [loadingText, setLoadingText] = useState("Загрузка");
  const [isLaunch, setIsLaunch] = useState(false); // начальное значение

  // при монтировании достаём статус асинхронно
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
      unsubscribe(); // снимаем только этот listener
    };
  }, []);

  async function handleMcDownload() {
    // ждем загрузку и меняем состояние
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
