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

function PlaylistCard({ playlist }) {
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
      className="group flex w-40 flex-shrink-0 flex-col rounded-xl border border-groove-700 bg-groove-900/80 p-3 transition hover:border-groove-600 hover:bg-groove-800"
    >
      <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg bg-groove-800">
        {playlist.thumbnail_url ? (
          <img src={playlist.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-ray-500">♫</div>
        )}
        <button
          type="button"
          onClick={handlePlay}
          disabled={(playlist.track_count ?? 0) === 0}
          className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-ray-600 text-white shadow-lg opacity-0 transition group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ray-400 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Play"
        >
          <span className="ml-0.5 text-lg">▶</span>
        </button>
      </div>
      <p className="truncate text-sm font-medium text-white" title={playlist.name}>{playlist.name}</p>
      <p className="truncate text-xs text-gray-400">{playlist.owner_name} · {(playlist.track_count ?? 0)} tracks</p>
    </Link>
  );
}

function StationCard({ station }) {
  const linkTo = `/stations/${station.slug || station.id}`;
  const rating = station.community_avg_rating != null ? Number(station.community_avg_rating).toFixed(1) : '—';
  return (
    <Link
      to={linkTo}
      className="flex w-40 flex-shrink-0 flex-col rounded-xl border border-groove-700 bg-groove-900/80 p-3 transition hover:border-groove-600 hover:bg-groove-800"
    >
      <div className="mb-2 flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-groove-800 text-4xl text-ray-500">
        📻
      </div>
      <p className="truncate text-sm font-medium text-white" title={station.name}>{station.name}</p>
      <p className="truncate text-xs text-gray-400">{station.owner_name} · ★ {rating}</p>
    </Link>
  );
}

function SectionRow({ title, items, emptyMessage, renderCard }) {
  if (!items?.length) return null;
  return (
    <div className="mb-8">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-groove-800 scrollbar-thumb-groove-600">
        {items.map((item) => (
          <div key={item.id}>{renderCard(item)}</div>
        ))}
      </div>
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
                title="Most popular"
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

          {/* Playlists */}
          <section className="rounded-xl border border-groove-700 bg-groove-900/40 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Playlists</h2>
            <SectionRow title="Most popular" items={data.playlists?.popular} renderCard={(p) => <PlaylistCard playlist={p} />} />
            <SectionRow title="Highest rated" items={data.playlists?.highestRated} renderCard={(p) => <PlaylistCard playlist={p} />} />
            <SectionRow title="New" items={data.playlists?.new} renderCard={(p) => <PlaylistCard playlist={p} />} />
            {!(data.playlists?.popular?.length || data.playlists?.highestRated?.length || data.playlists?.new?.length) && (
              <p className="py-4 text-center text-sm text-gray-500">No playlists in this period.</p>
            )}
          </section>

          {/* Stations */}
          <section className="rounded-xl border border-groove-700 bg-groove-900/40 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Stations</h2>
            <SectionRow title="Most popular" items={data.stations?.popular} renderCard={(s) => <StationCard station={s} />} />
            <SectionRow title="Highest rated" items={data.stations?.highestRated} renderCard={(s) => <StationCard station={s} />} />
            <SectionRow title="New" items={data.stations?.new} renderCard={(s) => <StationCard station={s} />} />
            {!(data.stations?.popular?.length || data.stations?.highestRated?.length || data.stations?.new?.length) && (
              <p className="py-4 text-center text-sm text-gray-500">No stations in this period.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
