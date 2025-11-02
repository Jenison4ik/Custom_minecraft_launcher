import "./styles/ErrorBox.scss";

interface ErrorBoxProps {
  message: string;
  isFade: boolean;
  type: "error" | "notification";
}
export default function ErrorBox({ message, isFade, type }: ErrorBoxProps) {
  return (
    <div className={`error-box ${isFade ? "fade" : ""} ${type}`}>
      <h2>{type === "error" ? "Error occurred" : "Notification!"}</h2>
      <p>{message}</p>
    </div>
  );
}
