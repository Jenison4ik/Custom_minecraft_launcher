import ErrorBox from "./ErrorBox";
import './styles/ErrorToasts.scss';
import { useState,useEffect } from "react";



export default function ErrorToasts() {
    const [errors, setErrors] = useState<{id:number; message: string, isFade:boolean}[]>([]);

    useEffect(() => {//Обработчик ошибок
        window.launcherAPI.onError((message) => {
          const newErrorId = Math.random();
          setErrors((prevErrors) => [{ id: newErrorId, message, isFade:false }, ...prevErrors]);
          console.error("Error received from API: ", message);
    
    
          setTimeout(() => {
            setErrors((prevErrors) =>{
              return prevErrors.map((error) => {
                if (error.id === newErrorId) {
                  return { ...error, isFade: true };
                }
                return error;
              });
            });
    
          setTimeout(()=>{setErrors((prevErrors) => prevErrors.filter((error) => error.id !== newErrorId));},700)}, 5000)
        });
        return () => { // Отменяем подписку на ошибки при размонтировании компонента
          window.launcherAPI.onError(() => {});
        }
      }, []);

     return (
        <div className="error-toasts">
            {errors.map((error) => (
                <ErrorBox key={error.id} message={error.message} isFade={error.isFade} />
            ))}
        </div>
     )
}