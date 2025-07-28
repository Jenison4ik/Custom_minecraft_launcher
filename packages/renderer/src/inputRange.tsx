interface InputRangeProps {
  maxVal: number;
  inputRef?: React.Ref<HTMLInputElement>;
  defVal: number;
  onChange: (e:number)=> void;
}
export default function InputRange({ maxVal, inputRef, defVal, onChange }: InputRangeProps) {
    return (
        <>
        <input
          ref={inputRef} 
          type="range"
          min={maxVal < 2048? Math.floor(maxVal*0.5) : 2048} 
          max={maxVal} 
          defaultValue={defVal} 
          step='1'
          onChange={(e)=> onChange(Number(e.target.value))}
          >
        </input>
        </>
    )

}