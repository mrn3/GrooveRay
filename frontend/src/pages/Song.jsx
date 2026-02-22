import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { songs as songsApi, images as imagesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { selfHostedImageUrl } from '../utils/images';
import ArtistLink from '../components/ArtistLink';
import GrooverLink from '../components/GrooverLink';
import ListenChart from '../components/ListenChart';

function formatRatingDate(updatedAt) {
  if (!updatedAt) return '—';
  const d = new Date(updatedAt);
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
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
  const [editTitle, setEditTitle] = useState('');
  const [editArtists, setEditArtists] = useState([]);
  const [editArtistInput, setEditArtistInput] = useState('');
  const [artistSuggestions, setArtistSuggestions] = useState([]);
  const [artistSuggestionsLoading, setArtistSuggestionsLoading] = useState(false);
  const [artistDropdownOpen, setArtistDropdownOpen] = useState(false);
  const artistDropdownRef = useRef(null);
  const artistDebounceRef = useRef(null);
  const [editDescription, setEditDescription] = useState('');
  const [editLyrics, setEditLyrics] = useState('');
  const [editGuitarTab, setEditGuitarTab] = useState('');
  const [saving, setSaving] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [findingThumbnail, setFindingThumbnail] = useState(false);

  function parseArtistString(str) {
    if (!str || typeof str !== 'string') return [];
    return str.split(',').map((s) => s.trim()).filter(Boolean);
  }

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

  // Artist autocomplete when edit modal is open
  useEffect(() => {
    if (!editOpen) return;
    if (artistDebounceRef.current) clearTimeout(artistDebounceRef.current);
    artistDebounceRef.current = setTimeout(() => {
      setArtistSuggestionsLoading(true);
      const q = editArtistInput.trim();
      songsApi.artists(q).then(setArtistSuggestions).catch(() => setArtistSuggestions([])).finally(() => setArtistSuggestionsLoading(false));
    }, 200);
    return () => {
      if (artistDebounceRef.current) clearTimeout(artistDebounceRef.current);
    };
  }, [editOpen, editArtistInput]);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (artistDropdownRef.current && !artistDropdownRef.current.contains(e.target)) {
        setArtistDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

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
    const newTitle = editTitle.trim();
    if (!newTitle) return;
    setSaving(true);
    try {
      const artistValue = editArtists.length ? editArtists.join(', ') : null;
      const updated = await songsApi.update(song.id, {
        title: newTitle,
        artist: artistValue,
        description: editDescription.trim() || null,
        lyrics: editLyrics.trim() || null,
        guitar_tab: editGuitarTab.trim() || null,
      });
      setSong((s) =>
        s
          ? {
              ...s,
              title: updated.title,
              artist: updated.artist,
              description: updated.description,
              lyrics: updated.lyrics,
              guitar_tab: updated.guitar_tab,
            }
          : null
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

  const openEditModal = () => {
    setEditTitle(song.title || '');
    setEditArtists(parseArtistString(song.artist));
    setEditArtistInput('');
    setArtistSuggestions([]);
    setArtistDropdownOpen(false);
    setEditDescription(song.description || '');
    setEditLyrics(song.lyrics || '');
    setEditGuitarTab(song.guitar_tab || '');
    setThumbnailFile(null);
    setEditOpen(true);
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {/* Top action bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-groove-700 pb-4">
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
                onClick={openEditModal}
                className="rounded-lg border border-groove-600 px-4 py-2 text-sm text-gray-300 hover:bg-groove-700"
              >
                Edit
              </button>
            )}
          </div>

          <div className="mb-4 flex items-center gap-4">
            <div className="flex flex-shrink-0 flex-col items-start gap-2">
              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-groove-700 text-3xl text-ray-500">
                {selfHostedImageUrl(song.thumbnail_url) ? (
                  <img src={selfHostedImageUrl(song.thumbnail_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>♫</span>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white">{song.title}</h1>
              <p className="text-gray-400"><ArtistLink artist={song.artist} /></p>
              {song.uploader_name && (
                <p className="text-sm text-gray-500">by <GrooverLink username={song.uploader_name} /></p>
              )}
            </div>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">{error}</p>
          )}

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
          onClick={() => !saving && setEditOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border border-groove-700 bg-groove-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 p-6 pb-0">
              <h2 className="mb-4 text-lg font-semibold text-white">Edit</h2>
            </div>
            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500"
                  placeholder="Song title"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Artists</label>
                <div ref={artistDropdownRef} className="flex flex-wrap gap-2 rounded-lg border border-groove-600 bg-groove-800 p-2">
                  {editArtists.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-md bg-groove-600 px-2 py-1 text-sm text-white"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => setEditArtists((prev) => prev.filter((a) => a !== name))}
                        className="rounded p-0.5 text-gray-400 hover:bg-groove-500 hover:text-white"
                        aria-label={`Remove ${name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <div className="relative min-w-[140px] flex-1">
                    <input
                      type="text"
                      value={editArtistInput}
                      onChange={(e) => {
                        setEditArtistInput(e.target.value);
                        setArtistDropdownOpen(true);
                      }}
                      onFocus={() => setArtistDropdownOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          const v = (e.key === ',' ? editArtistInput.replace(/,/g, '') : editArtistInput).trim();
                          if (v && !editArtists.includes(v)) {
                            setEditArtists((prev) => [...prev, v]);
                            setEditArtistInput('');
                            setArtistDropdownOpen(false);
                          }
                          if (e.key === ',') setEditArtistInput((prev) => prev.replace(/,/g, ''));
                        }
                      }}
                      className="min-w-0 w-full border-0 bg-transparent px-2 py-1 text-white placeholder-gray-500 focus:outline-none focus:ring-0"
                      placeholder={editArtists.length ? 'Add artist…' : 'Type to search or add artists'}
                      autoComplete="off"
                    />
                    {artistDropdownOpen && (
                      <ul className="absolute left-0 top-full z-10 mt-1 max-h-40 min-w-full overflow-auto rounded border border-groove-600 bg-groove-800 py-1 shadow-lg">
                        {artistSuggestionsLoading ? (
                          <li className="px-3 py-2 text-sm text-gray-400">Searching…</li>
                        ) : artistSuggestions.length > 0 ? (
                          artistSuggestions.map((name) => (
                            <li key={name}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!editArtists.includes(name)) setEditArtists((prev) => [...prev, name]);
                                  setEditArtistInput('');
                                  setArtistDropdownOpen(false);
                                }}
                                className="w-full px-3 py-1.5 text-left text-sm text-white hover:bg-groove-600 focus:bg-groove-600 focus:outline-none"
                              >
                                {name}
                              </button>
                            </li>
                          ))
                        ) : editArtistInput.trim() ? (
                          <li>
                            <button
                              type="button"
                              onClick={() => {
                                const v = editArtistInput.trim();
                                if (v && !editArtists.includes(v)) setEditArtists((prev) => [...prev, v]);
                                setEditArtistInput('');
                                setArtistDropdownOpen(false);
                              }}
                              className="w-full px-3 py-1.5 text-left text-sm text-gray-400 hover:bg-groove-600 focus:outline-none"
                            >
                              Add &quot;{editArtistInput.trim()}&quot;
                            </button>
                          </li>
                        ) : (
                          <li className="px-3 py-2 text-sm text-gray-400">Type to search or add a new artist</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Cover image</label>
                <p className="mb-2 text-xs text-gray-500">Upload or change the song thumbnail.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-gray-300 hover:bg-groove-700">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                    />
                    {thumbnailFile ? thumbnailFile.name : 'Choose image…'}
                  </label>
                  <button
                    type="button"
                    disabled={!thumbnailFile || uploadingThumbnail}
                    onClick={async () => {
                      if (!thumbnailFile || !song?.id) return;
                      setUploadingThumbnail(true);
                      try {
                        const updated = await songsApi.uploadThumbnail(song.id, thumbnailFile);
                        setSong(updated);
                        setThumbnailFile(null);
                      } catch (e) {
                        setError(e.message);
                      } finally {
                        setUploadingThumbnail(false);
                      }
                    }}
                    className="rounded-lg bg-ray-600 px-3 py-2 text-sm font-medium text-white hover:bg-ray-500 disabled:opacity-50"
                  >
                    {uploadingThumbnail ? 'Uploading…' : 'Upload'}
                  </button>
                  {song.thumbnail_url && (
                    <button
                      type="button"
                      disabled={uploadingThumbnail}
                      onClick={async () => {
                        if (!song?.id) return;
                        setUploadingThumbnail(true);
                        try {
                          const updated = await songsApi.update(song.id, { thumbnail_url: null });
                          setSong(updated);
                        } catch (e) {
                          setError(e.message);
                        } finally {
                          setUploadingThumbnail(false);
                        }
                      }}
                      className="rounded-lg border border-groove-600 px-3 py-2 text-sm text-gray-400 hover:bg-groove-700 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                  {song.youtube_id && (
                    <button
                      type="button"
                      disabled={findingThumbnail || uploadingThumbnail}
                      onClick={async () => {
                        if (!song?.id || !song.youtube_id) return;
                        setFindingThumbnail(true);
                        setError('');
                        try {
                          const { url, fallbackUrl } = await imagesApi.youtubeThumbnail(song.youtube_id);
                          let result;
                          try {
                            result = await imagesApi.fetchFromUrl(url, 'thumbnail');
                          } catch (_) {
                            result = await imagesApi.fetchFromUrl(fallbackUrl, 'thumbnail');
                          }
                          const updated = await songsApi.update(song.id, { thumbnail_url: result.url });
                          setSong(updated);
                        } catch (e) {
                          setError(e.message || 'Failed to use YouTube thumbnail');
                        } finally {
                          setFindingThumbnail(false);
                        }
                      }}
                      className="rounded-lg border border-groove-600 px-3 py-2 text-sm text-gray-400 hover:bg-groove-700 disabled:opacity-50"
                    >
                      Use YouTube thumbnail
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={findingThumbnail || uploadingThumbnail}
                    onClick={async () => {
                      if (!song?.id) return;
                      setFindingThumbnail(true);
                      setError('');
                      try {
                        const query = [song.title, song.artist].filter(Boolean).join(' ').trim() || song.title || 'music';
                        const { url } = await imagesApi.search(query);
                        const { url: hostedUrl } = await imagesApi.fetchFromUrl(url, 'thumbnail');
                        const updated = await songsApi.update(song.id, { thumbnail_url: hostedUrl });
                        setSong(updated);
                      } catch (e) {
                        setError(e.message || 'Failed to find image online');
                      } finally {
                        setFindingThumbnail(false);
                      }
                    }}
                    className="rounded-lg border border-groove-600 px-3 py-2 text-sm text-gray-400 hover:bg-groove-700 disabled:opacity-50"
                  >
                    Find image online
                  </button>
                </div>
              </div>
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
              </div>
              <div className="flex flex-shrink-0 justify-end gap-2 border-t border-groove-700 bg-groove-900 p-6 pt-4">
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
                      <GrooverLink username={r.username} className="text-gray-300" />
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
