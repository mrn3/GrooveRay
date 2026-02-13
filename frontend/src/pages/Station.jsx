import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
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
  const [editImageOpen, setEditImageOpen] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [savingImage, setSavingImage] = useState(false);
  const socketRef = useRef(null);
  const { user } = useAuth();
  const { play, setStationMode } = usePlayer();
  const isOwner = user?.id === station?.owner_id;

  useEffect(() => {
    stationsApi.get(slugOrId).then((s) => {
      setStation(s);
      return Promise.all([stationsApi.queue(s.id), stationsApi.nowPlaying(s.id)]);
    }).then(([q, np]) => {
      setQueue(q);
      setNowPlaying(np);
    }).catch(() => setStation(null)).finally(() => setLoading(false));
  }, [slugOrId]);

  useEffect(() => {
    songsApi.listPublic({ limit: 200 }).then((data) => setSongs(data?.items ?? [])).catch(() => setSongs([]));
  }, []);

  useEffect(() => {
    if (!station?.id) return;
    const socket = io(undefined, { path: '/socket.io' });
    socketRef.current = socket;
    socket.emit('station:subscribe', station.id);
    socket.on('queue', setQueue);
    socket.on('nowPlaying', setNowPlaying);
    return () => {
      socket.emit('station:unsubscribe', station.id);
      socket.close();
      setStationMode(null);
    };
  }, [station?.id, setStationMode]);

  useEffect(() => {
    if (!nowPlaying?.item) {
      setStationMode(null);
      setNowPlayingDetails(null);
      return;
    }
    const item = nowPlaying.item;
    const song = { id: item.song_id, title: item.title, artist: item.artist, source: item.source, file_path: item.file_path, thumbnail_url: item.thumbnail_url, duration_seconds: item.duration_seconds };
    const pos = serverPosition(nowPlaying.startedAt, item.duration_seconds);
    setStationMode({ startedAt: nowPlaying.startedAt, durationSeconds: item.duration_seconds ?? 60 });
    play(song, { seekTo: pos });
  }, [nowPlaying?.queueId, nowPlaying?.startedAt, play, setStationMode]);

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

  const handleAddToQueue = async (e) => {
    e.preventDefault();
    if (!station || !addSongId) return;
    try {
      await stationsApi.addToQueue(station.id, addSongId);
      const q = await stationsApi.queue(station.id);
      setQueue(q);
      setAddSongId('');
      setAddSongInput('');
    } catch (err) {
      console.error(err);
    }
  };

  const query = addSongInput.trim().toLowerCase();
  const suggestions = query
    ? songs.filter(
        (s) =>
          (s.title || '').toLowerCase().includes(query) ||
          (s.artist || '').toLowerCase().includes(query)
      ).slice(0, 8)
    : [];

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

  return (
    <div>
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

          <section>
            <h2 className="mb-3 text-lg font-medium text-white">Add song to queue</h2>
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
        </section>
      </div>

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
