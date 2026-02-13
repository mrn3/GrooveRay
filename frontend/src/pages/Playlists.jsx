import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { playlists as playlistsApi } from '../api';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'mine', label: 'My Playlists' },
  { id: 'public', label: 'Explore' },
];

export default function Playlists() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('mine');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createPublic, setCreatePublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError('');
    const promise = activeTab === 'mine' ? playlistsApi.list() : playlistsApi.listPublic();
    promise
      .then(setList)
      .catch((e) => {
        setError(e.message);
        setList([]);
      })
      .finally(() => setLoading(false));
  }, [activeTab]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const p = await playlistsApi.create(createName.trim(), createDesc.trim(), createPublic);
      setCreateName('');
      setCreateDesc('');
      setCreatePublic(false);
      setCreateModalOpen(false);
      navigate(`/playlists/${p.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const linkTo = (p) => (p.slug ? `/playlists/by/${p.slug}` : `/playlists/${p.id}`);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-white">Playlists</h1>
        <div className="flex items-center gap-2">
          <nav className="flex rounded-lg bg-groove-800/80 p-1" aria-label="Playlist tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ray-500 focus:ring-offset-2 focus:ring-offset-groove-900 ${
                  activeTab === tab.id ? 'bg-groove-700 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          {user && activeTab === 'mine' && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ray-600 text-white transition hover:bg-ray-500"
              aria-label="Create playlist"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !creating && setCreateModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-xl border border-groove-700 bg-groove-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-white">New playlist</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="My playlist"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Description (optional)</label>
                <input
                  type="text"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Description"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={createPublic}
                  onChange={(e) => setCreatePublic(e.target.checked)}
                  className="rounded border-groove-600 bg-groove-800 text-ray-600"
                />
                <span className="text-sm text-gray-300">Public (show in Explore)</span>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => !creating && setCreateModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createName.trim()}
                  className="rounded-lg bg-ray-600 px-4 py-2 text-sm font-medium text-white hover:bg-ray-500 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" />
        </div>
      ) : list.length === 0 ? (
        <p className="py-12 text-center text-gray-500">
          {activeTab === 'mine' ? 'No playlists yet. Create one to get started.' : 'No public playlists yet.'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <Link
              key={p.id}
              to={linkTo(p)}
              className="block rounded-xl border border-groove-700 bg-groove-900/50 p-5 transition hover:border-ray-500/50 hover:bg-groove-800/50"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-groove-700 text-ray-500">
                  <span className="text-xl">♫</span>
                </div>
                <h2 className="font-semibold text-white truncate">{p.name}</h2>
              </div>
              {p.description && (
                <p className="mb-2 line-clamp-2 text-sm text-gray-400">{p.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span>{p.track_count ?? 0} tracks</span>
                {p.community_rating_count > 0 && (
                  <span>★ {Number(p.community_avg_rating).toFixed(1)} ({p.community_rating_count})</span>
                )}
                {p.total_listen_count > 0 && <span>▶ {p.total_listen_count} plays</span>}
                <span>by {p.owner_name}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
