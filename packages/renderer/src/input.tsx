interface InputText {
   placeholder: string,
   onChange: (value:string) => void,
}

 export default function InputText({placeholder, onChange}: InputText){
    return (<>
        <input placeholder={placeholder} onChange={(e)=> onChange(e.target.value)}/>
    </>)
 }