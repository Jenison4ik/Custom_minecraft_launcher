import mcInstall from "../minecraft/installer";
import { loadLaunchContext } from "../minecraft/loadLaunchContext";

export default async function restoreMinecraft() {
  const context = await loadLaunchContext();
  await mcInstall({
    ...context.spec,
    disableDownload: false,
  });
}
