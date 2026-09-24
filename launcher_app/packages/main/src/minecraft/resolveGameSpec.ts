import configService from "../services/configService";
import type { GameProfile } from "./profileClient";
import type { GameSpec } from "../types/LauncherConfig";

/**
 * Builds install/launch spec from the server profile and local player prefs.
 * The server profile is the only source for the game version and loader.
 */
export default function resolveGameSpec(profile: GameProfile): GameSpec {
  const user = configService.getAll();

  const nickname =
    typeof user.nickname === "string" && user.nickname.trim()
      ? user.nickname
      : "Steve";

  const ram =
    typeof user.ram === "number" && user.ram > 0 ? user.ram : 2048;

  const disableDownload = user.disableDownload === true;

  return {
    mcVersion: profile.mcVersion,
    loader: profile.loader,
    loaderVersion: profile.loaderVersion.trim() || undefined,
    nickname,
    ram,
    disableDownload,
  };
}
