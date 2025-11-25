import "./styles/inputText.scss";

interface InputTextProps {
  placeholder: string;
  onChange?: (value: string) => void;
  value: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

export default function InputText({
  placeholder,
  value,
  onChange,
  inputRef,
}: InputTextProps) {
  return (
    <>
      <input
        className="nick-input"
        ref={inputRef}
        placeholder={placeholder}
        //onChange={e => onChange && onChange(e.target.value)}
        defaultValue={value}
        onKeyDown={(e) => {
          const allowedChars =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_";
          if (!allowedChars.includes(e.key) && e.key != "Backspace") {
            e.preventDefault();
          }
        }}
      />
    </>
  );
}
