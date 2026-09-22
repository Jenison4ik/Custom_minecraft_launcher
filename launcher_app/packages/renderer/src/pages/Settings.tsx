import React, { useEffect, useState } from "react";
import type { LauncherInfo } from "@jenison/shared";
import InputRange from "../components/inputRam";
import DownloadMcButton from "../components/DownloadMcButton";

type LauncherConfigs = {
  ram?: number;
  disableDownload?: boolean;
  windowWidth?: number;
  windowHeight?: number;
  fullscreen?: boolean;
  closeOnLaunch?: boolean;
  javaPath?: string;
  jvmArgs?: string;
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

const PRESETS = [
  { id: "854x480", label: "854×480", width: 854, height: 480 },
  { id: "1280x720", label: "1280×720", width: 1280, height: 720 },
  { id: "1600x900", label: "1600×900", width: 1600, height: 900 },
  { id: "1920x1080", label: "1920×1080", width: 1920, height: 1080 },
] as const;

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && value > 0 ? Math.floor(value) : fallback;
}

function presetId(width: number, height: number): string {
  const found = PRESETS.find(
    (preset) => preset.width === width && preset.height === height
  );
  return found ? found.id : "custom";
}

export default function Settings({
  configs,
  totalmem,
  onChange,
  setConfigs,
}: SettingsProps) {
  const ramDefault =
    typeof configs.ram !== "number" || configs.ram > totalmem
      ? Math.floor(totalmem * 0.6)
      : configs.ram;

  const [localRam, setLocalRam] = useState<number>(ramDefault);
  const [info, setInfo] = useState<LauncherInfo | null>(null);
  const [width, setWidth] = useState(() =>
    readNumber(configs.windowWidth, DEFAULT_WIDTH)
  );
  const [height, setHeight] = useState(() =>
    readNumber(configs.windowHeight, DEFAULT_HEIGHT)
  );
  const [resolutionPreset, setResolutionPreset] = useState(() =>
    presetId(
      readNumber(configs.windowWidth, DEFAULT_WIDTH),
      readNumber(configs.windowHeight, DEFAULT_HEIGHT)
    )
  );
  const [javaPath, setJavaPath] = useState(
    typeof configs.javaPath === "string" ? configs.javaPath : ""
  );
  const [jvmArgs, setJvmArgs] = useState(
    typeof configs.jvmArgs === "string" ? configs.jvmArgs : ""
  );

  useEffect(() => {
    setLocalRam(ramDefault);
  }, [ramDefault, totalmem]);

  useEffect(() => {
    if (!window.launcherAPI?.getLauncherInfo) return;
    window.launcherAPI
      .getLauncherInfo()
      .then(setInfo)
      .catch((error) => console.error("Error loading launcher info: ", error));
  }, []);

  async function save(entries: { name: string; value: unknown }[]) {
    if (!window.launcherAPI) return;
    await window.launcherAPI.addToConfigs(entries);
    setConfigs((current) => {
      const next = { ...(current ?? {}) };
      for (const entry of entries) next[entry.name] = entry.value;
      return next;
    });
  }

  const handleCheckboxChange = async (checked: boolean) => {
    await save([{ name: "disableDownload", value: checked }]);
  };

  return (
    <main className="launcher-page launcher-page--settings">
      <h1 className="launcher-title">Настройки</h1>

      <section className="launcher-settings-section launcher-settings-pack">
        <h2 className="launcher-subtitle">Сборка</h2>
        <p className="launcher-settings-line">
          Minecraft {info?.mcVersion ?? "…"}
          {info ? `, ${info.loader}` : ""}
          {info?.loaderVersion ? ` ${info.loaderVersion}` : ""}
        </p>
        {info && info.servers.length > 0 && (
          <ul className="launcher-settings-list">
            {info.servers.map((server) => (
              <li key={`${server.lable}-${server.ip}`}>
                {server.lable} — {server.ip}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="launcher-settings-section launcher-settings-memory">
        <h2 className="launcher-subtitle">Оперативная память</h2>
        <InputRange
          defVal={localRam}
          maxVal={totalmem}
          onChange={(v) => setLocalRam(v)}
          onCommit={(v) => onChange(v)}
        />
      </section>

      <section className="launcher-settings-section launcher-settings-window">
        <h2 className="launcher-subtitle">Окно игры</h2>
        <label className="launcher-settings-field">
          Разрешение
          <select
            className="launcher-settings-input"
            value={resolutionPreset}
            onChange={(event) => {
              const next = event.target.value;
              setResolutionPreset(next);
              const preset = PRESETS.find((item) => item.id === next);
              if (!preset) return;
              setWidth(preset.width);
              setHeight(preset.height);
              void save([
                { name: "windowWidth", value: preset.width },
                { name: "windowHeight", value: preset.height },
              ]);
            }}
          >
            {PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Своё</option>
          </select>
        </label>
        {resolutionPreset === "custom" && (
          <div className="launcher-settings-row">
            <label className="launcher-settings-field">
              Ширина
              <input
                className="launcher-settings-input launcher-settings-input--number"
                type="number"
                min={1}
                value={width}
                onChange={(event) => setWidth(Number(event.target.value))}
                onBlur={() => {
                  const next = width > 0 ? Math.floor(width) : DEFAULT_WIDTH;
                  setWidth(next);
                  void save([{ name: "windowWidth", value: next }]);
                }}
              />
            </label>
            <label className="launcher-settings-field">
              Высота
              <input
                className="launcher-settings-input launcher-settings-input--number"
                type="number"
                min={1}
                value={height}
                onChange={(event) => setHeight(Number(event.target.value))}
                onBlur={() => {
                  const next = height > 0 ? Math.floor(height) : DEFAULT_HEIGHT;
                  setHeight(next);
                  void save([{ name: "windowHeight", value: next }]);
                }}
              />
            </label>
          </div>
        )}
        <label className="launcher-check">
          <input
            className="launcher-check-input"
            type="checkbox"
            checked={configs.fullscreen === true}
            onChange={(event) => {
              void save([{ name: "fullscreen", value: event.target.checked }]);
            }}
          />
          Полный экран
        </label>
      </section>

      <section className="launcher-settings-section launcher-settings-launch">
        <h2 className="launcher-subtitle">Запуск</h2>
        <label className="launcher-check">
          <input
            className="launcher-check-input"
            type="checkbox"
            checked={configs.closeOnLaunch === true}
            onChange={(event) => {
              void save([
                { name: "closeOnLaunch", value: event.target.checked },
              ]);
            }}
          />
          Закрывать лаунчер после старта игры
        </label>
        <p className="launcher-settings-hint">
          Окно спрячется на время игры и откроется снова, когда она закроется.
        </p>
        <label className="launcher-settings-field">
          Своя Java
          <input
            className="launcher-settings-input"
            type="text"
            readOnly
            value={javaPath}
            placeholder="Автоустановка"
          />
        </label>
        <div className="launcher-settings-actions">
          <button
            type="button"
            className="launcher-restore"
            onClick={() => {
              void window.launcherAPI.pickJavaPath().then((picked) => {
                if (!picked) return;
                setJavaPath(picked);
                void save([{ name: "javaPath", value: picked }]);
              });
            }}
          >
            Обзор
          </button>
          <button
            type="button"
            className="launcher-restore"
            onClick={() => {
              setJavaPath("");
              void save([{ name: "javaPath", value: "" }]);
            }}
          >
            Сбросить
          </button>
        </div>
        <label className="launcher-settings-field">
          Аргументы JVM
          <textarea
            className="launcher-settings-input launcher-settings-jvm"
            value={jvmArgs}
            placeholder={"Один аргумент на строку"}
            onChange={(event) => setJvmArgs(event.target.value)}
            onBlur={() => {
              void save([{ name: "jvmArgs", value: jvmArgs }]);
            }}
          />
        </label>
        <p className="launcher-settings-hint">
          -Xmx и -Xms задаёт ползунок памяти, эти строки не используются.
        </p>
      </section>

      <section className="launcher-settings-section launcher-settings-files">
        <h2 className="launcher-subtitle">Файлы</h2>
        <label className="launcher-check">
          <input
            className="launcher-check-input"
            type="checkbox"
            checked={(configs.disableDownload as boolean) ?? false}
            onChange={(e) => handleCheckboxChange(e.target.checked)}
          />
          Отключить проверку игровых файлов{" "}
          <span className="launcher-check-hint">Не рекомендуется</span>
        </label>
        <div className="launcher-settings-actions">
          <DownloadMcButton />
          <button
            type="button"
            className="launcher-restore"
            onClick={() => {
              void window.launcherAPI.openGameDir();
            }}
          >
            Открыть папку игры
          </button>
          <button
            type="button"
            className="launcher-restore"
            onClick={() => {
              void window.launcherAPI.openGameLogs();
            }}
          >
            Открыть логи
          </button>
        </div>
      </section>

      <section className="launcher-settings-section launcher-settings-about">
        <h2 className="launcher-subtitle">О лаунчере</h2>
        <p className="launcher-settings-line">
          Версия {info?.appVersion ?? "…"}
        </p>
        <button
          type="button"
          className="launcher-restore"
          onClick={() => {
            void window.launcherAPI.checkForUpdates();
          }}
        >
          Проверить обновления
        </button>
      </section>
    </main>
  );
}
