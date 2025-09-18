import InputRange from "./inputRam";
import { useState, useEffect } from "react";
import "./styles/Settings.scss";

type Config = {
  name: string;
  value: any;
};

export default function Settings({
  configs,
  usingmem,
  totalmem,
  onChange,
}: {
  configs: any;
  usingmem: number;
  totalmem: number;
  onChange: (value: number) => void;
}) {
  const [checked, setChecked] = useState(configs.disableDownload ?? false);
  return (
    <main>
      <h1>Настройки</h1>
      <h2>Оперативная память</h2>
      <InputRange
        defVal={
          typeof configs.ram !== "number" || configs.ram > totalmem
            ? Math.floor(totalmem * 0.6)
            : configs.ram
        }
        maxVal={totalmem}
        onChange={onChange}
      />
      <label>
        <input
          type="checkbox"
          onChange={(e) => {
            const target = e.target as HTMLInputElement; // каст к HTMLInputElement
            const checked = target.checked;
            setChecked(checked);
            window.launcherAPI.addToConfigs([
              { name: "disableDownload", value: checked },
            ]);
          }}
          checked={checked}
        />
        Отключить проверку игровых файлов <span>Не рекомендуется</span>
      </label>
    </main>
  );
}
