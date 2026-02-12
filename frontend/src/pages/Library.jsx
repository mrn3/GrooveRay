import { useState, useEffect } from 'react';
import { songs as songsApi, streamUrl } from '../api';
import { usePlayer } from '../context/PlayerContext';

export default function Library() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmSong, setConfirmSong] = useState(null);
  const { play } = usePlayer();

  const openDeleteConfirm = (e, song) => {
    e.stopPropagation();
    setConfirmSong(song);
  };

  const closeDeleteConfirm = () => setConfirmSong(null);

  const handleDeleteConfirm = async () => {
    if (!confirmSong) return;
    setDeletingId(confirmSong.id);
    try {
      await songsApi.delete(confirmSong.id);
      setList((prev) => prev.filter((s) => s.id !== confirmSong.id));
      setConfirmSong(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (e, song) => {
    e.stopPropagation();
    openDeleteConfirm(e, song);
  };

  useEffect(() => {
    songsApi.list()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" /></div>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div>
      {confirmSong && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeDeleteConfirm}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div
            className="w-full max-w-sm rounded-xl border border-groove-700 bg-groove-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-confirm-title" className="text-lg font-semibold text-white">
              Remove from library?
            </h2>
            <p className="mt-2 text-gray-400">
              “{confirmSong.title}” will be removed from your library. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="rounded-lg bg-groove-700 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-groove-600 focus:outline-none focus:ring-2 focus:ring-ray-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deletingId === confirmSong.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              >
                {deletingId === confirmSong.id ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  'Remove'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <h1 className="mb-6 text-2xl font-semibold text-white">Library</h1>
      <div className="space-y-1 rounded-xl border border-groove-700 bg-groove-900/50">
        {list.length === 0 ? (
          <p className="px-6 py-12 text-center text-gray-500">No songs yet. Upload or add a YouTube link.</p>
        ) : (
          list.map((song) => (
            <div
              key={song.id}
              className="flex cursor-pointer items-center gap-4 px-6 py-3 transition hover:bg-groove-800"
              onClick={() => play(song)}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-groove-700 text-ray-400">
                <span className="text-lg">◇</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{song.title}</p>
                <p className="truncate text-sm text-gray-400">{song.artist} · {song.source}</p>
              </div>
              <span className="rounded bg-groove-600 px-2 py-0.5 text-xs font-mono text-gray-400">
                {song.duration_seconds ? `${Math.floor(song.duration_seconds / 60)}:${String(song.duration_seconds % 60).padStart(2, '0')}` : '--:--'}
              </span>
              <button
                type="button"
                aria-label="Delete song"
                className="flex-shrink-0 rounded p-1.5 text-gray-400 transition hover:bg-groove-700 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-ray-500"
                onClick={(e) => handleDelete(e, song)}
                disabled={deletingId === song.id}
              >
                {deletingId === song.id ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
