import { BrowserWindow } from "electron";
import downloadMinecraft from "./downloadMinecraft";
import sendError from "./sendError";
import Status from "./status";
import mcInstall from "./mcInstaller";

// export default async function restoreMinecraft() {
//   const window = BrowserWindow.getAllWindows()[0];
//   try {
//     window.webContents.send("launch-minecraft", true);
//     Status.setStatus(true);
//     await downloadMinecraft();
//   } catch (e) {
//     sendError("Error while downloading Minecraft " + e);
//   } finally {
//     window.webContents.send("launch-minecraft", false);
//     Status.setStatus(false);
//   }
// }

export default async function restoreMinecraft() {
  await mcInstall("1.20.1");
}
