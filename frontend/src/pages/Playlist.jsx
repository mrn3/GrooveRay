import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { playlists as playlistsApi, songs as songsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';

function formatRatingDate(updatedAt) {
  if (!updatedAt) return '—';
  const d = new Date(updatedAt);
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function ListenChart({ buckets, scope, hoverBucket, onHover, onHoverScope, onHoverEnd }) {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="relative flex items-end gap-0.5" style={{ minHeight: 32 }}>
      {buckets.length === 0 ? (
        <span className="text-xs text-gray-500">No data for this period</span>
      ) : (
        buckets.map((bucket) => {
          const isHovered = hoverBucket && hoverBucket.date === bucket.date && hoverBucket.label === bucket.label;
          return (
            <div
              key={bucket.label}
              className="group relative flex-1 min-w-0 flex flex-col items-center"
              onMouseEnter={() => {
                onHoverScope();
                onHover(bucket);
              }}
              onMouseLeave={onHoverEnd}
            >
              <div
                className="w-full rounded-t bg-groove-600 transition hover:bg-ray-500"
                style={{ height: Math.max(4, (bucket.count / maxCount) * 28) }}
                title={`${bucket.label}: ${bucket.count} play${bucket.count !== 1 ? 's' : ''}`}
              />
              {isHovered && bucket.events && bucket.events.length > 0 && (
                <div className="absolute bottom-full left-1/2 z-50 mb-1 w-56 -translate-x-1/2 rounded-lg border border-groove-600 bg-groove-900 p-2 shadow-xl">
                  <p className="mb-2 text-xs font-medium text-gray-300">{bucket.label}</p>
                  <ul className="max-h-40 overflow-auto text-xs text-gray-400 space-y-1">
                    {bucket.events.map((ev, i) => (
                      <li key={i}>
                        {ev.username} — {ev.played_at ? new Date(ev.played_at).toLocaleString() : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default function Playlist() {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play, current, playing } = usePlayer();
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ratingId, setRatingId] = useState(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const [ratingsData, setRatingsData] = useState(null);
  const [ratingsPage, setRatingsPage] = useState(1);
  const RATINGS_PAGE_SIZE = 10;
  const [listensOpen, setListensOpen] = useState(false);
  const [listensData, setListensData] = useState(null);
  const [listensPeriod, setListensPeriod] = useState('day');
  const [myListensHistory, setMyListensHistory] = useState(null);
  const [totalListensHistory, setTotalListensHistory] = useState(null);
  const [listensHoverBucket, setListensHoverBucket] = useState(null);
  const [listensHoverScope, setListensHoverScope] = useState(null);
  const [addTrackOpen, setAddTrackOpen] = useState(false);
  const [addTrackInput, setAddTrackInput] = useState('');
  const [songsForAdd, setSongsForAdd] = useState([]);
  const addTrackRef = useRef(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editThumbnail, setEditThumbnail] = useState('');
  const [editPublic, setEditPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPlaylist = useCallback(() => {
    if (!id && !slug) return;
    setLoading(true);
    setError('');
    const promise = slug ? playlistsApi.getBySlug(slug) : playlistsApi.get(id);
    promise
      .then(setPlaylist)
      .catch((e) => {
        setError(e.message);
        setPlaylist(null);
      })
      .finally(() => setLoading(false));
  }, [id, slug]);

  useEffect(() => {
    fetchPlaylist();
  }, [fetchPlaylist]);

  useEffect(() => {
    songsApi.listPublic({ limit: 200 }).then((data) => setSongsForAdd(data?.items ?? [])).catch(() => setSongsForAdd([]));
  }, []);

  useEffect(() => {
    function handleClickOutside(ev) {
      if (addTrackRef.current && !addTrackRef.current.contains(ev.target)) setAddTrackOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isOwner = user && playlist && playlist.user_id === user.id;

  const handlePlay = () => {
    if (!playlist?.tracks?.length) return;
    const first = playlist.tracks[0];
    const song = {
      id: first.song_id,
      title: first.title,
      artist: first.artist,
      source: first.source,
      file_path: first.file_path,
      thumbnail_url: first.thumbnail_url,
      duration_seconds: first.duration_seconds,
    };
    play(song);
    if (user && playlist.id) playlistsApi.recordPlay(playlist.id).catch(() => {});
  };

  const handlePlayTrack = (track) => {
    const song = {
      id: track.song_id,
      title: track.title,
      artist: track.artist,
      source: track.source,
      file_path: track.file_path,
      thumbnail_url: track.thumbnail_url,
      duration_seconds: track.duration_seconds,
    };
    play(song);
    if (user && playlist?.id) playlistsApi.recordPlay(playlist.id).catch(() => {});
  };

  const handleRate = async (rating) => {
    if (!playlist?.id || !user) return;
    setRatingId(playlist.id);
    try {
      await playlistsApi.setRating(playlist.id, rating);
      setPlaylist((p) => (p ? { ...p, rating } : null));
    } catch (_) {}
    setRatingId(null);
  };

  const handleShare = async () => {
    if (!playlist?.id || !isOwner) return;
    try {
      const updated = await playlistsApi.share(playlist.id);
      const url = `${window.location.origin}/playlists/by/${updated.slug}`;
      await navigator.clipboard.writeText(url);
      setPlaylist((p) => (p ? { ...p, slug: updated.slug } : null));
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (_) {}
  };

  const handleAddTrack = async (songId) => {
    if (!playlist?.id || !isOwner) return;
    try {
      await playlistsApi.addTrack(playlist.id, songId);
      fetchPlaylist();
      setAddTrackOpen(false);
      setAddTrackInput('');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemoveTrack = async (songId) => {
    if (!playlist?.id || !isOwner) return;
    try {
      await playlistsApi.removeTrack(playlist.id, songId);
      setPlaylist((p) => (p ? { ...p, tracks: p.tracks.filter((t) => t.song_id !== songId) } : null));
    } catch (_) {}
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!playlist?.id || !isOwner) return;
    setSaving(true);
    try {
      const updated = await playlistsApi.update(playlist.id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        thumbnail_url: editThumbnail.trim() || null,
        is_public: editPublic,
      });
      setPlaylist(updated);
      setEditOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!playlist?.id || !isOwner) return;
    if (!window.confirm(`Delete "${playlist.name}"? This cannot be undone.`)) return;
    try {
      await playlistsApi.delete(playlist.id);
      navigate('/playlists');
    } catch (e) {
      setError(e.message || 'Failed to delete playlist');
    }
  };

  const handleLoadRatings = () => {
    if (!playlist?.id) return;
    setRatingsOpen(true);
    setRatingsPage(1);
    setRatingsData(null);
    playlistsApi.ratings(playlist.id, { page: 1, limit: RATINGS_PAGE_SIZE }).then(setRatingsData).catch(() => setRatingsData({ ratings: [], total: 0 }));
  };

  const loadRatingsPage = (page) => {
    if (!playlist?.id) return;
    setRatingsPage(page);
    playlistsApi.ratings(playlist.id, { page, limit: RATINGS_PAGE_SIZE }).then(setRatingsData).catch(() => {});
  };

  const handleLoadListens = () => {
    if (!playlist?.id) return;
    setListensOpen(true);
    if (!listensData) playlistsApi.listens(playlist.id).then(setListensData).catch(() => setListensData({ by_user: [] }));
  };

  useEffect(() => {
    if (!playlist?.id || !user) return;
    playlistsApi.listensHistory(playlist.id, { period: listensPeriod, scope: 'me' }).then(setMyListensHistory).catch(() => setMyListensHistory({ buckets: [] }));
  }, [playlist?.id, user, listensPeriod]);

  useEffect(() => {
    if (!playlist?.id) return;
    playlistsApi.listensHistory(playlist.id, { period: listensPeriod, scope: 'all' }).then(setTotalListensHistory).catch(() => setTotalListensHistory({ buckets: [] }));
  }, [playlist?.id, listensPeriod]);

  const addTrackQuery = addTrackInput.trim().toLowerCase();
  const addSuggestions = addTrackQuery
    ? songsForAdd.filter(
        (s) =>
          (s.title || '').toLowerCase().includes(addTrackQuery) ||
          (s.artist || '').toLowerCase().includes(addTrackQuery)
      ).slice(0, 8)
    : [];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" />
      </div>
    );
  }
  if (error || !playlist) {
    return <p className="text-red-400">{error || 'Playlist not found'}</p>;
  }

  const tracks = playlist.tracks || [];

  return (
    <div>
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center gap-4">
            <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-groove-700 text-3xl text-ray-500">
              {playlist.thumbnail_url ? (
                <img src={playlist.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>♫</span>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setEditName(playlist.name);
                    setEditDesc(playlist.description || '');
                    setEditThumbnail(playlist.thumbnail_url || '');
                    setEditPublic(!!playlist.is_public);
                    setEditOpen(true);
                  }}
                  className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 text-xs font-medium text-white opacity-0 transition hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ray-500"
                  title="Edit playlist (including thumbnail)"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white">{playlist.name}</h1>
              {playlist.description && <p className="text-gray-400">{playlist.description}</p>}
              <p className="text-sm text-gray-500">by {playlist.owner_name}</p>
            </div>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">{error}</p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            {tracks.length > 0 && (
              <button
                type="button"
                onClick={handlePlay}
                className="flex items-center gap-2 rounded-lg bg-ray-600 px-4 py-2 font-medium text-white hover:bg-ray-500"
              >
                <span className="text-lg">▶</span> Play
              </button>
            )}
            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditName(playlist.name);
                    setEditDesc(playlist.description || '');
                    setEditThumbnail(playlist.thumbnail_url || '');
                    setEditPublic(!!playlist.is_public);
                    setEditOpen(true);
                  }}
                  className="rounded-lg border border-groove-600 px-4 py-2 text-sm text-gray-300 hover:bg-groove-700"
                >
                  Edit
                </button>
                {playlist.slug ? (
                  <button
                    type="button"
                    onClick={handleShare}
                    className="rounded-lg border border-groove-600 px-4 py-2 text-sm text-gray-300 hover:bg-groove-700"
                  >
                    {shareCopied ? 'Link copied!' : 'Copy share link'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleShare}
                    className="rounded-lg border border-groove-600 px-4 py-2 text-sm text-gray-300 hover:bg-groove-700"
                  >
                    Create share link
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-lg border border-red-900/60 px-4 py-2 text-sm text-red-400 hover:bg-red-900/30"
                >
                  Delete playlist
                </button>
              </>
            )}
          </div>

          {/* Rate & stats */}
          <div className="mt-6 flex flex-wrap items-center gap-6 rounded-xl border border-groove-700 bg-groove-900/50 p-4">
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">My rating:</span>
                <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      disabled={ratingId === playlist.id}
                      onClick={() => handleRate(star)}
                      className="rounded p-0.5 text-lg transition hover:scale-110 disabled:opacity-50"
                    >
                      <span className={(playlist.rating ?? 0) >= star ? 'text-amber-400' : 'text-gray-500'}>★</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {playlist.community_rating_count > 0 && (
              <span className="text-sm text-gray-400">
                Everyone: ★ {Number(playlist.community_avg_rating).toFixed(1)}{' '}
                <button
                  type="button"
                  onClick={handleLoadRatings}
                  className="text-ray-400 underline hover:text-ray-300"
                >
                  ({playlist.community_rating_count} ratings)
                </button>
              </span>
            )}
            <div className="w-full flex flex-col gap-2">
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>By:</span>
                {['day', 'week', 'month'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setListensPeriod(p)}
                    className={`capitalize ${listensPeriod === p ? 'text-ray-400 font-medium' : 'hover:text-gray-300'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-6">
                <div className="flex flex-col gap-1 text-sm text-gray-500 min-w-[140px]">
                  <span>My listens: {playlist.listen_count ?? 0}</span>
                  <ListenChart
                    buckets={myListensHistory?.buckets ?? []}
                    scope="me"
                    hoverBucket={listensHoverScope === 'me' ? listensHoverBucket : null}
                    onHover={setListensHoverBucket}
                    onHoverScope={() => setListensHoverScope('me')}
                    onHoverEnd={() => { setListensHoverBucket(null); setListensHoverScope(null); }}
                  />
                </div>
                <div className="flex flex-col gap-1 text-sm text-gray-500 min-w-[140px]">
                  <span>Total plays: {playlist.total_listen_count ?? 0}</span>
                  <ListenChart
                    buckets={totalListensHistory?.buckets ?? []}
                    scope="all"
                    hoverBucket={listensHoverScope === 'all' ? listensHoverBucket : null}
                    onHover={setListensHoverBucket}
                    onHoverScope={() => setListensHoverScope('all')}
                    onHoverEnd={() => { setListensHoverBucket(null); setListensHoverScope(null); }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add track (owner) */}
      {isOwner && (
        <div className="mb-6">
          <div ref={addTrackRef} className="relative max-w-md">
            <input
              type="text"
              value={addTrackInput}
              onChange={(e) => {
                setAddTrackInput(e.target.value);
                setAddTrackOpen(true);
              }}
              onFocus={() => setAddTrackOpen(true)}
              placeholder="Add a song to this playlist…"
              className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
              autoComplete="off"
            />
            {addTrackOpen && addSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-groove-600 bg-groove-800 py-1 shadow-lg">
                {addSuggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => handleAddTrack(s.id)}
                      className="w-full px-4 py-2 text-left text-white hover:bg-groove-600"
                    >
                      {s.title} — {s.artist}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Tracks */}
      <section>
        <h2 className="mb-3 text-lg font-medium text-white">Tracks ({tracks.length})</h2>
        <div className="space-y-1 rounded-xl border border-groove-700 bg-groove-900/50 overflow-hidden">
          {tracks.length === 0 ? (
            <p className="px-6 py-12 text-center text-gray-500">
              No tracks yet.{isOwner && ' Use the search above to add songs.'}
            </p>
          ) : (
            tracks.map((track, index) => (
              <div
                key={`${track.song_id}-${index}`}
                className={`flex items-center gap-4 border-b border-groove-700 px-4 py-3 last:border-0 hover:bg-groove-800/50 ${
                  current?.id === track.song_id ? 'bg-groove-800/80' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => handlePlayTrack(track)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-groove-700 text-ray-400 hover:bg-groove-600"
                >
                  {current?.id === track.song_id && playing ? (
                    <span className="text-sm">⏸</span>
                  ) : (
                    <span className="text-sm">▶</span>
                  )}
                </button>
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700">
                  {track.thumbnail_url ? (
                    <img src={track.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-ray-400">◇</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{track.title}</p>
                  <p className="text-sm text-gray-400">{track.artist}</p>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTrack(track.song_id)}
                    className="rounded p-2 text-gray-400 hover:bg-red-900/30 hover:text-red-300"
                    title="Remove from playlist"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !saving && setEditOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-groove-700 bg-groove-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-white">Edit playlist</h2>
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Thumbnail image URL</label>
                <input
                  type="url"
                  value={editThumbnail}
                  onChange={(e) => setEditThumbnail(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={editPublic}
                  onChange={(e) => setEditPublic(e.target.checked)}
                  className="rounded border-groove-600 bg-groove-800 text-ray-600"
                />
                <span className="text-sm text-gray-300">Public (show in Explore)</span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => !saving && setEditOpen(false)} className="rounded-lg px-4 py-2 text-gray-400 hover:text-white">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-ray-600 px-4 py-2 font-medium text-white hover:bg-ray-500 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ratings modal */}
      {ratingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setRatingsOpen(false)}>
          <div className="w-full max-w-md max-h-[80vh] overflow-auto rounded-xl border border-groove-700 bg-groove-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-white">What everyone rated</h2>
            {ratingsData ? (
              <>
                {ratingsData.avg_rating != null && (
                  <p className="mb-4 text-gray-300">Average: ★ {Number(ratingsData.avg_rating).toFixed(1)} ({ratingsData.rating_count} ratings)</p>
                )}
                <ul className="space-y-2">
                  {ratingsData.ratings?.map((r) => (
                    <li key={r.user_id} className="flex items-center justify-between gap-2 rounded-lg bg-groove-800 px-3 py-2 text-sm">
                      <span className="text-gray-300">{r.username}</span>
                      <span className="text-amber-400">★ {r.rating}</span>
                      <span className="text-xs text-gray-500">{formatRatingDate(r.updated_at)}</span>
                    </li>
                  ))}
                </ul>
                {ratingsData.total > RATINGS_PAGE_SIZE && (
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <button
                      type="button"
                      disabled={ratingsPage <= 1}
                      onClick={() => loadRatingsPage(ratingsPage - 1)}
                      className="rounded px-3 py-1 text-gray-400 hover:text-white disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-gray-400">
                      Page {ratingsPage} of {Math.ceil((ratingsData.total || 0) / RATINGS_PAGE_SIZE)}
                    </span>
                    <button
                      type="button"
                      disabled={ratingsPage >= Math.ceil((ratingsData.total || 0) / RATINGS_PAGE_SIZE)}
                      onClick={() => loadRatingsPage(ratingsPage + 1)}
                      className="rounded px-3 py-1 text-gray-400 hover:text-white disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500">Loading…</p>
            )}
            <button type="button" onClick={() => setRatingsOpen(false)} className="mt-4 rounded-lg bg-groove-700 px-4 py-2 text-sm text-white hover:bg-groove-600">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Listens modal */}
      {listensOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setListensOpen(false)}>
          <div className="w-full max-w-md max-h-[80vh] overflow-auto rounded-xl border border-groove-700 bg-groove-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-white">Everyone&apos;s listens</h2>
            {listensData ? (
              <>
                <p className="mb-4 text-gray-300">Total plays: {listensData.total_listen_count ?? 0}</p>
                <ul className="space-y-2">
                  {listensData.by_user?.map((u) => (
                    <li key={u.user_id} className="flex justify-between rounded-lg bg-groove-800 px-3 py-2 text-sm">
                      <span className="text-gray-300">{u.username}</span>
                      <span className="text-gray-400">{u.listen_count} plays</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-gray-500">Loading…</p>
            )}
            <button type="button" onClick={() => setListensOpen(false)} className="mt-4 rounded-lg bg-groove-700 px-4 py-2 text-sm text-white hover:bg-groove-600">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
