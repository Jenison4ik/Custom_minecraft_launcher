interface ErrorBoxProps {
  message: string;
  isFade: boolean;
  type: "error" | "notification";
}
export default function ErrorBox({ message, isFade, type }: ErrorBoxProps) {
  return (
    <div
      className={`launcher-toast ${type === "error" ? "launcher-toast--error" : "launcher-toast--notice"}${isFade ? " launcher-toast--fade" : ""}`}
    >
      <h2 className="launcher-subtitle">
        {type === "error" ? "Error occurred" : "Notification!"}
      </h2>
      <p>{message}</p>
    </div>
  );
}
