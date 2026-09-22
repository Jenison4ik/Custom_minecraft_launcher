import React, { useState } from "react";
import { useEffect } from "react";

type LaunchButtonProps = {
  onClick: () => void;
};

export default function LaunchButton({ onClick }: LaunchButtonProps) {
  const [isGameRunning, setIsGameRunning] = useState<boolean>(false);

  useEffect(() => {
    if (!window.launcherAPI) return;
    const unsubscribe = window.launcherAPI.onMinecraft((status: boolean) => {
      setIsGameRunning(status);
    });

    return () => {
      unsubscribe(); // remove only this listener
    };
  }, []);

  return (
    <button onClick={onClick} disabled={isGameRunning} className="launcher-launch">
      {isGameRunning ? "В игре" : "Запустить игру"}
    </button>
  );
}
