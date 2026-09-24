import { useRef } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import InputText from "./inputText";
import ErrorToasts from "./ErrorToasts";
import DownloadBar from "./DownloadBar";
import LaunchButton from "./LaunchButton";
import SettingsToggleButton from "./SettingsToggleButton";

export default function Layout({
  configs,
  usingmem,
}: {
  configs: Record<string, unknown>;
  usingmem: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleRunMinecraft(): Promise<void> {
    try {
      const nickname = inputRef.current?.value ?? "Steve";
      window.launcherAPI.addToConfigs([
        { name: "nickname", value: nickname },
        { name: "ram", value: usingmem || 2048 },
      ]);
      await window.launcherAPI.runMinecraft();
    } catch (error) {
      console.log(error);
    }
  }

  return (
    <>
      <ErrorToasts />
      <DownloadBar />
      <div className="launcher-controls">
        <LaunchButton onClick={handleRunMinecraft} />
        <InputText
          value={(configs["nickname"] as string) ?? "Steve"}
          inputRef={inputRef}
        />
        <div className="launcher-toolbar">
          <SettingsToggleButton />
          <Tooltip.Root>
            <Tooltip.Trigger
              type="button"
              title="Папка лаунчера"
              aria-label="Папка лаунчера"
              onClick={() => {
                void window.launcherAPI?.openLauncherDir();
              }}
              className="launcher-icon-button launcher-icon-button--folder"
            >
              <img src="./folder.svg" alt="" />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner className="launcher-tooltip-positioner" side="top" sideOffset={8}>
                <Tooltip.Popup className="launcher-tooltip">Папка лаунчера</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>
      </div>
    </>
  );
}
