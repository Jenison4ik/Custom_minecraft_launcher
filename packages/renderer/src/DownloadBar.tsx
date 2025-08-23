import './styles/DownloadBar.scss';

export default function DownloadBar({ message, progress, isDownloading }: { message: string; progress: number,isDownloading:boolean }) {
    return (
        <div className={`download-bar ${isDownloading ? 'show' : ''}`}>
            <div className="download-progress-bar" style={{ width: `${progress}%` }}></div>
            <p className="download-message">{message}</p>
            <p className="download-progress">{progress}% </p>
        </div>
    );
}