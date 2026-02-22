import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groovers as grooversApi } from '../api';
import { selfHostedImageUrl } from '../utils/images';

const TABS = [
  { id: 'all', label: 'All Groovers' },
  { id: 'connections', label: 'My Connections' },
];

export default function Groovers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('username');
  const [sortOrder, setSortOrder] = useState('asc');
  const resetPageRef = useRef(false);

  const buildParams = useCallback(
    (overrides = {}) => {
      const p = {
        tab: activeTab,
        page: overrides.page ?? page,
        limit: overrides.limit ?? pageSize,
        sortBy,
        sortOrder,
      };
      if (search.trim()) p.search = search.trim();
      return p;
    },
    [activeTab, page, pageSize, search, sortBy, sortOrder]
  );

  useEffect(() => {
    resetPageRef.current = true;
  }, [activeTab, sortBy, sortOrder]);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError('');
    const pageToUse = resetPageRef.current ? 1 : page;
    if (resetPageRef.current) {
      resetPageRef.current = false;
      setPage(1);
    }
    const params = buildParams({ page: pageToUse });
    grooversApi
      .list(params)
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
  }, [activeTab, buildParams, page, pageSize]);

  useEffect(() => {
    fetchList();
  }, [activeTab, sortBy, sortOrder, page, pageSize]);

  const handleSearch = () => {
    setPage(1);
    fetchList();
  };

  const clearFilters = () => {
    setSearch('');
    setSortBy('username');
    setSortOrder('asc');
    setPage(1);
    resetPageRef.current = true;
    fetchList();
  };

  const displayName = (groover) => groover.name?.trim() || groover.username || 'Groover';

  if (loading && list.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-white">Groovers</h1>
        <nav className="flex rounded-lg bg-groove-800/80 p-1" aria-label="Groover tabs">
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
      </div>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      <div className="mb-4 space-y-3 rounded-xl border border-groove-700 bg-groove-900/50 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs text-gray-400">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Username or name…"
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
              <option value="username">Username</option>
              <option value="name">Name</option>
              <option value="created_at">Joined</option>
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
            onClick={clearFilters}
            className="rounded-lg bg-groove-600 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-groove-500 focus:outline-none focus:ring-2 focus:ring-ray-500"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-1 rounded-xl border border-groove-700 bg-groove-900/50">
        {list.length === 0 ? (
          <p className="px-6 py-12 text-center text-gray-500">
            {activeTab === 'connections' ? 'No connections yet. Connect with Groovers from All Groovers.' : 'No groovers match your filters.'}
          </p>
        ) : (
          list.map((groover) => (
            <div
              key={groover.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-6 py-3 transition hover:bg-groove-800"
              onClick={() => navigate(`/groovers/${encodeURIComponent(groover.username)}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/groovers/${encodeURIComponent(groover.username)}`)}
              role="button"
              tabIndex={0}
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-groove-600 bg-groove-800">
                {selfHostedImageUrl(groover.avatar_url) ? (
                  <img src={selfHostedImageUrl(groover.avatar_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-medium text-ray-400">
                    {(displayName(groover)).slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">@{groover.username}</p>
                <p className="text-sm text-gray-400">
                  {displayName(groover) !== groover.username ? displayName(groover) : ''}
                  {groover.location ? ` · ${groover.location}` : ''}
                </p>
              </div>
              {groover.is_connected && (
                <span className="flex-shrink-0 rounded-full bg-groove-600 px-2 py-0.5 text-xs text-ray-400">
                  Connected
                </span>
              )}
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
