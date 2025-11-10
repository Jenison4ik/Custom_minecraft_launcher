import React, { useEffect, useState } from "react";
import InputRange from "./inputRam";
import DownloadMcButton from "./DownloadMcButton";
import "./styles/Settings.scss";
// Типы конфигурации
type LauncherConfigs = {
  ram?: number;
  disableDownload?: boolean;
  [key: string]: any; // для других возможных полей
};

type SettingsProps = {
  configs: LauncherConfigs;
  usingmem: number;
  totalmem: number;
  onChange: (value: number) => void;
  setConfigs: React.Dispatch<React.SetStateAction<LauncherConfigs>>;
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

  // Локальное состояние для слайдера/инпута RAM — меняется часто и
  // не поднимает ререндер App. Применяем в App только по commit.
  const [localRam, setLocalRam] = useState<number>(ramDefault);

  // Синхронизируем локальное состояние, если входные значения поменялись
  useEffect(() => {
    setLocalRam(ramDefault);
  }, [ramDefault, totalmem]);

  const handleCheckboxChange = async (checked: boolean) => {
    // Обновляем конфиг через API
    await window.launcherAPI.addToConfigs([
      { name: "disableDownload", value: checked },
    ]);
    // Обновляем состояние App
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
          checked={configs.disableDownload ?? false}
          onChange={(e) => handleCheckboxChange(e.target.checked)}
        />
        Отключить проверку игровых файлов <span>Не рекомендуется</span>
      </label>

      <DownloadMcButton />
    </main>
  );
}
