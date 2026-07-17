import React, { useState, useRef } from "react";
import InputText from "./inputText";
import ErrorToasts from "./ErrorToasts";
import DownloadBar from "./DownloadBar";
import LaunchButton from "./LaunchButton";
import SettingsToggleButton from "./SettingsToggleButton";
import "../styles/Layout.scss";

export default function Layout({
  configs,
  usingmem,
}: {
  configs: Record<string, unknown>;
  usingmem: number;
}) {
  const [totalmem] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);

  async function handleRunMinecraft(): Promise<void> {
    try {
      const nickname = inputRef.current?.value ?? "Steve";
      window.launcherAPI.addToConfigs([
        { name: "nickname", value: nickname },
        { name: "ram", value: usingmem ?? (totalmem < 2048 ? totalmem : 2048) },
      ]);
      await window.launcherAPI.runMinecraft();
    } catch (e) {
      console.log(e);
    }
  }

  return (
    <>
      <ErrorToasts />
      <DownloadBar />
      <div className="controls">
        <LaunchButton onClick={handleRunMinecraft} />
        <InputText
          placeholder={"Nickname"}
          value={(configs["nickname"] as string) ?? "Steve"}
          inputRef={inputRef}
        />
        <div className="buttons-box">
          <SettingsToggleButton />
          <button
            title="Open Folder"
            onClick={window.launcherAPI.openLauncherDir}
            className="button"
          >
            <img src="./folder.svg" alt="папка" />
          </button>
        </div>
      </div>
    </>
  );
}
