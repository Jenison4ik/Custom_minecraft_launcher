import { registerConfigHandlers } from "./handlers/config";
import { registerLaunchHandlers } from "./handlers/launch";
import { registerDownloadHandlers } from "./handlers/download";
import { registerFilesystemHandlers } from "./handlers/filesystem";
import { registerUpdateHandlers } from "./handlers/updates";

export function registerIpcHandlers(): void {
  registerConfigHandlers();
  registerLaunchHandlers();
  registerDownloadHandlers();
  registerFilesystemHandlers();
  registerUpdateHandlers();
}
