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

function SongCard({ song }) {
  const { play, current, playing } = usePlayer();
  const isActive = current?.id === song.id;
  const handlePlay = (e) => {
    e.preventDefault();
    e.stopPropagation();
    play({
      id: song.id,
      title: song.title,
      artist: song.artist,
      file_path: song.file_path,
      thumbnail_url: song.thumbnail_url,
      duration_seconds: song.duration_seconds,
    });
  };
  return (
    <Link
      to={`/songs/${song.id}`}
      className="group flex w-40 flex-shrink-0 flex-col rounded-xl border border-groove-700 bg-groove-900/80 p-3 transition hover:border-groove-600 hover:bg-groove-800"
    >
      <div className="relative mb-2 aspect-square w-full overflow-hidden rounded-lg bg-groove-800">
        {song.thumbnail_url ? (
          <img src={song.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-ray-500">♫</div>
        )}
        <button
          type="button"
          onClick={handlePlay}
          className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-ray-600 text-white shadow-lg opacity-0 transition group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ray-400"
          aria-label="Play"
        >
          <span className={isActive && playing ? 'text-lg' : 'ml-0.5 text-lg'}>{isActive && playing ? '‖' : '▶'}</span>
        </button>
      </div>
      <p className="truncate text-sm font-medium text-white" title={song.title}>{song.title}</p>
      <p className="truncate text-xs text-gray-400" title={song.artist}>{song.artist || '—'}</p>
    </Link>
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
          {/* Songs */}
          <section className="rounded-xl border border-groove-700 bg-groove-900/40 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Songs</h2>
            <SectionRow title="Most popular" items={data.songs?.popular} renderCard={(s) => <SongCard song={s} />} />
            <SectionRow title="Trending" items={data.songs?.trending} renderCard={(s) => <SongCard song={s} />} />
            <SectionRow title="Highest rated" items={data.songs?.highestRated} renderCard={(s) => <SongCard song={s} />} />
            <SectionRow title="New" items={data.songs?.new} renderCard={(s) => <SongCard song={s} />} />
            {!(data.songs?.popular?.length || data.songs?.trending?.length || data.songs?.highestRated?.length || data.songs?.new?.length) && (
              <p className="py-4 text-center text-sm text-gray-500">No songs in this period.</p>
            )}
          </section>

          {/* Playlists */}
          <section className="rounded-xl border border-groove-700 bg-groove-900/40 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Playlists</h2>
            <SectionRow title="Most popular" items={data.playlists?.popular} renderCard={(p) => <PlaylistCard playlist={p} />} />
            <SectionRow title="Trending" items={data.playlists?.trending} renderCard={(p) => <PlaylistCard playlist={p} />} />
            <SectionRow title="Highest rated" items={data.playlists?.highestRated} renderCard={(p) => <PlaylistCard playlist={p} />} />
            <SectionRow title="New" items={data.playlists?.new} renderCard={(p) => <PlaylistCard playlist={p} />} />
            {!(data.playlists?.popular?.length || data.playlists?.trending?.length || data.playlists?.highestRated?.length || data.playlists?.new?.length) && (
              <p className="py-4 text-center text-sm text-gray-500">No playlists in this period.</p>
            )}
          </section>

          {/* Stations */}
          <section className="rounded-xl border border-groove-700 bg-groove-900/40 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Stations</h2>
            <SectionRow title="Most popular" items={data.stations?.popular} renderCard={(s) => <StationCard station={s} />} />
            <SectionRow title="Trending" items={data.stations?.trending} renderCard={(s) => <StationCard station={s} />} />
            <SectionRow title="Highest rated" items={data.stations?.highestRated} renderCard={(s) => <StationCard station={s} />} />
            <SectionRow title="New" items={data.stations?.new} renderCard={(s) => <StationCard station={s} />} />
            {!(data.stations?.popular?.length || data.stations?.trending?.length || data.stations?.highestRated?.length || data.stations?.new?.length) && (
              <p className="py-4 text-center text-sm text-gray-500">No stations in this period.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
