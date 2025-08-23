import './styles/DownloadBar.scss';

export default function DownloadBar({ message, progress }: { message: string; progress: number }) {
    return (
        <div className="download-bar">
            <div className="download-progress-bar" style={{ width: `${progress}%` }}></div>
            <p className="download-message">{message}</p>
            <p className="download-progress">{progress} </p>
        </div>
    );
}