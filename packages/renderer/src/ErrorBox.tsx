import './styles/ErrorBox.scss';

interface ErrorBoxProps {
  message: string;
}
export default function ErrorBox({message}: ErrorBoxProps) {
    return (
        <div className="error-box">
        <p>{message}</p>
        </div>
    );
}