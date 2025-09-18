// pages/Home.tsx
import React, { useEffect, useState, useRef } from "react";
import { HashRouter, Routes, Route, Link } from "react-router-dom";
import InputText from "./inputText";
import InputRam from "./inputRam";
import ErrorToasts from "./ErrorToasts";
import DownloadBar from "./DownloadBar";
import LaunchButton from "./LaunchButton";
import SettingsToggleButton from "./SettingsToggleButton";

export default function Layout({
  configs,
  usingmem,
}: {
  configs: any;
  usingmem: number;
}) {
  const [totalmem, setTotalmem] = useState<number>(0);

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
        {/* <nav style={{ padding: "10px" }}>
          <Link to="/">Главная</Link> | <Link to="/settings">Настройки</Link>
        </nav> */}
        <InputText
          placeholder={"Nickname"}
          value={configs["nickname"] ?? "Steve"}
          inputRef={inputRef}
        />
        <div className="buttons-box">
          {/* <button className="button">
            <Link to="/settings">⚙</Link>
          </button> */}
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
