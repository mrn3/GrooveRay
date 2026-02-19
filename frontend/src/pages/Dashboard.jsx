import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboard as dashboardApi, playlists as playlistsApi } from '../api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';

const PERIODS = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
];

function formatRelativeTime(createdAt) {
  if (!createdAt) return '—';
  const d = new Date(createdAt);
  const now = new Date();
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return `${sec} second${sec === 1 ? '' : 's'} ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  const week = Math.floor(day / 7);
  return `${week} week${week === 1 ? '' : 's'} ago`;
}

/** Compact song row: play button + thumbnail + title/artist + optional meta (listens / rating / relative date). */
function SongListRow({ song, meta }) {
  const { play, current, playing } = usePlayer();
  const isActive = current?.id === song.id;
  const handlePlay = (e) => {
    e.preventDefault();
    e.stopPropagation();
    play({
      id: song.id,
      title: song.title,
      artist: song.artist,
      source: song.source,
      file_path: song.file_path,
      thumbnail_url: song.thumbnail_url,
      duration_seconds: song.duration_seconds,
    });
  };
  return (
    <Link
      to={`/songs/${song.id}`}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-groove-800"
    >
      <button
        type="button"
        onClick={handlePlay}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-groove-700 text-ray-400 hover:bg-groove-600"
        aria-label={isActive && playing ? 'Pause' : 'Play'}
      >
        {isActive && playing ? <span className="text-xs">⏸</span> : <span className="text-xs">▶</span>}
      </button>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700">
        {song.thumbnail_url ? (
          <img src={song.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-ray-400">◇</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white" title={song.title}>{song.title}</p>
        <p className="truncate text-xs text-gray-400" title={song.artist}>{song.artist || '—'}</p>
      </div>
      {meta != null && (
        <span className="flex-shrink-0 text-xs text-gray-400">{meta}</span>
      )}
    </Link>
  );
}

function SongListColumn({ title, items, emptyMessage, metaFn }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-groove-700 bg-groove-900/40 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
      {!items?.length ? (
        <p className="py-2 text-center text-xs text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((song) => (
            <li key={song.id}>
              <SongListRow song={song} meta={metaFn ? metaFn(song) : null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Compact playlist row: same layout as SongListRow — play button + thumbnail + name/owner + meta. */
function PlaylistListRow({ playlist, meta }) {
  const { play } = usePlayer();
  const { user } = useAuth();
  const linkTo = playlist.slug ? `/playlists/by/${playlist.slug}` : `/playlists/${playlist.id}`;
  const handlePlay = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if ((playlist.track_count ?? 0) === 0) return;
    playlistsApi.tracks(playlist.id).then((tracks) => {
      const first = tracks?.[0];
      if (!first) return;
      play({
        id: first.song_id,
        title: first.title,
        artist: first.artist,
        source: first.source,
        file_path: first.file_path,
        thumbnail_url: first.thumbnail_url,
        duration_seconds: first.duration_seconds,
      });
      if (user && playlist.id) playlistsApi.recordPlay(playlist.id).catch(() => {});
    }).catch(() => {});
  };
  return (
    <Link
      to={linkTo}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-groove-800"
    >
      <button
        type="button"
        onClick={handlePlay}
        disabled={(playlist.track_count ?? 0) === 0}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-groove-700 text-ray-400 hover:bg-groove-600 disabled:pointer-events-none disabled:opacity-50"
        aria-label={(playlist.track_count ?? 0) === 0 ? 'Playlist has no tracks' : 'Play playlist'}
      >
        <span className="text-xs">▶</span>
      </button>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700">
        {playlist.thumbnail_url ? (
          <img src={playlist.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-ray-400">♫</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white" title={playlist.name}>{playlist.name}</p>
        <p className="truncate text-xs text-gray-400" title={playlist.owner_name}>
          {playlist.owner_name}{playlist.track_count != null ? ` · ${playlist.track_count} tracks` : ''}
        </p>
      </div>
      {meta != null && (
        <span className="flex-shrink-0 text-xs text-gray-400">{meta}</span>
      )}
    </Link>
  );
}

function PlaylistListColumn({ title, items, emptyMessage, metaFn }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-groove-700 bg-groove-900/40 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
      {!items?.length ? (
        <p className="py-2 text-center text-xs text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((pl) => (
            <li key={pl.id}>
              <PlaylistListRow playlist={pl} meta={metaFn ? metaFn(pl) : null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Compact station row: same layout as SongListRow — link + thumbnail (image_url) + name/owner + meta. */
function StationListRow({ station, meta }) {
  const linkTo = `/stations/${station.slug || station.id}`;
  return (
    <Link
      to={linkTo}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-groove-800"
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-groove-700 text-ray-400">
        <span className="text-xs">▶</span>
      </div>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-groove-700">
        {station.image_url ? (
          <img src={station.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-ray-400">◇</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white" title={station.name}>{station.name}</p>
        <p className="truncate text-xs text-gray-400" title={station.owner_name}>{station.owner_name || '—'}</p>
      </div>
      {meta != null && (
        <span className="flex-shrink-0 text-xs text-gray-400">{meta}</span>
      )}
    </Link>
  );
}

function StationListColumn({ title, items, emptyMessage, metaFn }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-groove-700 bg-groove-900/40 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
      {!items?.length ? (
        <p className="py-2 text-center text-xs text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((station) => (
            <li key={station.id}>
              <StationListRow station={station} meta={metaFn ? metaFn(station) : null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    dashboardApi
      .get({ period })
      .then(setData)
      .catch((e) => {
        setError(e.message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <nav className="flex rounded-lg bg-groove-800/80 p-1" aria-label="Time range">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-ray-500 focus:ring-offset-2 focus:ring-offset-groove-900 ${
                period === p.id ? 'bg-groove-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-900/30 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" />
        </div>
      ) : data ? (
        <div className="space-y-10">
          {/* Songs: three columns in one row */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">Songs</h2>
            <div className="flex gap-4">
              <SongListColumn
                title="Most Listens"
                items={data.songs?.popular}
                emptyMessage="No songs in this period."
                metaFn={(s) => (
                  <span className="flex items-center gap-1" title="Listens by everyone">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {(s.total_listen_count ?? 0) > 0 ? s.total_listen_count : '—'}
                  </span>
                )}
              />
              <SongListColumn
                title="Highest rated"
                items={data.songs?.highestRated}
                emptyMessage="No rated songs."
                metaFn={(s) =>
                  s.community_rating_count > 0 ? (
                    <span className="text-amber-400">
                      {Number(s.community_avg_rating).toFixed(1)} ★ ({s.community_rating_count})
                    </span>
                  ) : '—'
                }
              />
              <SongListColumn
                title="New"
                items={data.songs?.new}
                emptyMessage="No new songs."
                metaFn={(s) => formatRelativeTime(s.created_at)}
              />
            </div>
          </section>

          {/* Playlists: same three-column list layout as Songs */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">Playlists</h2>
            <div className="flex gap-4">
              <PlaylistListColumn
                title="Most Listens"
                items={data.playlists?.popular}
                emptyMessage="No playlists in this period."
                metaFn={(p) => (
                  <span className="flex items-center gap-1" title="Listens">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {(p.total_listen_count ?? 0) > 0 ? p.total_listen_count : '—'}
                  </span>
                )}
              />
              <PlaylistListColumn
                title="Highest rated"
                items={data.playlists?.highestRated}
                emptyMessage="No rated playlists."
                metaFn={(p) =>
                  p.community_rating_count > 0 ? (
                    <span className="text-amber-400">
                      {Number(p.community_avg_rating).toFixed(1)} ★ ({p.community_rating_count})
                    </span>
                  ) : '—'
                }
              />
              <PlaylistListColumn
                title="New"
                items={data.playlists?.new}
                emptyMessage="No new playlists."
                metaFn={(p) => formatRelativeTime(p.created_at)}
              />
            </div>
          </section>

          {/* Stations: same three-column list layout as Songs, with proper thumbnails (image_url) */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">Stations</h2>
            <div className="flex gap-4">
              <StationListColumn
                title="Most Listens"
                items={data.stations?.popular}
                emptyMessage="No stations in this period."
                metaFn={(s) => (
                  <span className="flex items-center gap-1" title="Listens">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {(s.listener_count ?? 0) > 0 ? s.listener_count : '—'}
                  </span>
                )}
              />
              <StationListColumn
                title="Highest rated"
                items={data.stations?.highestRated}
                emptyMessage="No rated stations."
                metaFn={(s) =>
                  s.community_rating_count > 0 ? (
                    <span className="text-amber-400">
                      {Number(s.community_avg_rating).toFixed(1)} ★ ({s.community_rating_count})
                    </span>
                  ) : '—'
                }
              />
              <StationListColumn
                title="New"
                items={data.stations?.new}
                emptyMessage="No new stations."
                metaFn={(s) => formatRelativeTime(s.created_at)}
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
