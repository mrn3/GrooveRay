import { useState, useEffect } from 'react';
import { songs as songsApi, streamUrl, youtube as youtubeApi } from '../api';
import { usePlayer } from '../context/PlayerContext';

export default function Library() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmSong, setConfirmSong] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [savingId, setSavingId] = useState(null);
  const { play } = usePlayer();

  // Add song modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState(null); // null | 'upload' | 'youtube'
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploading, setUploading] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [addMessage, setAddMessage] = useState('');

  const startRename = (e, song) => {
    e.stopPropagation();
    setEditingId(song.id);
    setEditTitle(song.title);
  };

  const cancelRename = (e) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  const handleRename = async (e, song) => {
    e?.stopPropagation();
    const newTitle = editTitle.trim();
    if (!newTitle || newTitle === song.title) {
      cancelRename();
      return;
    }
    setSavingId(song.id);
    try {
      const updated = await songsApi.update(song.id, { title: newTitle });
      setList((prev) => prev.map((s) => (s.id === song.id ? { ...s, title: updated.title } : s)));
      cancelRename();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleSetPublic = async (e, song) => {
    e.stopPropagation();
    const next = !song.is_public;
    setTogglingId(song.id);
    try {
      const updated = await songsApi.setPublic(song.id, next);
      setList((prev) => prev.map((s) => (s.id === song.id ? { ...s, is_public: updated.is_public } : s)));
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  };

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

  const openAddModal = () => {
    setAddModalOpen(true);
    setAddMode(null);
    setAddMessage('');
    setUploadFile(null);
    setUploadTitle('');
    setUploadArtist('');
    setYoutubeUrl('');
  };

  const closeAddModal = () => {
    setAddModalOpen(false);
    setAddMode(null);
    setAddMessage('');
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setAddMessage('Choose a file first');
      return;
    }
    setUploading(true);
    setAddMessage('');
    try {
      const newSong = await songsApi.upload(uploadFile, uploadTitle || uploadFile.name, uploadArtist || 'Unknown');
      setList((prev) => [newSong, ...prev]);
      closeAddModal();
    } catch (err) {
      setAddMessage(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleYoutubeAdd = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    setYoutubeLoading(true);
    setAddMessage('');
    try {
      await youtubeApi.add(youtubeUrl.trim());
      setAddMessage('Download started — audio will be added to your library when ready.');
      setYoutubeUrl('');
    } catch (err) {
      setAddMessage(err.message || 'Failed to add YouTube link');
    } finally {
      setYoutubeLoading(false);
    }
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
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-white">Library</h1>
        <button
          type="button"
          onClick={openAddModal}
          aria-label="Add song"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ray-600 text-white transition hover:bg-ray-500 focus:outline-none focus:ring-2 focus:ring-ray-400 focus:ring-offset-2 focus:ring-offset-groove-900"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeAddModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-song-title"
        >
          <div
            className="w-full max-w-md rounded-xl border border-groove-700 bg-groove-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2">
              {addMode !== null && (
                <button
                  type="button"
                  onClick={() => { setAddMode(null); setAddMessage(''); }}
                  className="rounded p-1.5 text-gray-400 hover:bg-groove-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-ray-500"
                  aria-label="Back"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <h2 id="add-song-title" className="flex-1 text-lg font-semibold text-white">
                {addMode === null ? 'Add song' : addMode === 'upload' ? 'Upload file' : 'Add from YouTube'}
              </h2>
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded p-1.5 text-gray-400 hover:bg-groove-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-ray-500"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {addMode === null ? (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setAddMode('upload')}
                  className="flex items-center gap-3 rounded-xl border border-groove-600 bg-groove-800/50 px-4 py-4 text-left transition hover:border-groove-500 hover:bg-groove-800 focus:outline-none focus:ring-2 focus:ring-ray-500"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-groove-700 text-ray-400">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-white">Upload a file</p>
                    <p className="text-sm text-gray-400">Add a song from your device (MP3, etc.)</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('youtube')}
                  className="flex items-center gap-3 rounded-xl border border-groove-600 bg-groove-800/50 px-4 py-4 text-left transition hover:border-groove-500 hover:bg-groove-800 focus:outline-none focus:ring-2 focus:ring-ray-500"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-groove-700 text-ray-400">
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </span>
                  <div>
                    <p className="font-medium text-white">Add from YouTube</p>
                    <p className="text-sm text-gray-400">Paste a YouTube link to extract audio</p>
                  </div>
                </button>
              </div>
            ) : addMode === 'upload' ? (
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                {addMessage && (
                  <p className={`rounded-lg px-3 py-2 text-sm ${addMessage.includes('Choose') ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                    {addMessage}
                  </p>
                )}
                <div>
                  <label className="mb-1 block text-sm text-gray-400">File</label>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white file:mr-4 file:rounded file:border-0 file:bg-ray-600 file:px-3 file:py-1 file:text-sm file:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-400">Title (optional)</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Song title"
                    className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-400">Artist (optional)</label>
                  <input
                    type="text"
                    value={uploadArtist}
                    onChange={(e) => setUploadArtist(e.target.value)}
                    placeholder="Artist name"
                    className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="w-full rounded-lg bg-ray-600 py-3 font-medium text-white transition hover:bg-ray-500 disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleYoutubeAdd} className="space-y-4">
                {addMessage && (
                  <p className={`rounded-lg px-3 py-2 text-sm ${addMessage.includes('started') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {addMessage}
                  </p>
                )}
                <div>
                  <label className="mb-1 block text-sm text-gray-400">YouTube video URL</label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500 font-mono text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={youtubeLoading}
                  className="w-full rounded-lg bg-ray-600 py-3 font-medium text-white transition hover:bg-ray-500 disabled:opacity-50"
                >
                  {youtubeLoading ? 'Adding…' : 'Add to library'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

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
                {editingId === song.id ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(e) => handleRename(e, song)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="min-w-0 flex-1 rounded border border-groove-600 bg-groove-800 px-2 py-1 text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                      placeholder="Song title"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Escape' && cancelRename()}
                    />
                    <button
                      type="submit"
                      disabled={savingId === song.id || !editTitle.trim()}
                      className="rounded bg-ray-600 px-2 py-1 text-xs font-medium text-white hover:bg-ray-500 disabled:opacity-50"
                    >
                      {savingId === song.id ? (
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        'Save'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={cancelRename}
                      className="rounded bg-groove-600 px-2 py-1 text-xs text-gray-300 hover:bg-groove-500"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="truncate font-medium text-white">{song.title}</p>
                    <p className="truncate text-sm text-gray-400">{song.artist} · {song.source}</p>
                  </>
                )}
              </div>
              <span className="rounded bg-groove-600 px-2 py-0.5 text-xs font-mono text-gray-400">
                {song.duration_seconds ? `${Math.floor(song.duration_seconds / 60)}:${String(song.duration_seconds % 60).padStart(2, '0')}` : '--:--'}
              </span>
              <button
                type="button"
                aria-label={song.is_public ? 'Make private' : 'Make public'}
                title={song.is_public ? 'Public — visible to everyone. Click to make private.' : 'Private — only you can see this. Click to make public.'}
                disabled={togglingId === song.id}
                className="flex-shrink-0 rounded px-2 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-ray-500 disabled:opacity-50"
                onClick={(e) => handleSetPublic(e, song)}
              >
                {togglingId === song.id ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                ) : song.is_public ? (
                  <span className="rounded bg-green-500/20 px-2 py-0.5 text-green-400">Public</span>
                ) : (
                  <span className="rounded bg-groove-600 px-2 py-0.5 text-gray-400">Private</span>
                )}
              </button>
              {editingId !== song.id && (
                <button
                  type="button"
                  aria-label="Rename song"
                  title="Rename"
                  className="flex-shrink-0 rounded p-1.5 text-gray-400 transition hover:bg-groove-700 hover:text-ray-400 focus:outline-none focus:ring-2 focus:ring-ray-500"
                  onClick={(e) => startRename(e, song)}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
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
