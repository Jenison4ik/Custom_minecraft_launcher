interface InputText {
   placeholder: string,
   onChange?: (value:string) => void,
   value: string,
   inputRef?: React.Ref<HTMLInputElement>
}

 export default function InputText({placeholder, value, onChange, inputRef}: InputText){
    return (<>
       <input
      ref={inputRef}
      placeholder={placeholder}
      //onChange={e => onChange && onChange(e.target.value)}
      defaultValue={value}
    />
    </>)
 }