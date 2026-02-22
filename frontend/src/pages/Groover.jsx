import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groovers as grooversApi } from '../api';
import { selfHostedImageUrl } from '../utils/images';

function Section({ title, children, emptyMessage, className = '' }) {
  return (
    <section className={`rounded-xl border border-groove-700 bg-groove-900/50 p-4 ${className}`.trim()}>
      <h2 className="mb-3 text-lg font-semibold text-white">{title}</h2>
      {children && (Array.isArray(children) ? children.length : 1) ? (
        children
      ) : (
        <p className="text-sm text-gray-500">{emptyMessage || 'None'}</p>
      )}
    </section>
  );
}

export default function Groover() {
  const { username: encodedUsername } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const username = encodedUsername ? decodeURIComponent(encodedUsername) : '';
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const isSelf = user && profile && user.id === profile.id;

  const fetchProfile = useCallback(() => {
    if (!username) return;
    setLoading(true);
    setError('');
    grooversApi
      .get(username)
      .then(setProfile)
      .catch((e) => {
        setError(e.message);
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleConnect = async () => {
    if (!user || !profile || isSelf) return;
    setConnecting(true);
    try {
      await grooversApi.connect(profile.username);
      setProfile((p) => (p ? { ...p, is_connected: true } : null));
    } catch (e) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user || !profile || isSelf) return;
    setConnecting(true);
    try {
      await grooversApi.disconnect(profile.username);
      setProfile((p) => (p ? { ...p, is_connected: false } : null));
    } catch (e) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  };

  const loadMessages = useCallback(() => {
    if (!user || !profile || profile.id === user.id) return;
    grooversApi.getMessages(profile.id).then((data) => setMessages(data?.items ?? []));
  }, [user, profile]);

  const openMessage = () => {
    setMessageOpen(true);
    loadMessages();
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !profile || sendingMessage) return;
    setSendingMessage(true);
    try {
      await grooversApi.sendMessage(profile.id, messageText.trim());
      setMessageText('');
      loadMessages();
    } catch (e) {
      setError(e.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const displayName = (p) => (p?.name?.trim() || p?.username || 'Groover');

  if (loading && !profile) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" />
      </div>
    );
  }
  if (error && !profile) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p className="text-red-400">{error}</p>
        <Link to="/groovers" className="mt-2 inline-block text-ray-400 hover:underline">← Back to Groovers</Link>
      </div>
    );
  }
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-groove-600 bg-groove-800">
            {selfHostedImageUrl(profile.avatar_url) ? (
              <img src={selfHostedImageUrl(profile.avatar_url)} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-medium text-ray-400">
                {displayName(profile).slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">@{profile.username}</h1>
            {(profile.name?.trim() || profile.location) && (
              <p className="text-gray-400">
                {profile.name?.trim()}
                {profile.location ? ` · ${profile.location}` : ''}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
              <span>{profile.song_count ?? 0} songs</span>
              <span>{profile.artist_count ?? 0} artists</span>
              <span>{profile.playlist_count ?? 0} playlists</span>
              <span>{profile.station_count ?? 0} stations</span>
            </div>
          </div>
        </div>
        {user && (
          <div className="flex flex-wrap items-center gap-2">
            {isSelf ? (
              <Link
                to="/profile"
                className="rounded-lg bg-groove-600 px-4 py-2 text-sm font-medium text-white hover:bg-groove-500"
              >
                Edit Profile
              </Link>
            ) : (
              <>
                {profile.is_connected ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={connecting}
                    className="rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-groove-700 disabled:opacity-50"
                  >
                    {connecting ? '…' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="rounded-lg bg-ray-600 px-4 py-2 text-sm font-medium text-white hover:bg-ray-500 disabled:opacity-50"
                  >
                    {connecting ? '…' : 'Connect'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={openMessage}
                  className="rounded-lg bg-groove-600 px-4 py-2 text-sm font-medium text-white hover:bg-groove-500"
                >
                  Message
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      {user && !isSelf && (profile.common_songs?.length > 0 || profile.common_artists?.length > 0 || profile.common_playlists?.length > 0 || profile.common_stations?.length > 0) && (
        <Section title="In common with you" className="mb-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {profile.common_songs?.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-400">Songs</h3>
                <ul className="space-y-1 text-sm">
                  {profile.common_songs.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      <Link to={`/songs/${s.id}`} className="text-ray-400 hover:underline">
                        {s.title}
                        {s.artist ? ` — ${s.artist}` : ''}
                      </Link>
                    </li>
                  ))}
                  {profile.common_songs.length > 5 && (
                    <li className="text-gray-500">+{profile.common_songs.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
            {profile.common_artists?.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-400">Artists</h3>
                <ul className="space-y-1 text-sm">
                  {profile.common_artists.slice(0, 5).map((a, i) => (
                    <li key={a.name || i}>
                      <Link to={`/artists/${encodeURIComponent(a.name)}`} className="text-ray-400 hover:underline">
                        {a.name}
                      </Link>
                    </li>
                  ))}
                  {profile.common_artists.length > 5 && (
                    <li className="text-gray-500">+{profile.common_artists.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
            {profile.common_playlists?.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-400">Playlists</h3>
                <ul className="space-y-1 text-sm">
                  {profile.common_playlists.slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <Link to={p.slug ? `/playlists/by/${p.slug}` : `/playlists/${p.id}`} className="text-ray-400 hover:underline">
                        {p.name}
                      </Link>
                    </li>
                  ))}
                  {profile.common_playlists.length > 5 && (
                    <li className="text-gray-500">+{profile.common_playlists.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
            {profile.common_stations?.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-400">Stations</h3>
                <ul className="space-y-1 text-sm">
                  {profile.common_stations.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      <Link to={`/stations/${s.slug}`} className="text-ray-400 hover:underline">
                        {s.name}
                      </Link>
                    </li>
                  ))}
                  {profile.common_stations.length > 5 && (
                    <li className="text-gray-500">+{profile.common_stations.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Songs" emptyMessage="No public songs yet">
          <ul className="space-y-2">
            {profile.recent_songs?.map((s) => (
              <li key={s.id}>
                <Link to={`/songs/${s.id}`} className="flex items-center gap-3 rounded-lg py-1.5 text-sm text-gray-300 hover:bg-groove-800 hover:text-white">
                  {selfHostedImageUrl(s.thumbnail_url) ? (
                    <img src={selfHostedImageUrl(s.thumbnail_url)} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded bg-groove-700 text-ray-500">♪</span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  {s.artist && <span className="truncate text-gray-500">{s.artist}</span>}
                </Link>
              </li>
            ))}
          </ul>
          {profile.song_count > (profile.recent_songs?.length || 0) && (
            <p className="mt-2 text-xs text-gray-500">
              {profile.song_count} total · view all from their Songs
            </p>
          )}
        </Section>

        <Section title="Playlists" emptyMessage="No public playlists yet">
          <ul className="space-y-2">
            {profile.recent_playlists?.map((p) => (
              <li key={p.id}>
                <Link to={p.slug ? `/playlists/by/${p.slug}` : `/playlists/${p.id}`} className="flex items-center gap-3 rounded-lg py-1.5 text-sm text-gray-300 hover:bg-groove-800 hover:text-white">
                  {selfHostedImageUrl(p.thumbnail_url) ? (
                    <img src={selfHostedImageUrl(p.thumbnail_url)} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded bg-groove-700 text-ray-500">♫</span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Stations" emptyMessage="No stations yet" className="mt-6">
        <ul className="grid gap-2 sm:grid-cols-2">
          {profile.recent_stations?.map((s) => (
            <li key={s.id}>
              <Link to={`/stations/${s.slug}`} className="flex items-center gap-3 rounded-lg border border-groove-700 p-3 text-sm text-gray-300 hover:border-groove-600 hover:bg-groove-800 hover:text-white">
                {selfHostedImageUrl(s.image_url) ? (
                  <img src={selfHostedImageUrl(s.image_url)} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-groove-700 text-ray-500">◇</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{s.name}</p>
                  {s.description && <p className="truncate text-xs text-gray-500">{s.description}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* Message modal */}
      {messageOpen && user && !isSelf && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setMessageOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Messages"
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border border-groove-700 bg-groove-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-groove-700 px-4 py-3">
              <h2 className="text-lg font-semibold text-white">Message @{profile.username}</h2>
              <button
                type="button"
                onClick={() => setMessageOpen(false)}
                className="rounded p-1.5 text-gray-400 hover:bg-groove-700 hover:text-white"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && <li className="text-center text-sm text-gray-500">No messages yet. Say hi!</li>}
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      m.sender_id === user.id
                        ? 'bg-ray-600 text-white'
                        : 'bg-groove-700 text-gray-200'
                    }`}
                  >
                    {m.sender_id !== user.id && (
                      <p className="mb-0.5 text-xs text-gray-400">@{m.sender_username}</p>
                    )}
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <p className="mt-1 text-xs opacity-80">
                      {new Date(m.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <form onSubmit={sendMessage} className="border-t border-groove-700 p-4">
              <div className="flex gap-2">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message…"
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-groove-600 bg-groove-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                  maxLength={5000}
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || sendingMessage}
                  className="flex-shrink-0 rounded-lg bg-ray-600 px-4 py-2 text-sm font-medium text-white hover:bg-ray-500 disabled:opacity-50"
                >
                  {sendingMessage ? '…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <p className="mt-6">
        <Link to="/groovers" className="text-ray-400 hover:underline">← Back to Groovers</Link>
      </p>
    </div>
  );
}
