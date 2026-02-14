import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { songs as songsApi } from '../api';
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

const RATINGS_PAGE_SIZE = 10;

/** Parse "[M:SS]" or "[MM:SS]" or "[H:MM:SS]" at start of line; return { timeSeconds, text }. */
function parseLyricTimestamp(line) {
  const trimmed = line.trim();
  const match = trimmed.match(/^\[?(\d+):(\d+)(?::(\d+))?\]?\s*(.*)$/);
  if (!match) return { timeSeconds: null, text: trimmed };
  const [, m, s, h, rest] = match;
  const minutes = parseInt(m, 10) || 0;
  const seconds = parseInt(s, 10) || 0;
  const hours = h != null ? parseInt(h, 10) || 0 : 0;
  const timeSeconds = hours * 3600 + minutes * 60 + seconds;
  return { timeSeconds, text: rest.trim() || trimmed };
}

function LyricsWithKaraoke({ lyrics, currentTime }) {
  const lines = lyrics.split(/\r?\n/).map((raw) => parseLyricTimestamp(raw));
  let activeIndex = -1;
  if (currentTime != null && Number.isFinite(currentTime)) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].timeSeconds != null && lines[i].timeSeconds <= currentTime) {
        activeIndex = i;
        break;
      }
    }
  }
  return (
    <div className="space-y-1 font-sans text-gray-300">
      {lines.map(({ timeSeconds, text }, i) => (
        <div
          key={i}
          className={`flex gap-3 ${i === activeIndex ? 'rounded-md bg-ray-500/20 text-white' : ''}`}
        >
          {timeSeconds != null && (
            <span className="flex-shrink-0 font-mono text-xs text-gray-500 tabular-nums">
              [{Math.floor(timeSeconds / 60)}:{(timeSeconds % 60).toString().padStart(2, '0')}]
            </span>
          )}
          <span className="whitespace-pre-wrap">{text || '\u00A0'}</span>
        </div>
      ))}
    </div>
  );
}

export default function Song() {
  const { id } = useParams();
  const { user } = useAuth();
  const { play, current, playing, progress } = usePlayer();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ratingId, setRatingId] = useState(null);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const [ratingsData, setRatingsData] = useState(null);
  const [ratingsPage, setRatingsPage] = useState(1);
  const [listensPeriod, setListensPeriod] = useState('day');
  const [myListensHistory, setMyListensHistory] = useState(null);
  const [totalListensHistory, setTotalListensHistory] = useState(null);
  const [listensHoverBucket, setListensHoverBucket] = useState(null);
  const [listensHoverScope, setListensHoverScope] = useState(null);
  const [contentTab, setContentTab] = useState('description');
  const [editOpen, setEditOpen] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editLyrics, setEditLyrics] = useState('');
  const [editGuitarTab, setEditGuitarTab] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSong = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    songsApi
      .get(id)
      .then(setSong)
      .catch((e) => {
        setError(e.message);
        setSong(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchSong();
  }, [fetchSong]);

  useEffect(() => {
    if (!song?.id || !user) return;
    songsApi
      .listensHistory(song.id, { period: listensPeriod, scope: 'me' })
      .then(setMyListensHistory)
      .catch(() => setMyListensHistory({ buckets: [] }));
  }, [song?.id, user, listensPeriod]);

  useEffect(() => {
    if (!song?.id) return;
    songsApi
      .listensHistory(song.id, { period: listensPeriod, scope: 'all' })
      .then(setTotalListensHistory)
      .catch(() => setTotalListensHistory({ buckets: [] }));
  }, [song?.id, listensPeriod]);

  const isOwner = user && song && song.user_id === user.id;

  const handlePlay = () => {
    if (!song) return;
    const track = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      source: song.source,
      file_path: song.file_path,
      thumbnail_url: song.thumbnail_url,
      duration_seconds: song.duration_seconds,
    };
    play(track);
    if (user && song.id) songsApi.recordPlay(song.id).catch(() => {});
  };

  const handleRate = async (rating) => {
    if (!song?.id || !user) return;
    setRatingId(song.id);
    try {
      await songsApi.setRating(song.id, rating);
      setSong((s) => (s ? { ...s, rating } : null));
    } catch (_) {}
    setRatingId(null);
  };

  const handleLoadRatings = () => {
    if (!song?.id) return;
    setRatingsOpen(true);
    setRatingsPage(1);
    setRatingsData(null);
    songsApi.ratings(song.id, { page: 1, limit: RATINGS_PAGE_SIZE }).then(setRatingsData).catch(() => setRatingsData({ ratings: [], total: 0 }));
  };

  const loadRatingsPage = (page) => {
    if (!song?.id) return;
    setRatingsPage(page);
    songsApi.ratings(song.id, { page, limit: RATINGS_PAGE_SIZE }).then(setRatingsData).catch(() => {});
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!song?.id || !isOwner) return;
    setSaving(true);
    try {
      const updated = await songsApi.update(song.id, {
        description: editDescription.trim() || null,
        lyrics: editLyrics.trim() || null,
        guitar_tab: editGuitarTab.trim() || null,
      });
      setSong((s) =>
        s ? { ...s, description: updated.description, lyrics: updated.lyrics, guitar_tab: updated.guitar_tab } : null
      );
      setEditOpen(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" />
      </div>
    );
  }
  if (error || !song) {
    return <p className="text-red-400">{error || 'Song not found'}</p>;
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center gap-4">
            <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-groove-700 text-3xl text-ray-500">
              {song.thumbnail_url ? (
                <img src={song.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>♫</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white">{song.title}</h1>
              <p className="text-gray-400">{song.artist}</p>
              {song.uploader_name && (
                <p className="text-sm text-gray-500">by {song.uploader_name}</p>
              )}
            </div>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">{error}</p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handlePlay}
              className="flex items-center gap-2 rounded-lg bg-ray-600 px-4 py-2 font-medium text-white hover:bg-ray-500"
            >
              <span className="text-lg">▶</span> Play
            </button>
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  setEditDescription(song.description || '');
                  setEditLyrics(song.lyrics || '');
                  setEditGuitarTab(song.guitar_tab || '');
                  setEditOpen(true);
                }}
                className="rounded-lg border border-groove-600 px-4 py-2 text-sm text-gray-300 hover:bg-groove-700"
              >
                Edit description, lyrics & tab
              </button>
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
                      disabled={ratingId === song.id}
                      onClick={() => handleRate(star)}
                      className="rounded p-0.5 text-lg transition hover:scale-110 disabled:opacity-50"
                    >
                      <span className={(song.rating ?? 0) >= star ? 'text-amber-400' : 'text-gray-500'}>★</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {song.community_rating_count > 0 && (
              <span className="text-sm text-gray-400">
                Everyone: ★ {Number(song.community_avg_rating).toFixed(1)}{' '}
                <button
                  type="button"
                  onClick={handleLoadRatings}
                  className="text-ray-400 underline hover:text-ray-300"
                >
                  ({song.community_rating_count} ratings)
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
                  <span>My listens: {song.listen_count ?? 0}</span>
                  <ListenChart
                    buckets={myListensHistory?.buckets ?? []}
                    scope="me"
                    hoverBucket={listensHoverScope === 'me' ? listensHoverBucket : null}
                    onHover={setListensHoverBucket}
                    onHoverScope={() => setListensHoverScope('me')}
                    onHoverEnd={() => {
                      setListensHoverBucket(null);
                      setListensHoverScope(null);
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1 text-sm text-gray-500 min-w-[140px]">
                  <span>Total plays: {song.total_listen_count ?? 0}</span>
                  <ListenChart
                    buckets={totalListensHistory?.buckets ?? []}
                    scope="all"
                    hoverBucket={listensHoverScope === 'all' ? listensHoverBucket : null}
                    onHover={setListensHoverBucket}
                    onHoverScope={() => setListensHoverScope('all')}
                    onHoverEnd={() => {
                      setListensHoverBucket(null);
                      setListensHoverScope(null);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description / Lyrics / Guitar tab */}
      <section className="mb-8">
        <div className="mb-3 flex gap-1 border-b border-groove-700">
          {[
            { id: 'description', label: 'Description' },
            { id: 'lyrics', label: 'Lyrics' },
            { id: 'guitar_tab', label: 'Guitar tab' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setContentTab(tab.id)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
                contentTab === tab.id
                  ? 'border-ray-500 text-ray-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-groove-700 bg-groove-900/50 p-4">
          {contentTab === 'description' && (
            <>
              {song.description ? (
                <p className="whitespace-pre-wrap text-gray-300">{song.description}</p>
              ) : (
                <p className="text-gray-500">No description yet.</p>
              )}
            </>
          )}
          {contentTab === 'lyrics' && (
            <>
              {song.lyrics ? (
                <LyricsWithKaraoke
                  lyrics={song.lyrics}
                  currentTime={current?.id === song?.id && playing ? progress : null}
                />
              ) : (
                <p className="text-gray-500">No lyrics yet. Add lyrics with timestamps for karaoke (e.g. [0:12] Line one).</p>
              )}
            </>
          )}
          {contentTab === 'guitar_tab' && (
            <>
              {song.guitar_tab ? (
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300">{song.guitar_tab}</pre>
              ) : (
                <p className="text-gray-500">No guitar tab yet.</p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Edit modal */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !saving && setEditOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-groove-700 bg-groove-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-white">Edit description, lyrics & guitar tab</h2>
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
                  placeholder="About this song…"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Lyrics (use [M:SS] or [MM:SS] for karaoke timestamps)</label>
                <textarea
                  value={editLyrics}
                  onChange={(e) => setEditLyrics(e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500 font-mono text-sm"
                  placeholder="[0:12] First line\n[0:18] Second line…"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Guitar tab</label>
                <textarea
                  value={editGuitarTab}
                  onChange={(e) => setEditGuitarTab(e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 font-mono text-sm text-white placeholder-gray-500"
                  placeholder="e|-----0---0---0---0---|  B|-----1---1---1---1---|…"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => !saving && setEditOpen(false)}
                  className="rounded-lg px-4 py-2 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-ray-600 px-4 py-2 font-medium text-white hover:bg-ray-500 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ratings modal */}
      {ratingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setRatingsOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[80vh] overflow-auto rounded-xl border border-groove-700 bg-groove-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-white">What everyone rated</h2>
            {ratingsData ? (
              <>
                {ratingsData.avg_rating != null && (
                  <p className="mb-4 text-gray-300">
                    Average: ★ {Number(ratingsData.avg_rating).toFixed(1)} ({ratingsData.rating_count} ratings)
                  </p>
                )}
                <ul className="space-y-2">
                  {ratingsData.ratings?.map((r) => (
                    <li
                      key={r.user_id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-groove-800 px-3 py-2 text-sm"
                    >
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
            <button
              type="button"
              onClick={() => setRatingsOpen(false)}
              className="mt-4 rounded-lg bg-groove-700 px-4 py-2 text-sm text-white hover:bg-groove-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
