import { useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { selfHostedImageUrl } from '../utils/images';
import ArtistLink from './ArtistLink';

export default function PlayerBar() {
  const {
    current,
    playing,
    progress,
    duration,
    toggle,
    seek,
    stationMode,
    playlistContext,
    volume,
    muted,
    setVolume,
    toggleMute,
    skipBack,
    skipForward,
    playNext,
    playPrevious,
    exit,
  } = usePlayer();

  useEffect(() => {
    if (!current || stationMode) return;
    const onKeyDown = (e) => {
      if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        skipBack();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        skipForward();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, stationMode, skipBack, skipForward]);

  if (!current) return null;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const isStationSync = !!stationMode;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-groove-700 bg-groove-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <button
          type="button"
          onClick={exit}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-groove-600 hover:text-white"
          aria-label="Close player"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700 text-ray-400">
          {selfHostedImageUrl(current.thumbnail_url) ? (
            <img src={selfHostedImageUrl(current.thumbnail_url)} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg">◇</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{current.title}</p>
          <p className="truncate text-sm text-gray-400"><ArtistLink artist={current.artist} className="text-sm" /></p>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            {playlistContext && (
              <button
                type="button"
                onClick={playPrevious}
                disabled={!playlistContext.currentIndex}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition hover:bg-groove-600 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                aria-label="Previous track"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
              </button>
            )}
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
            {playlistContext && (
              <button
                type="button"
                onClick={playNext}
                disabled={playlistContext.currentIndex >= (playlistContext.tracks?.length ?? 0) - 1}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition hover:bg-groove-600 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                aria-label="Next track"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18V6l2 1.2v9.6L6 18zm3.5-6l8.5-6v12l-8.5-6z" /></svg>
              </button>
            )}
          </div>
          {isStationSync && (
            <span className="text-xs text-ray-400">Live · synced</span>
          )}
          {playlistContext?.tracks?.length > 0 && (
            <div className="text-xs text-gray-500">
              Track {((playlistContext.currentIndex ?? 0) + 1)} of {playlistContext.tracks.length}
              {' · '}
              {formatPlaylistTime(playlistContext, progress, duration)}
            </div>
          )}
          <div className="flex w-full max-w-md items-center gap-2 text-xs text-gray-500">
            {!isStationSync && (
              <button
                type="button"
                onClick={skipBack}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-groove-600 hover:text-white"
                aria-label="Back 10 seconds"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" /></svg>
              </button>
            )}
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
            {!isStationSync && (
              <button
                type="button"
                onClick={skipForward}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-groove-600 hover:text-white"
                aria-label="Forward 10 seconds"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" /></svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex w-48 flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-groove-600 hover:text-white"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-groove-600 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ray-500"
            aria-label="Volume"
          />
          <span className="w-20 text-right text-sm text-gray-500">
            {current.source === 'upload' && 'Upload'}
          </span>
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

function formatPlaylistTime(ctx, currentProgress, currentDuration) {
  const tracks = ctx?.tracks ?? [];
  const idx = ctx?.currentIndex ?? 0;
  let elapsed = 0;
  for (let i = 0; i < idx; i++) {
    elapsed += Number(tracks[i]?.duration_seconds) || 0;
  }
  elapsed += currentProgress;
  let total = 0;
  for (const t of tracks) {
    total += Number(t?.duration_seconds) || 0;
  }
  if (total <= 0) total = 1;
  return `${formatTime(elapsed)} / ${formatTime(total)}`;
}
