import { useState } from "react";

interface InputRangeProps {
  maxVal: number;
  inputRef?: React.Ref<HTMLInputElement>;
  defVal: number;
  onChange: (e:number)=> void;
}
export default function InputRange({ maxVal, inputRef, defVal, onChange }: InputRangeProps) {
    const [val,setVal] = useState(defVal);

    function handleVal():void{
      if(typeof val !== 'number'){
        setVal(minVal);
      }
    }

    const minVal = maxVal < 2048? Math.floor(maxVal*0.5) : 2048;
    return (
        <>
        <input
          ref={inputRef} 
          type="range"
          min={minVal} 
          max={maxVal} 
          value={val} 
          step='1'
          onChange={(e)=> {
            setVal(e.target.valueAsNumber);
            onChange(e.target.valueAsNumber)
          }}
          />
        <input
          type="number"
          min={minVal} 
          max={maxVal} 
          value={val} 
          step='1'
          onChange={(e)=> {
            console.log(e.target.value)
            if(e.target.value.length === 0){
              setVal(0)
              return
            }
            if(e.target.value[0] === '0' && e.target.value.length > 1){
              setVal(parseInt(e.target.value,10)+ 1);
              return
            }
            setVal(e.target.valueAsNumber)
          }}
          onBlur={(e)=> {
            const value = e.target.valueAsNumber;
            if(value < minVal || !value){
            setVal(minVal);
            onChange(minVal)
            return
            }else if(value > maxVal){
            setVal(maxVal);
            onChange(maxVal)
            return
            }
            onChange(e.target.valueAsNumber);
          }}
        />
        </>
    )

}