import "./styles/TgButton.scss";

export default function TgButton({ link, className = "" }: { link: string, className?: string }) {
    function handleNavigate() {
        window.launcherAPI.openExternalUrl(link);
    }

    return (
        <button
            className={`tg-button ${className}`}
            onClick={handleNavigate}
        >
            <img src="./telegram.svg" alt="Telegram" />
            Присоединяйся в наш тг чат
        </button>
    );
}
