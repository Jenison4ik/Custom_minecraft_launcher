import React, { useEffect, useState } from "react";
import type { LauncherInfo } from "@jenison/shared";
import { Checkbox } from "@base-ui/react/checkbox";
import { Select } from "@base-ui/react/select";
import { Switch } from "@base-ui/react/switch";
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

function ToggleRow({
  id,
  checked,
  onCheckedChange,
  children,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="launcher-check">
      <Switch.Root
        id={id}
        className="launcher-switch"
        checked={checked}
        onCheckedChange={onCheckedChange}
      >
        <Switch.Thumb className="launcher-switch-thumb" />
      </Switch.Root>
      <span className="launcher-check-label">{children}</span>
    </label>
  );
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

  return (
    <main className="launcher-page launcher-page--settings">
      <h1 className="launcher-title">Настройки</h1>

      <section className="launcher-settings-section launcher-settings-pack">
        <h2 className="launcher-subtitle">Сборка</h2>
        <p className="launcher-settings-line">
          Minecraft {info?.mcVersion || "не задана"}
          {info ? `, ${info.loader}` : ""}
          {info?.loaderVersion ? ` ${info.loaderVersion}` : ""}
        </p>
        {info && info.servers.length > 0 && (
          <ul className="launcher-settings-list">
            {info.servers.map((server) => (
              <li key={`${server.lable}-${server.ip}`}>
                {server.lable} - {server.ip}
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
          onChange={(value) => setLocalRam(value)}
          onCommit={(value) => onChange(value)}
        />
      </section>

      <section className="launcher-settings-section launcher-settings-window">
        <h2 className="launcher-subtitle">Окно игры</h2>
        <div className="launcher-settings-field">
          <label htmlFor="launcher-resolution">Разрешение</label>
          <Select.Root
            value={resolutionPreset}
            onValueChange={(next) => {
              if (next == null) return;
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
            <Select.Trigger
              id="launcher-resolution"
              className="launcher-settings-input launcher-select-trigger"
            >
              <Select.Value />
              <Select.Icon className="launcher-select-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M4 6.5 8 10.5 12 6.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner className="launcher-select-positioner" sideOffset={6}>
                <Select.Popup className="launcher-select-content">
                  <Select.List>
                    {PRESETS.map((preset) => (
                      <Select.Item
                        key={preset.id}
                        className="launcher-select-item"
                        value={preset.id}
                      >
                        <Select.ItemText>{preset.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                    <Select.Item className="launcher-select-item" value="custom">
                      <Select.ItemText>Своё</Select.ItemText>
                    </Select.Item>
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
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
        <ToggleRow
          id="launcher-fullscreen"
          checked={configs.fullscreen === true}
          onCheckedChange={(checked) => {
            void save([{ name: "fullscreen", value: checked }]);
          }}
        >
          Полный экран
        </ToggleRow>
      </section>

      <section className="launcher-settings-section launcher-settings-launch">
        <h2 className="launcher-subtitle">Запуск</h2>
        <ToggleRow
          id="launcher-close-on-launch"
          checked={configs.closeOnLaunch === true}
          onCheckedChange={(checked) => {
            void save([{ name: "closeOnLaunch", value: checked }]);
          }}
        >
          Закрывать лаунчер после старта игры
        </ToggleRow>
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
            placeholder="Один аргумент на строку"
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
          <Checkbox.Root
            id="launcher-disable-download"
            className="launcher-check-input"
            checked={(configs.disableDownload as boolean) ?? false}
            onCheckedChange={(checked) => {
              void save([{ name: "disableDownload", value: checked === true }]);
            }}
          >
            <Checkbox.Indicator className="launcher-check-mark" />
          </Checkbox.Root>
          <span className="launcher-check-label">
            Отключить проверку игровых файлов
          </span>
        </label>
        <p className="launcher-check-hint">Не рекомендуется</p>
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
