import { useLocation, useNavigate } from "react-router-dom";
import { Tooltip } from "@base-ui/react/tooltip";

export default function SettingsToggleButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const onHome = location.pathname === "/";
  const label = onHome ? "Настройки" : "На главную";

  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        type="button"
        className="launcher-icon-button launcher-icon-button--settings"
        aria-label={label}
        onClick={() => navigate(onHome ? "/settings" : "/")}
      >
        <img src={onHome ? "./settings.svg" : "./home.svg"} alt="" />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner className="launcher-tooltip-positioner" side="top" sideOffset={8}>
          <Tooltip.Popup className="launcher-tooltip">{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
