import React, { useEffect, useState } from "react";
import InputRange from "../components/inputRam";
import DownloadMcButton from "../components/DownloadMcButton";
import "../styles/Settings.scss";

type LauncherConfigs = {
  ram?: number;
  disableDownload?: boolean;
  [key: string]: unknown;
};

type SettingsProps = {
  configs: LauncherConfigs;
  usingmem: number;
  totalmem: number;
  onChange: (value: number) => void;
  setConfigs: React.Dispatch<
    React.SetStateAction<Record<string, unknown> | null>
  >;
};

export default function Settings({
  configs,
  usingmem,
  totalmem,
  onChange,
  setConfigs,
}: SettingsProps) {
  const ramDefault =
    typeof configs.ram !== "number" || configs.ram > totalmem
      ? Math.floor(totalmem * 0.6)
      : configs.ram;

  const [localRam, setLocalRam] = useState<number>(ramDefault);

  useEffect(() => {
    setLocalRam(ramDefault);
  }, [ramDefault, totalmem]);

  const handleCheckboxChange = async (checked: boolean) => {
    await window.launcherAPI.addToConfigs([
      { name: "disableDownload", value: checked },
    ]);
    setConfigs({ ...configs, disableDownload: checked });
  };

  return (
    <main className="settings">
      <h1>Настройки</h1>

      <h2>Оперативная память</h2>
      <InputRange
        defVal={localRam}
        maxVal={totalmem}
        onChange={(v) => setLocalRam(v)}
        onCommit={(v) => onChange(v)}
      />

      <label>
        <input
          type="checkbox"
          checked={(configs.disableDownload as boolean) ?? false}
          onChange={(e) => handleCheckboxChange(e.target.checked)}
        />
        Отключить проверку игровых файлов <span>Не рекомендуется</span>
      </label>

      <DownloadMcButton />
    </main>
  );
}
