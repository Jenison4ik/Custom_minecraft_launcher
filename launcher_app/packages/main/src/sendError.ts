import { BrowserWindow } from "electron";


export default function sendError(message: string) {
    process.stdout.write(message);

    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('show-error-toast', message);
    }
}