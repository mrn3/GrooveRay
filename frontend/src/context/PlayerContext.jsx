import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { streamUrl } from '../api';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(new Audio());

  const play = useCallback((song) => {
    if (!song?.id) return;
    // Use stream URL for all tracks (backend serves placeholder for AI demo tracks)
    const url = song.file_path?.startsWith('http') ? song.file_path : streamUrl(song.id);
    const audio = audioRef.current;
    if (audio.src !== url) {
      audio.src = url;
      audio.load();
    }
    audio.play().catch(() => setPlaying(false));
    setCurrent(song);
    setPlaying(true);
  }, []);

  const pause = useCallback(() => {
    audioRef.current.pause();
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (!current) return;
    if (playing) {
      pause();
      return;
    }
    const audio = audioRef.current;
    const url = current.file_path?.startsWith('http') ? current.file_path : streamUrl(current.id);
    if (audio.src !== url) {
      audio.src = url;
      audio.load();
    }
    audio.play().then(() => setPlaying(true)).catch(() => {});
  }, [current, playing, pause]);

  React.useEffect(() => {
    const audio = audioRef.current;
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const seek = useCallback((t) => {
    audioRef.current.currentTime = t;
    setProgress(t);
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        current,
        playing,
        progress,
        duration,
        play,
        pause,
        toggle,
        seek,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
