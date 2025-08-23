import './styles/ErrorBox.scss';

interface ErrorBoxProps {
  message: string;
  isFade: boolean;
}
export default function ErrorBox({message,isFade,}: ErrorBoxProps) {
    return (
        <div className={`error-box ${isFade ? 'fade' : ''}`}>
        <h2>Error occurred</h2>
        <p>{message}</p>
        </div>
    );
}