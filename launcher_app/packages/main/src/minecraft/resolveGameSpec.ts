import launcherProperties from "../config/launcherProperties";
import configService from "../services/configService";
import type { GameSpec } from "../types/LauncherConfig";

function pickLoaderVersion(
  fromUser: unknown,
  fromProperties: string
): string | undefined {
  if (typeof fromUser === "string" && fromUser.trim()) {
    return fromUser.trim();
  }
  if (fromProperties.trim()) {
    return fromProperties.trim();
  }
  return undefined;
}

/**
 * Builds install/launch spec from launcherProperties (game) + user config (prefs).
 * `loaderVersion`: user config.json overrides properties when non-empty.
 */
export default function resolveGameSpec(): GameSpec {
  const user = configService.getAll();

  const nickname =
    typeof user.nickname === "string" && user.nickname.trim()
      ? user.nickname
      : "Steve";

  const ram =
    typeof user.ram === "number" && user.ram > 0 ? user.ram : 2048;

  const disableDownload = user.disableDownload === true;

  return {
    mcVersion: launcherProperties.mcVersion,
    loader: launcherProperties.mcCore,
    loaderVersion: pickLoaderVersion(
      user.loaderVersion,
      launcherProperties.loaderVersion
    ),
    nickname,
    ram,
    disableDownload,
  };
}
