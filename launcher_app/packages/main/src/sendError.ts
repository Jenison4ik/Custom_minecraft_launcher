import { BrowserWindow } from "electron";

export default function sendError(
  message: string,
  type?: "error" | "notification"
) {
  type = type ?? "error";

  console.log(message);

  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send("show-error-toast", message, type);
  }
}
