import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { playlists as playlistsApi } from '../api';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'all', label: 'All Playlists' },
  { id: 'mine', label: 'My Playlists' },
  { id: 'contributions', label: 'My Contributions' },
];

export default function Playlists() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createPublic, setCreatePublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  // Search, filter, sort
  const [searchName, setSearchName] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [minTracks, setMinTracks] = useState('');
  const [minListens, setMinListens] = useState('');
  const [minRating, setMinRating] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const searchPanelRef = useRef(null);

  const buildSearchParams = useCallback(
    (overrides = {}) => {
      const p = {};
      if (searchName.trim()) p.name = searchName.trim();
      const mt = minTracks.trim() ? parseInt(minTracks, 10) : null;
      const ml = minListens.trim() ? parseInt(minListens, 10) : null;
      const mr = minRating.trim() ? parseFloat(minRating) : null;
      if (Number.isFinite(mt) && mt >= 0) p.minTracks = mt;
      if (Number.isFinite(ml) && ml >= 0) p.minListens = ml;
      if (Number.isFinite(mr) && mr >= 0 && mr <= 5) p.minRating = mr;
      if (sortBy) {
        p.sortBy = sortBy;
        p.sortOrder = sortOrder;
      }
      p.page = overrides.page ?? page;
      p.limit = overrides.limit ?? pageSize;
      if (activeTab === 'contributions') p.contributions = 1;
      return p;
    },
    [searchName, minTracks, minListens, minRating, sortBy, sortOrder, page, pageSize, activeTab]
  );

  const resetPageRef = useRef(false);
  useEffect(() => {
    resetPageRef.current = true;
  }, [activeTab, sortBy, sortOrder, minTracks, minListens, minRating]);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError('');
    const pageToUse = resetPageRef.current ? 1 : page;
    if (resetPageRef.current) {
      resetPageRef.current = false;
      setPage(1);
    }
    const params = buildSearchParams({ page: pageToUse });
    const promise =
      activeTab === 'all' ? playlistsApi.listPublic(params) : playlistsApi.list(params);
    promise
      .then((data) => {
        setList(data?.items ?? []);
        setTotalCount(data?.total ?? 0);
      })
      .catch((e) => {
        setError(e.message);
        setList([]);
        setTotalCount(0);
      })
      .finally(() => setLoading(false));
  }, [activeTab, buildSearchParams, page]);

  useEffect(() => {
    fetchList();
  }, [activeTab, sortBy, sortOrder, minTracks, minListens, minRating, page, pageSize]);

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

  const linkTo = (pl) => (pl.slug ? `/playlists/by/${pl.slug}` : `/playlists/${pl.id}`);

  const clearFilters = () => {
    setSearchName('');
    setMinTracks('');
    setMinListens('');
    setMinRating('');
    setSortBy('');
    setSortOrder('desc');
  };

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
          {user && activeTab === 'contributions' && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ray-600 text-white transition hover:bg-ray-500 focus:outline-none focus:ring-2 focus:ring-ray-400 focus:ring-offset-2 focus:ring-offset-groove-900"
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

      {/* Search, filter, sort */}
      <div
        ref={searchPanelRef}
        className="mb-4 space-y-3 rounded-xl border border-groove-700 bg-groove-900/50 p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1 block text-xs text-gray-400">Name</label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Search by name…"
              className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
              autoComplete="off"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="mb-1 block text-xs text-gray-400">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500 sm:w-48"
            >
              <option value="">Default</option>
              <option value="name">Name</option>
              <option value="track_count">Tracks</option>
              <option value="total_listen_count">Listens</option>
              <option value="community_avg_rating">Community rating</option>
              <option value="created_at">Created</option>
            </select>
          </div>
          {sortBy && (
            <div className="w-full sm:w-auto">
              <label className="mb-1 block text-xs text-gray-400">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500 sm:w-32"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          )}
          <button
            type="button"
            onClick={() => fetchList()}
            className="rounded-lg bg-ray-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-ray-500 focus:outline-none focus:ring-2 focus:ring-ray-500"
          >
            Search
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg bg-groove-600 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-groove-500 focus:outline-none focus:ring-2 focus:ring-ray-500"
          >
            Clear
          </button>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setFiltersExpanded((prev) => !prev)}
            className="text-sm text-gray-400 hover:text-white focus:outline-none"
          >
            {filtersExpanded
              ? '▼ Less filters'
              : '▶ More filters (tracks, listens, rating)'}
          </button>
          {filtersExpanded && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Min tracks</label>
                <input
                  type="number"
                  min={0}
                  value={minTracks}
                  onChange={(e) => setMinTracks(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Min listens</label>
                <input
                  type="number"
                  min={0}
                  value={minListens}
                  onChange={(e) => setMinListens(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Min rating (0–5)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={minRating}
                  onChange={(e) => setMinRating(e.target.value)}
                  placeholder="—"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

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
      ) : (
        <div className="space-y-1 rounded-xl border border-groove-700 bg-groove-900/50">
          {list.length === 0 ? (
            <p className="px-6 py-12 text-center text-gray-500">
              {activeTab === 'all' && 'No public playlists yet.'}
              {activeTab === 'mine' && 'No playlists yet. Create one to get started.'}
              {activeTab === 'contributions' &&
                'No public playlists from you yet. Create a playlist and make it public to share.'}
            </p>
          ) : (
            list.map((pl) => (
              <Link
                key={pl.id}
                to={linkTo(pl)}
                className="flex items-center gap-3 px-6 py-3 transition hover:bg-groove-800"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700 text-ray-500">
                  {pl.thumbnail_url ? (
                    <img src={pl.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl">♫</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{pl.name}</p>
                  <p className="truncate text-sm text-gray-400">
                    {pl.owner_name}
                    {pl.description && ` · ${pl.description}`}
                  </p>
                </div>
                <span className="flex-shrink-0 rounded bg-groove-600 px-2 py-0.5 text-xs font-mono text-gray-400">
                  {pl.track_count ?? 0} tracks
                </span>
                <span className="flex-shrink-0 text-xs text-gray-400" title="Listens">
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {(pl.total_listen_count ?? 0) > 0 ? pl.total_listen_count : '—'}
                  </span>
                </span>
                <span className="flex-shrink-0 text-xs text-gray-400" title="Community rating">
                  {pl.community_rating_count > 0 ? (
                    <span className="flex items-center gap-1">
                      <span className="text-amber-400">
                        {Number(pl.community_avg_rating).toFixed(1)} ★
                      </span>
                      <span className="text-gray-500">({pl.community_rating_count})</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </span>
              </Link>
            ))
          )}
        </div>
      )}

      {totalCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-groove-700 pt-4">
          <p className="text-sm text-gray-400">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of{' '}
            {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              Per page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded border border-groove-600 bg-groove-800 px-2 py-1 text-white focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-groove-600 bg-groove-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-groove-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">
              Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))}
            </span>
            <button
              type="button"
              disabled={page >= Math.ceil(totalCount / pageSize)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-groove-600 bg-groove-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-groove-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
