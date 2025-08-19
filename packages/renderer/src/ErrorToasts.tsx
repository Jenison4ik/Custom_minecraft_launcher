import ErrorBox from "./ErrorBox";
import './styles/ErrorToasts.scss';
interface ErrorToastsProps{
    errors: {id:number; message: string}[];
}


export default function ErrorToasts({errors}: ErrorToastsProps) {
     return (
        <div className="error-toasts">
            {errors.map((error) => (
                <ErrorBox key={error.id} message={error.message} />
            ))}
        </div>
     )
}