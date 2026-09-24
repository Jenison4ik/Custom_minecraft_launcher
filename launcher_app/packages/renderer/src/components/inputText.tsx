interface InputTextProps {
  value: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

export default function InputText({ value, inputRef }: InputTextProps) {
  return (
    <label className="launcher-nickname">
      <span className="launcher-nickname-label">Ник</span>
      <input
        id="launcher-nickname"
        className="launcher-nickname-field"
        ref={inputRef}
        defaultValue={value}
        autoComplete="off"
        spellCheck={false}
        onKeyDown={(event) => {
          if (event.key.length !== 1 || event.ctrlKey || event.metaKey) return;
          const allowed =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_";
          if (!allowed.includes(event.key)) event.preventDefault();
        }}
      />
    </label>
  );
}
