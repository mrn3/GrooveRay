import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { streamUrl, songs as songsApi } from '../api';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [stationMode, setStationModeState] = useState(null);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMutedState] = useState(false);
  const [, setTick] = useState(0);
  const audioRef = useRef(new Audio());
  const pendingSeekRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  const setStationMode = useCallback((mode) => {
    setStationModeState(mode);
  }, []);

  /** For Music Video stations: show current track and synced progress in the bar without playing audio. */
  const setStationVideoDisplay = useCallback((song, mode) => {
    setCurrent(song ?? null);
    setStationModeState(mode ?? null);
    if (!mode) {
      setPlaying(false);
      setProgress(0);
      setDuration(0);
    }
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

  const setVolume = useCallback((v) => {
    const val = Math.max(0, Math.min(1, Number(v)));
    setVolumeState(val);
    if (val > 0) setMutedState(false);
  }, []);

  const setMuted = useCallback((m) => {
    setMutedState(!!m);
  }, []);

  const toggleMute = useCallback(() => {
    setMutedState((m) => !m);
  }, []);

  const skipBack = useCallback(() => {
    const audio = audioRef.current;
    const t = Math.max(0, (audio.currentTime || 0) - 10);
    audio.currentTime = t;
    setProgress(t);
  }, []);

  const skipForward = useCallback(() => {
    const audio = audioRef.current;
    const dur = audio.duration || 0;
    const t = Math.min(dur, (audio.currentTime || 0) + 10);
    audio.currentTime = t;
    setProgress(t);
  }, []);

  /** Stop playback, clear audio source, and reset all player state (e.g. for exit). */
  const exit = useCallback(() => {
    const audio = audioRef.current;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    pendingSeekRef.current = null;
    setCurrent(null);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setStationModeState(null);
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
        volume,
        muted,
        setVolume,
        setMuted,
        toggleMute,
        play,
        pause,
        toggle,
        seek,
        skipBack,
        skipForward,
        exit,
        setStationMode,
        setStationVideoDisplay,
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
