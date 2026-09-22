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

    if (!window.launcherAPI) return;
    window.launcherAPI.onDownloadStatus(handleDownloadStatus);

    return () => {
      // Unsubscribe from downloads on unmount
      window.launcherAPI.onDownloadStatus(() => {});
    };
  }, []);
  return (
    <div
      className={`launcher-download${download.isDownloading ? " launcher-download--visible" : ""}`}
    >
      <div
        className="launcher-download-progress"
        style={{ width: `${download.progress}%` }}
      >
        <div className="launcher-download-animation"></div>
      </div>
      <p className="launcher-download-message">
        {download.message} — {download.progress}%
      </p>
    </div>
  );
}
