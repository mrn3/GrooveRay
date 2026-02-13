import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { streamUrl, songs as songsApi } from '../api';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [stationMode, setStationModeState] = useState(null);
  const [, setTick] = useState(0);
  const audioRef = useRef(new Audio());
  const pendingSeekRef = useRef(null);

  const setStationMode = useCallback((mode) => {
    setStationModeState(mode);
  }, []);

  useEffect(() => {
    if (!stationMode) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [stationMode]);

  const play = useCallback((song, options = {}) => {
    if (!song?.id) return;
    songsApi.recordPlay(song.id).catch(() => {});
    // Use stream URL for all tracks
    const url = song.file_path?.startsWith('http') ? song.file_path : streamUrl(song.id);
    const audio = audioRef.current;
    const seekTo = options.seekTo != null ? Number(options.seekTo) : null;
    if (audio.src !== url) {
      if (seekTo != null) pendingSeekRef.current = seekTo;
      audio.src = url;
      audio.load();
    } else if (seekTo != null && audio.readyState >= 2) {
      audio.currentTime = seekTo;
      setProgress(seekTo);
    } else if (seekTo != null) {
      pendingSeekRef.current = seekTo;
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
    const onCanPlay = () => {
      const t = pendingSeekRef.current;
      if (t != null && Number.isFinite(t)) {
        pendingSeekRef.current = null;
        audio.currentTime = t;
        setProgress(t);
      }
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('canplay', onCanPlay);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('canplay', onCanPlay);
    };
  }, []);

  const seek = useCallback((t) => {
    audioRef.current.currentTime = t;
    setProgress(t);
  }, []);

  const effectiveProgress = stationMode ? (() => {
    const start = new Date(stationMode.startedAt).getTime() / 1000;
    const elapsed = Date.now() / 1000 - start;
    const dur = Number(stationMode.durationSeconds) || 60;
    return Math.min(Math.max(0, elapsed), dur);
  })() : progress;

  const effectiveDuration = stationMode ? (Number(stationMode.durationSeconds) || 60) : duration;

  return (
    <PlayerContext.Provider
      value={{
        current,
        playing,
        progress: effectiveProgress,
        duration: effectiveDuration,
        stationMode,
        play,
        pause,
        toggle,
        seek,
        setStationMode,
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
