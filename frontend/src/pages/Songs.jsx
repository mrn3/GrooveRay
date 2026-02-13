import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { songs as songsApi, youtube as youtubeApi } from '../api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { id: 'all', label: 'All Songs' },
  { id: 'favorites', label: 'My Songs' },
  { id: 'mine', label: 'My Contributions' },
];

export default function Songs() {
  const [activeTab, setActiveTab] = useState('all');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmSong, setConfirmSong] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [artistSuggestions, setArtistSuggestions] = useState([]);
  const [artistDropdownOpen, setArtistDropdownOpen] = useState(false);
  const [artistSuggestionsLoading, setArtistSuggestionsLoading] = useState(false);
  const artistDropdownRef = useRef(null);
  const artistDebounceRef = useRef(null);
  const [savingId, setSavingId] = useState(null);
  const [ratingId, setRatingId] = useState(null);
  // Search, filter, sort
  const [searchTitle, setSearchTitle] = useState('');
  const [searchArtist, setSearchArtist] = useState('');
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const [titleDropdownOpen, setTitleDropdownOpen] = useState(false);
  const [titleSuggestionsLoading, setTitleSuggestionsLoading] = useState(false);
  const [searchArtistDropdownOpen, setSearchArtistDropdownOpen] = useState(false);
  const [searchArtistSuggestions, setSearchArtistSuggestions] = useState([]);
  const [searchArtistSuggestionsLoading, setSearchArtistSuggestionsLoading] = useState(false);
  const searchPanelRef = useRef(null);
  const [durationMin, setDurationMin] = useState('');
  const [durationMax, setDurationMax] = useState('');
  const [minListensMe, setMinListensMe] = useState('');
  const [minListensEveryone, setMinListensEveryone] = useState('');
  const [minRatingMe, setMinRatingMe] = useState('');
  const [minRatingCommunity, setMinRatingCommunity] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const { play, toggle, current, playing } = usePlayer();
  const { user } = useAuth();
  const navigate = useNavigate();

  const buildSearchParams = useCallback((overrides = {}) => {
    const p = {};
    if (searchTitle.trim()) p.title = searchTitle.trim();
    if (searchArtist.trim()) p.artist = searchArtist.trim();
    const dMin = durationMin.trim() ? parseInt(durationMin, 10) : null;
    const dMax = durationMax.trim() ? parseInt(durationMax, 10) : null;
    if (Number.isFinite(dMin)) p.durationMin = dMin;
    if (Number.isFinite(dMax)) p.durationMax = dMax;
    const lm = minListensMe.trim() ? parseInt(minListensMe, 10) : null;
    const le = minListensEveryone.trim() ? parseInt(minListensEveryone, 10) : null;
    if (Number.isFinite(lm) && lm >= 0) p.minListensMe = lm;
    if (Number.isFinite(le) && le >= 0) p.minListensEveryone = le;
    const rm = minRatingMe.trim() ? parseInt(minRatingMe, 10) : null;
    const rc = minRatingCommunity.trim() ? parseFloat(minRatingCommunity) : null;
    if (Number.isFinite(rm) && rm >= 1 && rm <= 5) p.minRatingMe = rm;
    if (Number.isFinite(rc) && rc >= 0 && rc <= 5) p.minRatingCommunity = rc;
    if (sortBy) {
      p.sortBy = sortBy;
      p.sortOrder = sortOrder;
    }
    p.page = overrides.page ?? page;
    p.limit = overrides.limit ?? pageSize;
    return p;
  }, [searchTitle, searchArtist, durationMin, durationMax, minListensMe, minListensEveryone, minRatingMe, minRatingCommunity, sortBy, sortOrder, page, pageSize]);

  const resetPageRef = useRef(false);
  useEffect(() => {
    resetPageRef.current = true;
  }, [activeTab, sortBy, sortOrder, durationMin, durationMax, minListensMe, minListensEveryone, minRatingMe, minRatingCommunity]);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError('');
    const pageToUse = resetPageRef.current ? 1 : page;
    if (resetPageRef.current) {
      resetPageRef.current = false;
      setPage(1);
    }
    const params = buildSearchParams({ page: pageToUse });
    const promise = activeTab === 'mine'
      ? songsApi.list(params)
      : activeTab === 'favorites'
        ? songsApi.listFavorites(params)
        : songsApi.listPublic(params);
    promise
      .then((data) => {
        setList(data?.items ?? []);
        setTotalCount(data?.total ?? 0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeTab, buildSearchParams, page]);

  // Refetch when tab, sort, filters, or page change (title/artist applied via Search button)
  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: do not refetch when only searchTitle/searchArtist change
  }, [activeTab, sortBy, sortOrder, durationMin, durationMax, minListensMe, minListensEveryone, minRatingMe, minRatingCommunity, page, pageSize]);

  useEffect(() => {
    return () => {
      if (youtubePollRef.current) {
        clearInterval(youtubePollRef.current);
        youtubePollRef.current = null;
      }
    };
  }, []);

  // Add song modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState(null); // null | 'upload' | 'youtube'
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // 0–100 or null
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [addMessage, setAddMessage] = useState('');
  // Shown in list while upload/YouTube is in progress (progress bar in row)
  const [uploadingItem, setUploadingItem] = useState(null); // { title, artist, progress: 0-100 } | null
  const [youtubePendingItem, setYoutubePendingItem] = useState(null); // { title: string } | null
  const youtubePollRef = useRef(null);

  const startRename = (e, song) => {
    e.stopPropagation();
    setEditingId(song.id);
    setEditTitle(song.title ?? '');
    setEditArtist(song.artist ?? '');
    setArtistSuggestions([]);
    setArtistDropdownOpen(false);
  };

  const cancelRename = (e) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditTitle('');
    setEditArtist('');
    setArtistSuggestions([]);
    setArtistDropdownOpen(false);
  };

  // Fetch artist suggestions when editing and artist input changes (debounced)
  useEffect(() => {
    if (editingId == null) return;
    if (artistDebounceRef.current) clearTimeout(artistDebounceRef.current);
    artistDebounceRef.current = setTimeout(() => {
      setArtistSuggestionsLoading(true);
      const q = editArtist.trim();
      songsApi.artists(q).then(setArtistSuggestions).catch(() => setArtistSuggestions([])).finally(() => setArtistSuggestionsLoading(false));
    }, 200);
    return () => {
      if (artistDebounceRef.current) clearTimeout(artistDebounceRef.current);
    };
  }, [editingId, editArtist]);

  // Close artist dropdown when clicking outside
  useEffect(() => {
    const onMouseDown = (e) => {
      if (artistDropdownRef.current && !artistDropdownRef.current.contains(e.target)) {
        setArtistDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Search title autocomplete
  useEffect(() => {
    if (!titleDropdownOpen) return;
    const t = searchTitle.trim();
    const timer = setTimeout(() => {
      setTitleSuggestionsLoading(true);
      songsApi.titles(t).then(setTitleSuggestions).catch(() => setTitleSuggestions([])).finally(() => setTitleSuggestionsLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTitle, titleDropdownOpen]);

  // Search artist autocomplete
  useEffect(() => {
    if (!searchArtistDropdownOpen) return;
    const a = searchArtist.trim();
    const timer = setTimeout(() => {
      setSearchArtistSuggestionsLoading(true);
      songsApi.artists(a).then(setSearchArtistSuggestions).catch(() => setSearchArtistSuggestions([])).finally(() => setSearchArtistSuggestionsLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [searchArtist, searchArtistDropdownOpen]);

  const closeSearchDropdowns = () => {
    setTitleDropdownOpen(false);
    setSearchArtistDropdownOpen(false);
  };

  useEffect(() => {
    const onMouseDown = (e) => {
      if (searchPanelRef.current && !searchPanelRef.current.contains(e.target)) {
        closeSearchDropdowns();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const handleRename = async (e, song) => {
    e?.stopPropagation();
    const newTitle = editTitle.trim();
    const newArtist = editArtist.trim();
    const titleChanged = newTitle !== (song.title ?? '');
    const artistChanged = newArtist !== (song.artist ?? '');
    if (!titleChanged && !artistChanged) {
      cancelRename();
      return;
    }
    if (!newTitle) {
      setError('Title cannot be empty');
      return;
    }
    setSavingId(song.id);
    setArtistDropdownOpen(false);
    try {
      const payload = {};
      if (titleChanged) payload.title = newTitle;
      if (artistChanged) payload.artist = newArtist;
      const updated = await songsApi.update(song.id, payload);
      setList((prev) => prev.map((s) => (s.id === song.id ? { ...s, title: updated.title, artist: updated.artist } : s)));
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
    setUploadProgress(null);
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
    const title = uploadTitle || uploadFile.name;
    const artist = uploadArtist || 'Unknown';
    setUploadingItem({ title, artist, progress: 0 });
    setUploading(true);
    setAddMessage('');
    closeAddModal();
    try {
      const newSong = await songsApi.uploadWithProgress(
        uploadFile,
        title,
        artist,
        (percent) => setUploadingItem((prev) => (prev ? { ...prev, progress: percent } : null))
      );
      setList((prev) => [newSong, ...prev]);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadingItem(null);
    }
  };

  const handleYoutubeAdd = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    const url = youtubeUrl.trim();
    setYoutubePendingItem({ title: url.length > 50 ? url.slice(0, 47) + '…' : url });
    setYoutubeLoading(true);
    setAddMessage('');
    try {
      const { jobId } = await youtubeApi.add(url);
      setAddMessage('Download started — audio will be added to your library when ready.');
      setTimeout(closeAddModal, 1800);
      if (activeTab === 'mine' && jobId) {
        if (youtubePollRef.current) clearInterval(youtubePollRef.current);
        const startedAt = Date.now();
        const maxMs = 120000;
        youtubePollRef.current = setInterval(async () => {
          if (Date.now() - startedAt > maxMs) {
            clearInterval(youtubePollRef.current);
            youtubePollRef.current = null;
            return;
          }
          try {
            const jobs = await youtubeApi.jobs();
            const job = jobs.find((j) => j.id === jobId);
            if (!job) return;
            if (job.status === 'completed') {
              clearInterval(youtubePollRef.current);
              youtubePollRef.current = null;
              fetchList();
            } else if (job.status === 'failed') {
              clearInterval(youtubePollRef.current);
              youtubePollRef.current = null;
              setError(job.error_message || 'YouTube download failed');
            }
          } catch (_) {}
        }, 3000);
      }
    } catch (err) {
      setAddMessage(err.message || 'Failed to add YouTube link');
    } finally {
      setYoutubeLoading(false);
      setYoutubePendingItem(null);
    }
  };

  const handleSetRating = async (e, song, rating) => {
    e.stopPropagation();
    setRatingId(song.id);
    try {
      await songsApi.setRating(song.id, rating);
      setList((prev) => prev.map((s) => (s.id === song.id ? { ...s, rating } : s)));
    } catch (err) {
      setError(err.message);
    } finally {
      setRatingId(null);
    }
  };

  const showEditActions = () => activeTab === 'mine';
  const showListenCount = activeTab === 'favorites' || activeTab === 'all';
  const showRating = activeTab === 'favorites' || activeTab === 'all';

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
              "{confirmSong.title}" will be removed from your library. This cannot be undone.
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-white">Songs</h1>
        <div className="flex items-center gap-2">
          <nav className="flex rounded-lg bg-groove-800/80 p-1" aria-label="Song tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ray-500 focus:ring-offset-2 focus:ring-offset-groove-900 ${
                  activeTab === tab.id
                    ? 'bg-groove-700 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          {activeTab === 'mine' && (
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
          )}
        </div>
      </div>

      {/* Search, filter, sort */}
      <div
        ref={searchPanelRef}
        className="mb-4 space-y-3 rounded-xl border border-groove-700 bg-groove-900/50 p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[140px] flex-1">
            <label className="mb-1 block text-xs text-gray-400">Title</label>
            <input
              type="text"
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              onFocus={() => setTitleDropdownOpen(true)}
              onKeyDown={(e) => e.key === 'Escape' && closeSearchDropdowns()}
              placeholder="Search by title…"
              className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
              autoComplete="off"
            />
            {titleDropdownOpen && (
              <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded border border-groove-600 bg-groove-800 py-1 shadow-lg">
                {titleSuggestionsLoading ? (
                  <li className="px-3 py-2 text-sm text-gray-400">Searching…</li>
                ) : titleSuggestions.length > 0 ? (
                  titleSuggestions.map((title) => (
                    <li key={title}>
                      <button
                        type="button"
                        onClick={() => { setSearchTitle(title); setTitleDropdownOpen(false); }}
                        className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-groove-600 focus:bg-groove-600 focus:outline-none"
                      >
                        {title}
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-2 text-sm text-gray-400">Type to search titles</li>
                )}
              </ul>
            )}
          </div>
          <div className="relative min-w-[140px] flex-1">
            <label className="mb-1 block text-xs text-gray-400">Artist</label>
            <input
              type="text"
              value={searchArtist}
              onChange={(e) => setSearchArtist(e.target.value)}
              onFocus={() => setSearchArtistDropdownOpen(true)}
              onKeyDown={(e) => e.key === 'Escape' && closeSearchDropdowns()}
              placeholder="Search by artist…"
              className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
              autoComplete="off"
            />
            {searchArtistDropdownOpen && (
              <ul className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded border border-groove-600 bg-groove-800 py-1 shadow-lg">
                {searchArtistSuggestionsLoading ? (
                  <li className="px-3 py-2 text-sm text-gray-400">Searching…</li>
                ) : searchArtistSuggestions.length > 0 ? (
                  searchArtistSuggestions.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() => { setSearchArtist(name); setSearchArtistDropdownOpen(false); }}
                        className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-groove-600 focus:bg-groove-600 focus:outline-none"
                      >
                        {name}
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-2 text-sm text-gray-400">Type to search artists</li>
                )}
              </ul>
            )}
          </div>
          <div className="w-full sm:w-auto">
            <label className="mb-1 block text-xs text-gray-400">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500 sm:w-48"
            >
              <option value="">Default</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="duration_seconds">Duration</option>
              <option value="listen_count">My listens</option>
              <option value="total_listen_count">Listens (everyone)</option>
              <option value="rating">My rating</option>
              <option value="community_avg_rating">Community rating</option>
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
            onClick={() => { closeSearchDropdowns(); fetchList(); }}
            className="rounded-lg bg-ray-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-ray-500 focus:outline-none focus:ring-2 focus:ring-ray-500"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchTitle('');
              setSearchArtist('');
              setDurationMin('');
              setDurationMax('');
              setMinListensMe('');
              setMinListensEveryone('');
              setMinRatingMe('');
              setMinRatingCommunity('');
              setSortBy('');
              setSortOrder('desc');
              closeSearchDropdowns();
            }}
            className="rounded-lg bg-groove-600 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-groove-500 focus:outline-none focus:ring-2 focus:ring-ray-500"
          >
            Clear
          </button>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setFiltersExpanded((e) => !e)}
            className="text-sm text-gray-400 hover:text-white focus:outline-none"
          >
            {filtersExpanded ? '▼ Less filters' : '▶ More filters (duration, listens, ratings)'}
          </button>
          {filtersExpanded && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-gray-400">Min duration (sec)</label>
                <input
                  type="number"
                  min={0}
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Max duration (sec)</label>
                <input
                  type="number"
                  min={0}
                  value={durationMax}
                  onChange={(e) => setDurationMax(e.target.value)}
                  placeholder="—"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Min my listens</label>
                <input
                  type="number"
                  min={0}
                  value={minListensMe}
                  onChange={(e) => setMinListensMe(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Min listens (everyone)</label>
                <input
                  type="number"
                  min={0}
                  value={minListensEveryone}
                  onChange={(e) => setMinListensEveryone(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Min my rating (1–5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={minRatingMe}
                  onChange={(e) => setMinRatingMe(e.target.value)}
                  placeholder="—"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Min community rating (0–5)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={minRatingCommunity}
                  onChange={(e) => setMinRatingCommunity(e.target.value)}
                  placeholder="—"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                />
              </div>
            </div>
          )}
        </div>
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
                  onClick={() => setAddMode(user?.has_youtube_cookies ? 'youtube' : 'youtube_no_cookies')}
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
            ) : addMode === 'youtube_no_cookies' ? (
              <div className="space-y-4">
                <p className="text-gray-300">
                  To add songs from YouTube, you need to set up your YouTube cookies in your profile first.
                </p>
                <ol className="list-inside list-decimal space-y-2 text-sm text-gray-400">
                  <li>Install a &quot;cookies.txt&quot; extension in Chrome (e.g. <strong className="text-gray-300">Get cookies.txt LOCALLY</strong>).</li>
                  <li>Go to <a href="https://www.youtube.com" target="_blank" rel="noreferrer" className="text-ray-400 hover:underline">youtube.com</a> and sign in.</li>
                  <li>Use the extension to export cookies in <strong className="text-gray-300">Netscape format</strong> and copy the text.</li>
                  <li>Open your <strong className="text-gray-300">Profile</strong>, paste the cookies into the &quot;YouTube cookies&quot; field, and save.</li>
                </ol>
                <button
                  type="button"
                  onClick={() => { closeAddModal(); navigate('/profile'); }}
                  className="rounded-lg bg-ray-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-ray-500"
                >
                  Open Profile to paste cookies
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
                {uploading && (
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-groove-700">
                      <div
                        className="h-full rounded-full bg-ray-500 transition-all duration-300"
                        style={{ width: `${uploadProgress ?? 0}%` }}
                      />
                    </div>
                    <p className="text-center text-sm text-gray-400">
                      Uploading… {uploadProgress != null ? `${uploadProgress}%` : ''}
                    </p>
                  </div>
                )}
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
                {youtubeLoading && (
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-groove-700">
                      <div className="h-full w-1/3 rounded-full bg-ray-500 animate-progress-indeterminate" />
                    </div>
                    <p className="text-center text-sm text-gray-400">Processing…</p>
                  </div>
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
        {list.length === 0 && !uploadingItem && !youtubePendingItem ? (
          <p className="px-6 py-12 text-center text-gray-500">
            {activeTab === 'mine' && 'No songs yet. Upload or add a YouTube link.'}
            {activeTab === 'favorites' && 'No songs yet. Rate songs or play them to see them here.'}
            {activeTab === 'all' && 'No public songs yet.'}
          </p>
        ) : (
          <>
            {activeTab === 'mine' && uploadingItem && (
              <div
                className="flex cursor-default items-center gap-3 px-6 py-3 text-gray-400"
                aria-busy="true"
                aria-valuenow={uploadingItem.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                role="progressbar"
                aria-label={`Uploading ${uploadingItem.title}`}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700 text-ray-400">
                  <span className="text-lg">◇</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{uploadingItem.title}</p>
                  <p className="truncate text-sm text-gray-400">{uploadingItem.artist} · Uploading</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-groove-700">
                    <div
                      className="h-full rounded-full bg-ray-500 transition-all duration-300"
                      style={{ width: `${uploadingItem.progress}%` }}
                    />
                  </div>
                </div>
                <span className="flex-shrink-0 text-sm text-gray-500">{uploadingItem.progress}%</span>
              </div>
            )}
            {activeTab === 'mine' && youtubePendingItem && (
              <div
                className="flex cursor-default items-center gap-3 px-6 py-3 text-gray-400"
                aria-busy="true"
                aria-label={`Adding from YouTube: ${youtubePendingItem.title}`}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700 text-ray-400">
                  <span className="text-lg">◇</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{youtubePendingItem.title}</p>
                  <p className="truncate text-sm text-gray-400">YouTube · Processing…</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-groove-700">
                    <div className="h-full w-1/3 rounded-full bg-ray-500 animate-progress-indeterminate" />
                  </div>
                </div>
                <span className="flex-shrink-0 text-sm text-gray-500">—</span>
              </div>
            )}
            {list.map((song) => (
            <div
              key={song.id}
              className={`flex cursor-pointer items-center gap-3 px-6 py-3 transition hover:bg-groove-800 ${current?.id === song.id ? 'bg-groove-800/80' : ''}`}
              onClick={() => play(song)}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (current?.id === song.id && playing) {
                    toggle();
                  } else {
                    play(song);
                  }
                }}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-groove-700 text-ray-400 hover:bg-groove-600"
                aria-label={current?.id === song.id && playing ? 'Pause' : 'Play'}
              >
                {current?.id === song.id && playing ? (
                  <span className="text-sm">⏸</span>
                ) : (
                  <span className="text-sm">▶</span>
                )}
              </button>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700 text-ray-400">
                {song.thumbnail_url ? (
                  <img src={song.thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg">◇</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {editingId === song.id ? (
                  <form
                    className="flex min-w-0 flex-1 flex-col gap-2"
                    onSubmit={(e) => handleRename(e, song)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="min-w-0 rounded border border-groove-600 bg-groove-800 px-2 py-1 text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                      placeholder="Song title"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Escape' && cancelRename()}
                    />
                    <div ref={artistDropdownRef} className="relative min-w-0">
                      <input
                        type="text"
                        value={editArtist}
                        onChange={(e) => {
                          setEditArtist(e.target.value);
                          setArtistDropdownOpen(true);
                        }}
                        onFocus={() => setArtistDropdownOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setArtistDropdownOpen(false);
                            cancelRename();
                          }
                        }}
                        className="min-w-0 w-full rounded border border-groove-600 bg-groove-800 px-2 py-1 text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                        placeholder="Artist (type to search or enter new)"
                        autoComplete="off"
                      />
                      {artistDropdownOpen && (
                        <ul className="absolute z-10 mt-1 max-h-40 min-w-full overflow-auto rounded border border-groove-600 bg-groove-800 py-1 shadow-lg">
                          {artistSuggestionsLoading ? (
                            <li className="px-3 py-2 text-sm text-gray-400">Searching…</li>
                          ) : artistSuggestions.length > 0 ? (
                            artistSuggestions.map((name) => (
                              <li key={name}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditArtist(name);
                                    setArtistDropdownOpen(false);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-groove-600 focus:bg-groove-600 focus:outline-none"
                                >
                                  {name}
                                </button>
                              </li>
                            ))
                          ) : (
                            <li className="px-3 py-2 text-sm text-gray-400">Type to search or enter a new artist</li>
                          )}
                        </ul>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={savingId === song.id || !editTitle.trim() || (editTitle.trim() === (song.title ?? '') && editArtist.trim() === (song.artist ?? ''))}
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
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="truncate font-medium text-white">{song.title}</p>
                    <p className="truncate text-sm text-gray-400">
                      {song.artist} · {song.source}
                      {song.uploader_name && song.user_id !== user?.id && (
                        <span className="text-gray-500"> · {song.uploader_name}</span>
                      )}
                    </p>
                  </>
                )}
              </div>
              <span className="flex-shrink-0 rounded bg-groove-600 px-2 py-0.5 text-xs font-mono text-gray-400">
                {song.duration_seconds ? `${Math.floor(song.duration_seconds / 60)}:${String(song.duration_seconds % 60).padStart(2, '0')}` : '--:--'}
              </span>
              {showListenCount && (
                <span className="flex-shrink-0 text-xs text-gray-400" title="Listens">
                  {(activeTab === 'all' || activeTab === 'favorites') ? (
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1" title="Listens by everyone">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {(song.total_listen_count ?? 0) > 0 ? song.total_listen_count : '—'}
                      </span>
                      <span className="text-gray-500" aria-hidden="true">·</span>
                      <span className="flex items-center gap-1" title="My listens">
                        <svg className="h-3.5 w-3.5 text-ray-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {(song.listen_count ?? 0) > 0 ? song.listen_count : '—'}
                      </span>
                    </span>
                  ) : (song.listen_count ?? 0) > 0 ? (
                    <span className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {song.listen_count}
                    </span>
                  ) : (
                    '—'
                  )}
                </span>
              )}
              {showRating && (
                <>
                  <span className="flex-shrink-0 text-xs text-gray-400" title="Community rating">
                    {song.community_rating_count > 0 ? (
                      <span className="flex items-center gap-1">
                        <span className="text-amber-400">
                          {Number(song.community_avg_rating).toFixed(1)} ★
                        </span>
                        <span className="text-gray-500">({song.community_rating_count})</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </span>
                  <div className="flex flex-shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()} title="My rating">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                          disabled={ratingId === song.id}
                          className="rounded p-0.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-ray-500 disabled:opacity-50"
                          onClick={(e) => handleSetRating(e, song, star)}
                        >
                          <span className={((song.rating ?? 0) >= star ? 'text-amber-400' : 'text-gray-500 hover:text-amber-500')}>
                            ★
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {showEditActions() && (
                <>
                  <button
                    type="button"
                    aria-label={song.is_public ? 'Make private' : 'Make public'}
                    title={song.is_public ? 'Public' : 'Private'}
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
                      aria-label="Edit song"
                      title="Edit"
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
                </>
              )}
            </div>
          ))}
          </>
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
                {[10, 20, 50, 100].map((n) => (
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
