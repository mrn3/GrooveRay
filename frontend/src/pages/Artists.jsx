import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { artists as artistsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { selfHostedImageUrl } from '../utils/images';

const TABS_ALL = [
  { id: 'all', label: 'All Artists' },
  { id: 'mine', label: 'My Artists' },
];

export default function Artists() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!user && activeTab === 'mine') setActiveTab('all');
  }, [user, activeTab]);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchName, setSearchName] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [clearTick, setClearTick] = useState(0);
  const resetPageRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    resetPageRef.current = true;
  }, [activeTab, sortBy, sortOrder]);

  const buildParams = useCallback(
    (overrides = {}) => ({
      name: searchName.trim() || undefined,
      sortBy,
      sortOrder,
      page: overrides.page ?? page,
      limit: overrides.limit ?? pageSize,
    }),
    [searchName, sortBy, sortOrder, page, pageSize]
  );

  const fetchList = useCallback(() => {
    setLoading(true);
    setError('');
    const pageToUse = resetPageRef.current ? 1 : page;
    if (resetPageRef.current) {
      resetPageRef.current = false;
      setPage(1);
    }
    const params = buildParams({ page: pageToUse });
    const promise = activeTab === 'mine' && user ? artistsApi.listMine(params) : artistsApi.list(params);
    promise
      .then((data) => {
        setList(data?.items ?? []);
        setTotalCount(data?.total ?? 0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeTab, buildParams, page, user]);

  useEffect(() => {
    fetchList();
  }, [activeTab, sortBy, sortOrder, page, pageSize, clearTick]);

  const handleSearch = () => {
    setPage(1);
    fetchList();
  };

  const handleClear = () => {
    setSearchName('');
    setSortBy('name');
    setSortOrder('asc');
    setPage(1);
    setClearTick((t) => t + 1);
  };

  const artistUrl = (name) => `/artists/${encodeURIComponent(name)}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-white">Artists</h1>
        <nav className="flex rounded-lg bg-groove-800/80 p-1" aria-label="Artist tabs">
          {(user ? TABS_ALL : TABS_ALL.filter((t) => t.id === 'all')).map((tab) => (
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
      </div>

      <div className="mb-4 space-y-3 rounded-xl border border-groove-700 bg-groove-900/50 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs text-gray-400">Name</label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by artist name…"
              className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="mb-1 block text-xs text-gray-400">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500 sm:w-48"
            >
              <option value="name">Name</option>
              <option value="song_count">Songs</option>
              <option value="total_listen_count">Listens (everyone)</option>
              <option value="listen_count">My listens</option>
              <option value="community_avg_rating">Community rating</option>
              <option value="rating">My rating</option>
            </select>
          </div>
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
          <button
            type="button"
            onClick={handleSearch}
            className="rounded-lg bg-ray-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-ray-500 focus:outline-none focus:ring-2 focus:ring-ray-500"
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg bg-groove-600 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-groove-500 focus:outline-none focus:ring-2 focus:ring-ray-500"
          >
            Clear
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="space-y-1 rounded-xl border border-groove-700 bg-groove-900/50">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" />
          </div>
        ) : list.length === 0 ? (
          <p className="px-6 py-12 text-center text-gray-500">
            {activeTab === 'mine' ? 'No artists yet. Add or rate songs to see artists here.' : 'No artists found.'}
          </p>
        ) : (
          list.map((artist) => (
            <div
              key={artist.artist}
              role="button"
              tabIndex={0}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-6 py-3 transition hover:bg-groove-800 focus:outline-none focus:ring-2 focus:ring-ray-500 focus:ring-offset-2 focus:ring-offset-groove-900"
              onClick={() => navigate(artistUrl(artist.artist))}
              onKeyDown={(e) => e.key === 'Enter' && navigate(artistUrl(artist.artist))}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700 text-ray-400">
                {selfHostedImageUrl(artist.image_url) ? (
                  <img src={selfHostedImageUrl(artist.image_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg" aria-hidden>♪</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                  <a
                    href={artistUrl(artist.artist)}
                    onClick={(e) => { e.stopPropagation(); navigate(artistUrl(artist.artist)); }}
                    className="text-ray-400 hover:underline"
                  >
                    {artist.artist}
                  </a>
                </p>
                <p className="truncate text-sm text-gray-400">{artist.song_count} song{artist.song_count !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1" title="Listens by everyone">
                  <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {(artist.total_listen_count ?? 0) > 0 ? Number(artist.total_listen_count) : '—'}
                </span>
                <span className="flex items-center gap-1" title="My listens">
                  <svg className="h-3.5 w-3.5 flex-shrink-0 text-ray-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {(artist.listen_count ?? 0) > 0 ? Number(artist.listen_count) : '—'}
                </span>
                <span title="Community rating">
                  {artist.community_rating_count > 0 ? (
                    <span className="flex items-center gap-1">
                      <span className="text-amber-400">{Number(artist.community_avg_rating).toFixed(1)} ★</span>
                      <span className="text-gray-500">({artist.community_rating_count})</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </span>
                <span title="My rating">
                  {artist.rating != null ? <span className="text-amber-400">{artist.rating} ★</span> : '—'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {totalCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-groove-700 pt-4">
          <p className="text-sm text-gray-400">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
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
                {[5, 10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
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
