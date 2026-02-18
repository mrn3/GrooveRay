import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { stations as stationsApi, songs as songsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';

function serverPosition(startedAt, durationSeconds) {
  const start = new Date(startedAt).getTime() / 1000;
  const elapsed = Date.now() / 1000 - start;
  const duration = Number(durationSeconds) || 60;
  return Math.min(Math.max(0, elapsed), duration);
}

export default function Station() {
  const { slugOrId } = useParams();
  const navigate = useNavigate();
  const [station, setStation] = useState(null);
  const [queue, setQueue] = useState([]);
  const [songs, setSongs] = useState([]);
  const [addSongId, setAddSongId] = useState('');
  const [addSongInput, setAddSongInput] = useState('');
  const [addSongOpen, setAddSongOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const addSongRef = useRef(null);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [nowPlayingDetails, setNowPlayingDetails] = useState(null);
  const [ratingId, setRatingId] = useState(null);
  const [stationRatingSaving, setStationRatingSaving] = useState(false);
  const [listeners, setListeners] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [mentionAt, setMentionAt] = useState(null);
  const [mentionFilter, setMentionFilter] = useState('');
  const chatCursorRef = useRef(0);
  const chatEndRef = useRef(null);
  const chatListRef = useRef(null);
  const chatInputRef = useRef(null);
  const [editImageOpen, setEditImageOpen] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const [addToQueueError, setAddToQueueError] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const socketRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const [youtubeApiReady, setYoutubeApiReady] = useState(false);
  const { user } = useAuth();
  const { play, setStationMode, setStationVideoDisplay } = usePlayer();
  const isOwner = user?.id === station?.owner_id;
  const isMusicVideo = station?.type === 'music_video';

  useEffect(() => {
    stationsApi.get(slugOrId).then((s) => {
      setStation(s);
      return Promise.all([
        stationsApi.queue(s.id),
        stationsApi.nowPlaying(s.id),
        stationsApi.getChat(s.id).then((data) => (data?.items ?? [])),
      ]);
    }).then(([q, np, chat]) => {
      setQueue(q);
      setNowPlaying(np);
      setChatMessages(chat);
    }).catch(() => setStation(null)).finally(() => setLoading(false));
  }, [slugOrId]);

  useEffect(() => {
    songsApi.listPublic({ limit: 200 }).then((data) => setSongs(data?.items ?? [])).catch(() => setSongs([]));
  }, []);

  useEffect(() => {
    if (!station?.id) return;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('grooveray_token') : null;
    const socket = io(undefined, { path: '/socket.io', auth: { token } });
    socketRef.current = socket;
    socket.emit('station:subscribe', station.id);
    socket.on('queue', setQueue);
    socket.on('nowPlaying', setNowPlaying);
    socket.on('listeners', setListeners);
    socket.on('chat', (msg) => setChatMessages((prev) => [...prev, msg]));
    return () => {
      socket.emit('station:unsubscribe', station.id);
      socket.off('queue');
      socket.off('nowPlaying');
      socket.off('listeners');
      socket.off('chat');
      socket.close();
      setStationMode(null);
      setStationVideoDisplay(null, null);
      setListeners([]);
    };
  }, [station?.id, setStationMode, setStationVideoDisplay]);

  useEffect(() => {
    if (!nowPlaying?.item) {
      setStationMode(null);
      setStationVideoDisplay(null, null);
      setNowPlayingDetails(null);
      return;
    }
    const item = nowPlaying.item;
    const song = { id: item.song_id, title: item.title, artist: item.artist, source: item.source, file_path: item.file_path, thumbnail_url: item.thumbnail_url, duration_seconds: item.duration_seconds, youtube_id: item.youtube_id };
    const pos = serverPosition(nowPlaying.startedAt, item.duration_seconds);
    const mode = { startedAt: nowPlaying.startedAt, durationSeconds: item.duration_seconds ?? 60 };
    if (isMusicVideo && item.youtube_id) {
      setStationVideoDisplay(song, mode);
    } else {
      setStationMode(mode);
      play(song, { seekTo: pos });
    }
  }, [nowPlaying?.queueId, nowPlaying?.startedAt, isMusicVideo, play, setStationMode, setStationVideoDisplay]);

  useEffect(() => {
    if (!nowPlaying?.item?.song_id) {
      setNowPlayingDetails(null);
      return;
    }
    songsApi.get(nowPlaying.item.song_id).then(setNowPlayingDetails).catch(() => setNowPlayingDetails(null));
  }, [nowPlaying?.item?.song_id]);

  const handleVote = (queueId) => {
    if (!station) return;
    stationsApi.vote(station.id, queueId).then((updated) => {
      setQueue((prev) => prev.map((q) => (q.id === queueId ? updated : q)).sort((a, b) => (b.votes || 0) - (a.votes || 0)));
    }).catch(() => {});
  };

  const handleNowPlayingRating = async (e, rating) => {
    if (!nowPlaying?.item?.song_id || !nowPlayingDetails) return;
    e.stopPropagation();
    setRatingId(nowPlaying.item.song_id);
    try {
      await songsApi.setRating(nowPlaying.item.song_id, rating);
      setNowPlayingDetails((prev) => (prev ? { ...prev, rating } : null));
    } catch (_) {}
    finally {
      setRatingId(null);
    }
  };

  const handleStationRating = async (e, rating) => {
    if (!station) return;
    e.stopPropagation();
    setStationRatingSaving(true);
    try {
      await stationsApi.setRating(station.id, rating);
      setStation((prev) => (prev ? { ...prev, rating } : null));
    } catch (_) {}
    finally {
      setStationRatingSaving(false);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    const msg = chatInput.trim();
    if (!msg || !station?.id || !socketRef.current) return;
    if (!user) return;
    socketRef.current.emit('station:chat', { stationId: station.id, message: msg });
    setChatInput('');
    setMentionAt(null);
  };

  const insertMention = (username) => {
    const start = mentionAt ?? 0;
    const end = chatCursorRef.current;
    const prefix = chatInput.slice(0, start);
    const suffix = chatInput.slice(end);
    setChatInput(`${prefix}@${username} ${suffix}`);
    setMentionAt(null);
    setMentionFilter('');
  };

  const handleChatInputChange = (e) => {
    const v = e.target.value;
    const pos = e.target.selectionStart ?? v.length;
    setChatInput(v);
    chatCursorRef.current = pos;
    const lastAt = v.lastIndexOf('@');
    if (lastAt !== -1 && lastAt <= pos) {
      const after = v.slice(lastAt + 1, pos);
      if (!/\s/.test(after)) {
        setMentionAt(lastAt);
        setMentionFilter(after.toLowerCase());
        return;
      }
    }
    setMentionAt(null);
    setMentionFilter('');
  };

  const mentionSuggestions = mentionAt !== null && listeners.length > 0
    ? listeners.filter((l) => l.username?.toLowerCase().startsWith(mentionFilter))
    : [];

  const handleAddToQueue = async (e) => {
    e.preventDefault();
    if (!station || !addSongId) return;
    setAddToQueueError('');
    try {
      await stationsApi.addToQueue(station.id, addSongId);
      const q = await stationsApi.queue(station.id);
      setQueue(q);
      setAddSongId('');
      setAddSongInput('');
    } catch (err) {
      setAddToQueueError(err.message || err.error || 'Failed to add to queue');
    }
  };

  const handleDeleteStation = async () => {
    if (!station) return;
    setDeleting(true);
    try {
      await stationsApi.delete(station.id);
      navigate('/stations');
    } catch (_) {
      setDeleting(false);
    }
  };

  const query = addSongInput.trim().toLowerCase();
  const songsForSuggestions = isMusicVideo ? songs.filter((s) => s.youtube_id) : songs;
  const suggestions = query
    ? songsForSuggestions.filter(
        (s) =>
          (s.title || '').toLowerCase().includes(query) ||
          (s.artist || '').toLowerCase().includes(query)
      ).slice(0, 8)
    : [];

  // Load YouTube IFrame API once
  useEffect(() => {
    if (window.YT?.Player) {
      setYoutubeApiReady(true);
      return;
    }
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const check = () => {
        if (window.YT?.Player) setYoutubeApiReady(true);
        else setTimeout(check, 100);
      };
      check();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(tag, first);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      setYoutubeApiReady(true);
    };
    return () => {
      window.onYouTubeIframeAPIReady = prev;
    };
  }, []);

  // YouTube embed: create/destroy player and sync to server position for Music Video stations
  const youtubeId = isMusicVideo && nowPlaying?.item?.youtube_id ? nowPlaying.item.youtube_id : null;
  useEffect(() => {
    if (!youtubeId || !youtubeApiReady || !window.YT?.Player) return;
    const container = document.getElementById('station-youtube-embed');
    if (!container || container.querySelector('iframe')) return;
    const startSec = serverPosition(nowPlaying.startedAt, nowPlaying.item.duration_seconds);
    const player = new window.YT.Player('station-youtube-embed', {
      videoId: youtubeId,
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        start: Math.floor(startSec),
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      },
      events: {
        onReady(ev) {
          ev.target.seekTo(startSec, true);
          ev.target.playVideo();
        },
      },
    });
    youtubePlayerRef.current = player;
    const syncInterval = setInterval(() => {
      const p = youtubePlayerRef.current;
      if (!p?.seekTo || !nowPlaying?.startedAt) return;
      const pos = serverPosition(nowPlaying.startedAt, nowPlaying.item.duration_seconds);
      const dur = Number(nowPlaying.item.duration_seconds) || 60;
      if (pos >= dur - 1) return;
      try {
        const current = p.getCurrentTime?.();
        if (typeof current === 'number' && Math.abs(current - pos) > 3) p.seekTo(pos, true);
      } catch (_) {}
    }, 5000);
    return () => {
      clearInterval(syncInterval);
      if (youtubePlayerRef.current?.destroy) youtubePlayerRef.current.destroy();
      youtubePlayerRef.current = null;
    };
  }, [youtubeId, youtubeApiReady, nowPlaying?.startedAt, nowPlaying?.item?.duration_seconds]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  useEffect(() => {
    function handleClickOutside(ev) {
      if (addSongRef.current && !addSongRef.current.contains(ev.target)) {
        setAddSongOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" /></div>;
  if (!station) return <p className="text-red-400">Station not found</p>;

  const queueWithoutNowPlaying = nowPlaying?.queueId
    ? queue.filter((item) => item.id !== nowPlaying.queueId)
    : queue;

  const showHeroVideo = isMusicVideo && nowPlaying?.item?.youtube_id;

  return (
    <div>
      {/* Hero video area: large and centered when a music video is playing */}
      {showHeroVideo && (
        <div className="mb-8">
          <div className="mx-auto w-full max-w-5xl">
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl" style={{ minHeight: 320 }}>
              <div id="station-youtube-embed" className="h-full w-full" />
            </div>
            {nowPlaying?.item && (
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-groove-700">
                  {nowPlaying.item.thumbnail_url ? (
                    <img src={nowPlaying.item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xl text-ray-400">◇</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-white">{nowPlaying.item.title}</p>
                  <p className="text-sm text-gray-400">{nowPlaying.item.artist}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-8 flex items-center gap-4">
            <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-groove-700 text-3xl text-ray-500">
              {station.image_url ? (
                <img src={station.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>◇</span>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setEditImageUrl(station.image_url || '');
                    setEditImageOpen(true);
                  }}
                  className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 text-sm font-medium text-white opacity-0 transition hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ray-500"
                  title="Edit image"
                >
                  Edit image
                </button>
            )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white">{station.name}</h1>
              {station.description && <p className="text-gray-400">{station.description}</p>}
              <p className="text-sm text-gray-500">by {station.owner_name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gray-500">Station rating:</span>
                {station.community_rating_count > 0 && (
                  <span className="text-amber-400">
                    {Number(station.community_avg_rating).toFixed(1)} ★ ({station.community_rating_count})
                  </span>
                )}
                {user && (
                  <span onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        aria-label={`Rate station ${star} star${star > 1 ? 's' : ''}`}
                        disabled={stationRatingSaving}
                        className="rounded p-0.5 transition focus:outline-none focus:ring-2 focus:ring-ray-500 disabled:opacity-50"
                        onClick={(e) => handleStationRating(e, star)}
                      >
                        <span className={(station.rating ?? 0) >= star ? 'text-amber-400' : 'text-gray-500 hover:text-amber-500'}>★</span>
                      </button>
                    ))}
                  </span>
                )}
              </div>
            </div>
          </div>
          {editImageOpen && isOwner && (
            <div className="mb-6 rounded-xl border border-groove-700 bg-groove-900/50 p-4">
              <h3 className="mb-2 text-sm font-medium text-white">Station image</h3>
              <p className="mb-3 text-xs text-gray-400">Enter an image URL (e.g. from Imgur, or a direct link to an image).</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="url"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="https://…"
                  className="min-w-0 flex-1 rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                />
                <button
                  type="button"
                  onClick={async () => {
                    setSavingImage(true);
                    try {
                      const updated = await stationsApi.update(station.id, { image_url: editImageUrl || null });
                      setStation(updated);
                      setEditImageOpen(false);
                    } finally {
                      setSavingImage(false);
                    }
                  }}
                  disabled={savingImage}
                  className="rounded-lg bg-ray-600 px-4 py-2 font-medium text-white hover:bg-ray-500 disabled:opacity-50"
                >
                  {savingImage ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditImageOpen(false);
                    setEditImageUrl(station.image_url || '');
                  }}
                  className="rounded-lg border border-groove-600 px-4 py-2 text-gray-300 hover:bg-groove-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isOwner && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="text-sm text-red-400 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
              >
                Delete station
              </button>
            </div>
          )}

          {deleteConfirmOpen && (
            <div className="mb-6 rounded-xl border border-red-900/50 bg-groove-900/80 p-4">
              <p className="text-white mb-3">Permanently delete this station? Queue, chat, and ratings will be removed. This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDeleteStation}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => { setDeleteConfirmOpen(false); setDeleting(false); }}
                  disabled={deleting}
                  className="rounded-lg border border-groove-600 px-4 py-2 text-gray-300 hover:bg-groove-700 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <section>
            <h2 className="mb-3 text-lg font-medium text-white">Add song to queue</h2>
            {isMusicVideo && (
              <p className="mb-2 text-sm text-gray-400">Only songs with a YouTube video can be added to this station.</p>
            )}
            {addToQueueError && (
              <p className="mb-2 text-sm text-red-400">{addToQueueError}</p>
            )}
            <form onSubmit={handleAddToQueue} className="flex gap-2">
              <div ref={addSongRef} className="relative flex-1 min-w-0 max-w-md">
                <input
                  type="text"
                  value={addSongInput}
                  onChange={(e) => {
                    setAddSongInput(e.target.value);
                    setAddSongOpen(true);
                    setAddSongId('');
                  }}
                  onFocus={() => setAddSongOpen(true)}
                  placeholder="Search by song or artist…"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                  autoComplete="off"
                />
                {addSongOpen && suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-groove-600 bg-groove-800 py-1 shadow-lg">
                    {suggestions.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setAddSongId(s.id);
                            setAddSongInput(`${s.title} — ${s.artist}`);
                            setAddSongOpen(false);
                          }}
                          className="w-full px-4 py-2 text-left text-white hover:bg-groove-600 focus:bg-groove-600 focus:outline-none"
                        >
                          <span className="font-medium">{s.title}</span>
                          <span className="text-gray-400"> — {s.artist}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button type="submit" disabled={!addSongId} className="rounded-lg bg-ray-600 px-4 py-2 font-medium text-white hover:bg-ray-500 disabled:opacity-50 shrink-0">
                Add to queue
              </button>
            </form>
          </section>
        </div>

        <section className="w-full shrink-0 rounded-xl border border-groove-700 bg-groove-900/50 lg:w-80">
          <h2 className="border-b border-groove-700 px-4 py-3 text-lg font-medium text-white">Now playing</h2>
          {nowPlaying?.item ? (
            <div className="p-4">
              {/* Video is shown in hero area when music video; only track info here */}
              <div className="flex gap-4">
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700 text-ray-400">
                  {nowPlaying.item.thumbnail_url ? (
                    <img src={nowPlaying.item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl">◇</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{nowPlaying.item.title}</p>
                  <p className="text-sm text-gray-400">{nowPlaying.item.artist}</p>
                </div>
              </div>
              {nowPlayingDetails && (
                <dl className="mt-4 space-y-2 border-t border-groove-700 pt-4 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">My listens</dt>
                    <dd className="text-gray-300">{(nowPlayingDetails.listen_count ?? 0) > 0 ? nowPlayingDetails.listen_count : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Listens by everyone</dt>
                    <dd className="text-gray-300">{(nowPlayingDetails.total_listen_count ?? 0) > 0 ? nowPlayingDetails.total_listen_count : '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Overall rating</dt>
                    <dd className="text-gray-300">
                      {nowPlayingDetails.community_rating_count > 0 ? (
                        <span className="text-amber-400">{Number(nowPlayingDetails.community_avg_rating).toFixed(1)} ★ ({nowPlayingDetails.community_rating_count})</span>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-gray-500">My rating</dt>
                    <dd onClick={(e) => e.stopPropagation()} className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                          disabled={ratingId === nowPlaying.item.song_id}
                          className="rounded p-0.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-ray-500 disabled:opacity-50"
                          onClick={(e) => handleNowPlayingRating(e, star)}
                        >
                          <span className={((nowPlayingDetails.rating ?? 0) >= star ? 'text-amber-400' : 'text-gray-500 hover:text-amber-500')}>★</span>
                        </button>
                      ))}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          ) : (
            <p className="px-4 py-8 text-center text-gray-500">Nothing playing</p>
          )}

          <section className="border-t border-groove-700">
            <h2 className="border-b border-groove-700 px-4 py-3 text-lg font-medium text-white">
              Listeners {listeners.length > 0 ? `(${listeners.length})` : ''}
            </h2>
            <div className="max-h-40 overflow-auto p-4">
              {listeners.length === 0 ? (
                <p className="text-center text-sm text-gray-500">No one else here yet</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {listeners.map((l) => (
                    <li key={l.userId} className="text-gray-300">
                      <span className="font-medium text-white">{l.username}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium text-white">Chat</h2>
        <div className="flex flex-col rounded-xl border border-groove-700 bg-groove-900/50 overflow-hidden" style={{ minHeight: 280 }}>
          <div ref={chatListRef} className="flex-1 overflow-auto p-4 space-y-3" style={{ maxHeight: 320 }}>
            {chatMessages.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No messages yet. Say hi and use @ to mention listeners.</p>
            ) : (
              chatMessages.map((m) => (
                <div key={m.id} className="text-sm">
                  <span className="font-medium text-ray-400">{m.username}</span>
                  <span className="text-gray-500 ml-2 text-xs">
                    {m.created_at ? new Date(m.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <p className="text-gray-300 mt-0.5 break-words">
                    {typeof m.message === 'string'
                      ? m.message.split(/(@[\w-]+)/g).map((part, i) =>
                          part.startsWith('@') ? (
                            <span key={i} className="text-ray-400 font-medium"> {part} </span>
                          ) : (
                            part
                          )
                        )
                      : m.message}
                  </p>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          {user ? (
            <form onSubmit={handleSendChat} className="border-t border-groove-700 p-2 relative">
              {mentionSuggestions.length > 0 && (
                <ul className="absolute bottom-full left-2 right-2 mb-1 max-h-32 overflow-auto rounded-lg border border-groove-600 bg-groove-800 py-1 shadow-lg z-10">
                  {mentionSuggestions.slice(0, 8).map((l) => (
                    <li key={l.userId}>
                      <button
                        type="button"
                        onClick={() => insertMention(l.username)}
                        className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-groove-600 focus:bg-groove-600 focus:outline-none"
                      >
                        @{l.username}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={handleChatInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setMentionAt(null);
                  }}
                  placeholder="Message… use @ to mention"
                  className="min-w-0 flex-1 rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                  maxLength={2000}
                />
                <button type="submit" disabled={!chatInput.trim()} className="rounded-lg bg-ray-600 px-4 py-2 font-medium text-white hover:bg-ray-500 disabled:opacity-50 shrink-0">
                  Send
                </button>
              </div>
            </form>
          ) : (
            <p className="border-t border-groove-700 px-4 py-3 text-center text-sm text-gray-500">Sign in to chat</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-white">Queue (most upvoted first)</h2>
        <div className="space-y-2 rounded-xl border border-groove-700 bg-groove-900/50 overflow-hidden">
          {queueWithoutNowPlaying.length === 0 ? (
            <p className="px-6 py-12 text-center text-gray-500">Queue is empty. Add songs above.</p>
          ) : (
            queueWithoutNowPlaying.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 border-b border-groove-700 px-6 py-3 last:border-0 hover:bg-groove-800/50"
              >
                <button
                  type="button"
                  onClick={() => handleVote(item.id)}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-groove-600 text-ray-400 transition hover:bg-ray-500/20"
                  title="Upvote"
                >
                  <span className="font-semibold">↑</span>
                </button>
                <span className="w-8 flex-shrink-0 text-center font-mono text-gray-400">{item.votes ?? 0}</span>
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700 text-ray-400">
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg">◇</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-sm text-gray-400">{item.artist}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
