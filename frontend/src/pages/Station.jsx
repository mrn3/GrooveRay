import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { stations as stationsApi, songs as songsApi } from '../api';
import { usePlayer } from '../context/PlayerContext';

export default function Station() {
  const { slugOrId } = useParams();
  const [station, setStation] = useState(null);
  const [queue, setQueue] = useState([]);
  const [songs, setSongs] = useState([]);
  const [addSongId, setAddSongId] = useState('');
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);
  const { play } = usePlayer();

  useEffect(() => {
    stationsApi.get(slugOrId).then((s) => {
      setStation(s);
      return stationsApi.queue(s.id);
    }).then(setQueue).catch(() => setStation(null)).finally(() => setLoading(false));
  }, [slugOrId]);

  useEffect(() => {
    songsApi.listPublic().then(setSongs).catch(() => setSongs([]));
  }, []);

  useEffect(() => {
    if (!station?.id) return;
    const socket = io(undefined, { path: '/socket.io' });
    socketRef.current = socket;
    socket.emit('station:subscribe', station.id);
    socket.on('queue', setQueue);
    return () => {
      socket.emit('station:unsubscribe', station.id);
      socket.close();
    };
  }, [station?.id]);

  const handleVote = (queueId) => {
    if (!station) return;
    stationsApi.vote(station.id, queueId).then((updated) => {
      setQueue((prev) => prev.map((q) => (q.id === queueId ? updated : q)).sort((a, b) => (b.votes || 0) - (a.votes || 0)));
    }).catch(() => {});
  };

  const handleAddToQueue = async (e) => {
    e.preventDefault();
    if (!station || !addSongId) return;
    try {
      await stationsApi.addToQueue(station.id, addSongId);
      const q = await stationsApi.queue(station.id);
      setQueue(q);
      setAddSongId('');
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlayNext = (item) => {
    const song = { id: item.song_id, title: item.title, artist: item.artist, source: item.source, file_path: item.file_path };
    play(song);
  };

  const handleMarkPlayed = (queueId) => {
    if (!station) return;
    stationsApi.markPlayed(station.id, queueId).then(() => {
      setQueue((prev) => prev.filter((q) => q.id !== queueId));
    }).catch(() => {});
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" /></div>;
  if (!station) return <p className="text-red-400">Station not found</p>;

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-groove-700 text-3xl text-ray-500">◇</div>
        <div>
          <h1 className="text-2xl font-semibold text-white">{station.name}</h1>
          {station.description && <p className="text-gray-400">{station.description}</p>}
          <p className="text-sm text-gray-500">by {station.owner_name}</p>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-medium text-white">Add song to queue</h2>
        <form onSubmit={handleAddToQueue} className="flex gap-2">
          <select
            value={addSongId}
            onChange={(e) => setAddSongId(e.target.value)}
            className="rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white"
          >
            <option value="">Select a song…</option>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>{s.title} — {s.artist}</option>
            ))}
          </select>
          <button type="submit" disabled={!addSongId} className="rounded-lg bg-ray-600 px-4 py-2 font-medium text-white hover:bg-ray-500 disabled:opacity-50">
            Add to queue
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-white">Queue (most upvoted first)</h2>
        <div className="space-y-2 rounded-xl border border-groove-700 bg-groove-900/50 overflow-hidden">
          {queue.length === 0 ? (
            <p className="px-6 py-12 text-center text-gray-500">Queue is empty. Add songs above.</p>
          ) : (
            queue.map((item) => (
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
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-sm text-gray-400">{item.artist}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePlayNext(item)}
                  className="rounded-lg bg-groove-600 px-3 py-1.5 text-sm text-white hover:bg-groove-500"
                >
                  Play
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkPlayed(item.id)}
                  className="rounded-lg bg-groove-600 px-3 py-1.5 text-sm text-gray-400 hover:bg-groove-500 hover:text-white"
                >
                  Mark played
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
