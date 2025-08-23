import { BrowserWindow } from "electron";


export default function sendDownloadStatus(message: string, progress: number = 0) {
    process.stdout.write(message);

    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('show-download-status', message, progress);
    }
}