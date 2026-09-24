import configService from "../services/configService";
import { loadProfile, type ProfileServer } from "./profileClient";
import resolveGameSpec from "./resolveGameSpec";
import type { GameSpec } from "../types/LauncherConfig";

export interface LaunchContext {
  spec: GameSpec;
  online: boolean;
  servers: ProfileServer[];
}

export async function loadLaunchContext(): Promise<LaunchContext> {
  const user = configService.getAll();
  const allowNetwork = user.disableDownload !== true;
  const loaded = await loadProfile(allowNetwork);
  return {
    spec: resolveGameSpec(loaded.profile),
    online: loaded.online,
    servers: loaded.profile.servers,
  };
}
