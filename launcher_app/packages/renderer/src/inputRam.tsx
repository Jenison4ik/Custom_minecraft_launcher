import { useState } from "react";

interface InputRangeProps {
  maxVal: number;
  inputRef?: React.Ref<HTMLInputElement>;
  defVal: number;
  onChange: (e: number) => void;
}
export default function InputRange({
  maxVal,
  inputRef,
  defVal,
  onChange,
}: InputRangeProps) {
  const [val, setVal] = useState(defVal.toString());

  const minVal = maxVal < 2048 ? Math.floor(maxVal * 0.5) : 2048;
  return (
    <div className="ram-select">
      <input
        ref={inputRef}
        type="range"
        min={minVal}
        max={maxVal}
        value={val}
        step="1"
        onChange={(e) => {
          setVal(e.target.value);
          onChange(e.target.valueAsNumber);
        }}
      />
      <div className="ram-box-wrap">
        <input
          className="ram-box"
          type="text"
          min={minVal}
          max={maxVal}
          value={val}
          step="1"
          onChange={(e) => {
            let target = e.target.value;

            target = target.replace(/\D/g, "");

            if (target.length > 0) {
              target = String(parseInt(target, 10));
            }
            setVal(target);
          }}
          onBlur={(e) => {
            const value = parseInt(val, 10);
            if (value < minVal || isNaN(value)) {
              setVal(minVal.toString());
              onChange(minVal);
              return;
            } else if (value > maxVal) {
              setVal(maxVal.toString());
              onChange(maxVal);
              return;
            }
            onChange(value);
          }}
        />
        <p>MB</p>
      </div>
    </div>
  );
}
