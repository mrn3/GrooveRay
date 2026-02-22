import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { artists as artistsApi, images as imagesApi } from '../api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { selfHostedImageUrl } from '../utils/images';
import ListenChart from '../components/ListenChart';
import GrooverLink from '../components/GrooverLink';

function artistDetailUrl(name) {
  return `/artists/${encodeURIComponent(name)}`;
}

export default function Artist() {
  const { name: encodedName } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { play, toggle, current, playing } = usePlayer();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ratingId, setRatingId] = useState(null);
  const [songsPage, setSongsPage] = useState(1);
  const [songsPageSize, setSongsPageSize] = useState(10);
  const [editImageOpen, setEditImageOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [savingImage, setSavingImage] = useState(false);
  const [findingImage, setFindingImage] = useState(false);
  const [listensPeriod, setListensPeriod] = useState('day');
  const [listensHoverBucket, setListensHoverBucket] = useState(null);
  const [listensHoverScope, setListensHoverScope] = useState(null);

  const artistName = encodedName ? decodeURIComponent(encodedName) : '';
  const isOwner = !!data?.can_edit;

  const fetchArtist = useCallback(() => {
    if (!artistName) return;
    setLoading(true);
    setError('');
    artistsApi
      .get(artistName, { page: songsPage, limit: songsPageSize })
      .then(setData)
      .catch((e) => {
        setError(e.message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [artistName, songsPage, songsPageSize]);

  useEffect(() => {
    fetchArtist();
  }, [fetchArtist]);

  const handleRate = async (rating) => {
    if (!user || !artistName) return;
    setRatingId(artistName);
    try {
      await artistsApi.setRating(artistName, rating);
      setData((prev) => (prev ? { ...prev, my_rating: rating } : null));
    } catch (e) {
      setError(e.message);
    } finally {
      setRatingId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  const songs = data.songs?.items ?? [];
  const songsTotal = data.songs?.total ?? 0;

  const openEditModal = () => {
    setEditName(data?.artist ?? '');
    setImageFile(null);
    setEditError('');
    setEditImageOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-8 flex flex-col gap-6">
        <div className="min-w-0 flex-1">
          {isOwner && (
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-groove-700 pb-4">
              <button
                type="button"
                onClick={openEditModal}
                className="rounded-lg border border-groove-600 px-4 py-2 text-sm text-gray-300 hover:bg-groove-700"
              >
                Edit
              </button>
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-groove-700 text-4xl text-ray-500">
              {selfHostedImageUrl(data.image_url) ? (
                <img src={selfHostedImageUrl(data.image_url)} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>♪</span>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={openEditModal}
                  className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 text-sm font-medium text-white opacity-0 transition hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ray-500"
                  title="Edit name and image"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white">{data.artist}</h1>
              <p className="text-gray-400">{data.song_count} song{data.song_count !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Ratings & listens — same layout as Song page */}
        <div className="mt-6 flex flex-wrap items-center gap-6 rounded-xl border border-groove-700 bg-groove-900/50 p-4">
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">My rating:</span>
              <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    disabled={ratingId !== null}
                    onClick={() => handleRate(star)}
                    className="rounded p-0.5 text-lg transition hover:scale-110 disabled:opacity-50"
                  >
                    <span className={(data.my_rating ?? 0) >= star ? 'text-amber-400' : 'text-gray-500'}>★</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {data.community_rating_count > 0 && (
            <span className="text-sm text-gray-400">
              Everyone: ★ {Number(data.community_avg_rating).toFixed(1)}{' '}
              <span className="text-gray-500">({data.community_rating_count} ratings)</span>
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
                <span>My listens: {data.my_listen_count ?? 0}</span>
                <ListenChart
                  buckets={[]}
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
                <span>Total plays: {data.total_listen_count ?? 0}</span>
                <ListenChart
                  buckets={[]}
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

      {editImageOpen && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !savingImage && !savingName && setEditImageOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-groove-700 bg-groove-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-semibold text-white">Edit</h2>
            {editError && (
              <p className="mb-3 rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">{editError}</p>
            )}
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Artist name</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                    placeholder="Artist name"
                  />
                  <button
                    type="button"
                    disabled={savingName || !editName.trim() || editName.trim() === data?.artist}
                    onClick={async () => {
                      if (!artistName || !editName.trim() || editName.trim() === data?.artist) return;
                      setEditError('');
                      setSavingName(true);
                      try {
                        const updated = await artistsApi.update(artistName, { name: editName.trim() });
                        setData((prev) => (prev ? { ...prev, artist: updated.artist, image_url: updated.image_url } : null));
                        setEditImageOpen(false);
                        navigate(artistDetailUrl(updated.artist));
                      } catch (err) {
                        setEditError(err.message || 'Failed to update name');
                      } finally {
                        setSavingName(false);
                      }
                    }}
                    className="rounded-lg bg-ray-600 px-4 py-2 font-medium text-white hover:bg-ray-500 disabled:opacity-50"
                  >
                    {savingName ? 'Saving…' : 'Save name'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">Only your contributed songs will be renamed.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Artist image</label>
                <p className="mb-3 text-xs text-gray-500">Upload an image or find one online (we host it).</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-sm text-gray-300 hover:bg-groove-700">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    />
                    {imageFile ? imageFile.name : 'Choose image…'}
                  </label>
                  <button
                    type="button"
                    disabled={!imageFile || savingImage}
                    onClick={async () => {
                      if (!imageFile || !artistName) return;
                      setEditError('');
                      setSavingImage(true);
                      try {
                        const updated = await artistsApi.uploadImage(artistName, imageFile);
                        setData((prev) => (prev ? { ...prev, image_url: updated.image_url } : null));
                        setImageFile(null);
                        setEditImageOpen(false);
                      } catch (err) {
                        setEditError(err.message || 'Upload failed');
                      } finally {
                        setSavingImage(false);
                      }
                    }}
                    className="rounded-lg bg-ray-600 px-4 py-2 font-medium text-white hover:bg-ray-500 disabled:opacity-50"
                  >
                    {savingImage ? 'Uploading…' : 'Upload'}
                  </button>
                  <button
                    type="button"
                    disabled={findingImage || savingImage}
                    onClick={async () => {
                      if (!artistName) return;
                      setEditError('');
                      setFindingImage(true);
                      try {
                        const query = (data?.artist || 'artist').trim();
                        const { url } = await imagesApi.search(query);
                        const { url: hostedUrl } = await imagesApi.fetchFromUrl(url, 'artist');
                        await artistsApi.update(artistName, { image_url: hostedUrl });
                        setData((prev) => (prev ? { ...prev, image_url: hostedUrl } : null));
                        setEditImageOpen(false);
                      } catch (err) {
                        setEditError(err.message || 'Failed to find image online');
                      } finally {
                        setFindingImage(false);
                      }
                    }}
                    className="rounded-lg border border-groove-600 px-4 py-2 text-gray-300 hover:bg-groove-700 disabled:opacity-50"
                  >
                    {findingImage ? 'Finding…' : 'Find image online'}
                  </button>
                  {data?.image_url && (
                    <button
                      type="button"
                      disabled={savingImage}
                      onClick={async () => {
                        if (!artistName) return;
                        setEditError('');
                        setSavingImage(true);
                        try {
                          await artistsApi.update(artistName, { image_url: null });
                          setData((prev) => (prev ? { ...prev, image_url: null } : null));
                          setEditImageOpen(false);
                        } catch (err) {
                          setEditError(err.message || 'Failed to remove image');
                        } finally {
                          setSavingImage(false);
                        }
                      }}
                      className="rounded-lg border border-groove-600 px-4 py-2 text-red-400 hover:bg-red-900/30 disabled:opacity-50"
                    >
                      Remove image
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <h2 className="mb-3 text-lg font-medium text-white">Songs</h2>
      <div className="space-y-1 rounded-xl border border-groove-700 bg-groove-900/50">
        {songs.length === 0 ? (
          <p className="px-6 py-12 text-center text-gray-500">No songs for this artist.</p>
        ) : (
          songs.map((song) => (
            <div
              key={song.id}
              role="button"
              tabIndex={0}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-6 py-3 transition hover:bg-groove-800 ${current?.id === song.id ? 'bg-groove-800/80' : ''}`}
              onClick={() => navigate(`/songs/${song.id}`)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/songs/${song.id}`)}
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
                {current?.id === song.id && playing ? <span className="text-sm">⏸</span> : <span className="text-sm">▶</span>}
              </button>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700 text-ray-400">
                {selfHostedImageUrl(song.thumbnail_url) ? (
                  <img src={selfHostedImageUrl(song.thumbnail_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg">◇</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{song.title}</p>
                <p className="truncate text-sm text-gray-400">
                  <a
                    href={artistDetailUrl(song.artist)}
                    onClick={(e) => { e.stopPropagation(); navigate(artistDetailUrl(song.artist)); }}
                    className="text-ray-400 hover:underline"
                  >
                    {song.artist}
                  </a>
                  {' · '}
                  {song.source}
                  {song.uploader_name && <span className="text-gray-500"> · <GrooverLink username={song.uploader_name} /></span>}
                </p>
              </div>
              <span className="flex-shrink-0 rounded bg-groove-600 px-2 py-0.5 text-xs font-mono text-gray-400">
                {song.duration_seconds ? `${Math.floor(song.duration_seconds / 60)}:${String(song.duration_seconds % 60).padStart(2, '0')}` : '--:--'}
              </span>
              <div className="flex flex-shrink-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2 text-xs text-gray-400">
                <span className="flex items-center gap-1" title="Listens by everyone">
                  <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {(song.total_listen_count ?? 0) > 0 ? song.total_listen_count : '—'}
                </span>
                <span className="flex items-center gap-1" title="My listens">
                  <svg className="h-3.5 w-3.5 flex-shrink-0 text-ray-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {(song.listen_count ?? 0) > 0 ? song.listen_count : '—'}
                </span>
                <span title="Community rating">
                  {song.community_rating_count > 0 ? (
                    <span className="flex items-center gap-1">
                      <span className="text-amber-400">{Number(song.community_avg_rating).toFixed(1)} ★</span>
                      <span className="text-gray-500">({song.community_rating_count})</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </span>
                <span title="My rating">
                  {song.rating != null ? <span className="text-amber-400">{song.rating} ★</span> : '—'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {songsTotal > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-groove-700 pt-4">
          <p className="text-sm text-gray-400">
            Showing {(songsPage - 1) * songsPageSize + 1}–{Math.min(songsPage * songsPageSize, songsTotal)} of {songsTotal}
          </p>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              Per page
              <select
                value={songsPageSize}
                onChange={(e) => {
                  setSongsPageSize(Number(e.target.value));
                  setSongsPage(1);
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
              disabled={songsPage <= 1}
              onClick={() => setSongsPage((p) => Math.max(1, p - 1))}
              className="rounded border border-groove-600 bg-groove-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-groove-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">
              Page {songsPage} of {Math.max(1, Math.ceil(songsTotal / songsPageSize))}
            </span>
            <button
              type="button"
              disabled={songsPage >= Math.ceil(songsTotal / songsPageSize)}
              onClick={() => setSongsPage((p) => p + 1)}
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
