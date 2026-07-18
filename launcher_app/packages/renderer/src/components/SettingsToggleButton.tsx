import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function SettingsToggleButton() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleClick = () => {
    if (location.pathname === "/") {
      navigate("/settings"); // on home → go to settings
    } else {
      navigate("/"); // otherwise → go home
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
