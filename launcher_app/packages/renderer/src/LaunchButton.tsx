import React, { useState } from "react";
import { useEffect } from "react";
import "./styles/LaunchButton.scss";

type LaunchButtonProps = {
  onClick: () => void;
};

export default function LaunchButton({ onClick }: LaunchButtonProps) {
  const [isGameRunning, setIsGameRunning] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = window.launcherAPI.onMinecraft((status: boolean) => {
      setIsGameRunning(status);
    });

    return () => {
      unsubscribe(); // снимаем только этот listener
    };
  }, []);

  return (
    <button onClick={onClick} disabled={isGameRunning} className="load-btn">
      {isGameRunning ? "В игре" : "Запустить игру"}
    </button>
  );
}
