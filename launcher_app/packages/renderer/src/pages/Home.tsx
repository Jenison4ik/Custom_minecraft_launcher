import { useEffect, useState } from "react";
import type { LauncherInfo } from "@jenison/shared";

export default function Home() {
  const [info, setInfo] = useState<LauncherInfo | null>(null);

  useEffect(() => {
    if (!window.launcherAPI?.getLauncherInfo) return;
    window.launcherAPI
      .getLauncherInfo()
      .then(setInfo)
      .catch((error) => console.error("Error loading launcher info: ", error));
  }, []);

  const primary = info?.servers[0];
  const extra = info ? info.servers.slice(primary ? 1 : 0) : [];
  const version = info
    ? `Minecraft ${info.mcVersion}, ${info.loader}${info.loaderVersion ? ` ${info.loaderVersion}` : ""}`
    : "Сборка ещё не загружена";

  return (
    <main className="launcher-page launcher-page--home">
      <div className="launcher-home">
        <h1 className="launcher-title">{primary?.lable || "Главная"}</h1>
        <p className="launcher-home-meta">{version}</p>
        {primary ? <p className="launcher-home-meta">{primary.ip}</p> : null}
        {extra.length > 0 ? (
          <div className="launcher-home-servers">
            {extra.map((server) => (
              <p
                className="launcher-home-server"
                key={`${server.lable}-${server.ip}`}
              >
                <span>{server.lable}</span>
                <span>{server.ip}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
