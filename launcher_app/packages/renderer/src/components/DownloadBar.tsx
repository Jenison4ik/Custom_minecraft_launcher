import "../styles/DownloadBar.scss";
import { useState, useEffect } from "react";

export default function DownloadBar() {
  const [download, setDownload] = useState<{
    message: string;
    progress: number;
    isDownloading: boolean;
  }>({ message: "", progress: 0, isDownloading: false });

  useEffect(() => {
    // Active download handler
    const handleDownloadStatus = (
      message: string,
      progress: number,
      isDownloading: boolean
    ) => {
      setDownload({
        message: message,
        progress: progress,
        isDownloading: isDownloading,
      });
    };

    window.launcherAPI.onDownloadStatus(handleDownloadStatus);

    return () => {
      // Unsubscribe from downloads on unmount
      window.launcherAPI.onDownloadStatus(() => {});
    };
  }, []);
  return (
    <div className={`download-bar ${download.isDownloading ? "show" : ""}`}>
      <div
        className="download-progress-bar"
        style={{ width: `${download.progress}%` }}
      >
        <div className="download-animation"></div>
      </div>
      <p className="download-message">
        {download.message} — {download.progress}%
      </p>
    </div>
  );
}
