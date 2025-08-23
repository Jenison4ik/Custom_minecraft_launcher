import { BrowserWindow } from "electron";


export default function sendDownloadStatus(message: string, progress: number = 0, isDownloading: boolean) {
    // Логируем в консоль только если это не пустое сообщение
    if (message.trim()) {
        process.stdout.write(`\r${message}`);
    }

    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('show-download-status', message, progress, isDownloading);
    }
}