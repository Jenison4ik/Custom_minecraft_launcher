import { useEffect, useState } from "react";
import { Slider } from "@base-ui/react/slider";

interface InputRangeProps {
  maxVal: number;
  defVal: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}

export default function InputRange({
  maxVal,
  defVal,
  onChange,
  onCommit,
}: InputRangeProps) {
  const minVal = maxVal < 2048 ? Math.max(1, Math.floor(maxVal * 0.5)) : 2048;
  const safeMax = Math.max(maxVal, minVal);
  const [val, setVal] = useState(defVal.toString());

  useEffect(() => {
    setVal(defVal.toString());
  }, [defVal]);

  const numeric = Number.parseInt(val, 10);
  const sliderValue = Number.isFinite(numeric)
    ? Math.min(safeMax, Math.max(minVal, numeric))
    : minVal;

  function commit(next: number) {
    const clamped = Math.min(safeMax, Math.max(minVal, next));
    setVal(String(clamped));
    onCommit?.(clamped);
  }

  function readSlider(value: number | readonly number[]) {
    return typeof value === "number" ? value : value[0];
  }

  return (
    <div className="launcher-ram">
      <Slider.Root
        className="launcher-ram-slider"
        min={minVal}
        max={safeMax}
        step={1}
        disabled={maxVal <= 0}
        value={sliderValue}
        onValueChange={(value) => {
          const next = readSlider(value);
          setVal(String(next));
          onChange(next);
        }}
        onValueCommitted={(value) => commit(readSlider(value))}
      >
        <Slider.Control className="launcher-ram-control">
          <Slider.Track className="launcher-ram-track">
            <Slider.Indicator className="launcher-ram-range" />
            <Slider.Thumb className="launcher-ram-thumb" aria-label="Оперативная память" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <div className="launcher-ram-fields">
        <input
          className="launcher-ram-value"
          type="text"
          inputMode="numeric"
          value={val}
          aria-label="Память в мегабайтах"
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            setVal(digits.length > 0 ? String(Number.parseInt(digits, 10)) : "");
          }}
          onBlur={() => {
            const parsed = Number.parseInt(val, 10);
            commit(Number.isNaN(parsed) ? minVal : parsed);
          }}
        />
        <p className="launcher-ram-unit">MB</p>
      </div>
    </div>
  );
}
