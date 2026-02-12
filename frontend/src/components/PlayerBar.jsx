import { usePlayer } from '../context/PlayerContext';

export default function PlayerBar() {
  const { current, playing, progress, duration, toggle, seek, stationMode } = usePlayer();
  if (!current) return null;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const isStationSync = !!stationMode;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-groove-700 bg-groove-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{current.title}</p>
          <p className="truncate text-sm text-gray-400">{current.artist}</p>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1">
          {!isStationSync && (
            <button
              type="button"
              onClick={toggle}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ray-500 text-white transition hover:bg-ray-400"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              ) : (
                <svg className="ml-0.5 h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
          )}
          {isStationSync && (
            <span className="text-xs text-ray-400">Live · synced</span>
          )}
          <div className="flex w-full max-w-md items-center gap-2 text-xs text-gray-500">
            <span className="font-mono w-10">{formatTime(progress)}</span>
            {isStationSync ? (
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-groove-600">
                <div className="h-full rounded-full bg-ray-500/70" style={{ width: `${pct}%` }} />
              </div>
            ) : (
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={progress}
                onChange={(e) => seek(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-groove-600 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ray-500"
              />
            )}
            <span className="font-mono w-10">{formatTime(duration)}</span>
          </div>
        </div>
        <div className="w-32 flex-shrink-0 text-right text-sm text-gray-500">
          {current.source === 'upload' && 'Upload'}
        </div>
      </div>
    </div>
  );
}

function formatTime(s) {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
