import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function SettingsToggleButton() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleClick = () => {
    if (location.pathname === "/") {
      navigate("/settings"); // если уже на settings → возвращаем на главную
    } else {
      navigate("/"); // иначе переходим на settings
    }
  };

  return (
    <button className="button" onClick={handleClick}>
      <img
        src={location.pathname === "/" ? "./settings.svg" : "./home.svg"}
        alt=""
      />
    </button>
  );
}
