import mcInstall from "../minecraft/installer";

export default async function restoreMinecraft() {
  await mcInstall({
    nickname: "Steve",
    ram: 2048,
    disableDownload: false,
    id: "1.20.1",
    loader: { type: "vanilla" },
  });
}
