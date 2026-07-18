import mcInstall from "../minecraft/installer";
import resolveGameSpec from "../minecraft/resolveGameSpec";

export default async function restoreMinecraft() {
  await mcInstall({
    ...resolveGameSpec(),
    disableDownload: false,
  });
}
