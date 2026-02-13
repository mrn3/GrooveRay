import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth as authApi } from '../api';

const COOKIES_INSTRUCTIONS = `To add songs from YouTube, we need cookies from your browser (while logged into YouTube).

1. Install a "cookies.txt" extension in Chrome, e.g. "Get cookies.txt LOCALLY".
2. Go to youtube.com and make sure you're signed in.
3. Use the extension to export cookies in Netscape format and copy the text.
4. Paste the entire contents into the "YouTube cookies" field below and save.`;

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [youtubeCookies, setYoutubeCookies] = useState('');
  const [cookiesDirty, setCookiesDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setName(user.name || '');
      setLocation(user.location || '');
      setYoutubeCookies('');
      setCookiesDirty(false);
    }
  }, [user?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const payload = {
        username: username.trim(),
        name: name.trim() || undefined,
        location: location.trim() || undefined,
      };
      if (cookiesDirty) payload.youtube_cookies = youtubeCookies;
      const updated = await authApi.updateProfile(payload);
      await refreshUser();
      setMessage(updated.has_youtube_cookies && cookiesDirty ? 'Profile and cookies saved.' : 'Profile saved.');
      setYoutubeCookies('');
      setCookiesDirty(false);
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-white">Profile</h1>
      <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-6">
        {message && (
          <p className="rounded-lg bg-green-500/20 px-3 py-2 text-sm text-green-400">{message}</p>
        )}
        {error && (
          <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-400">{error}</p>
        )}

        <div>
          <label className="mb-1 block text-sm text-gray-400">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">Display name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, country"
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">Google account</label>
          <div className="rounded-lg border border-groove-600 bg-groove-800 px-4 py-3 text-gray-300">
            {user.has_google_account ? (
              <span>Linked to Google</span>
            ) : (
              <span className="text-gray-500">Not linked. Use “Sign in with Google” on the login page to link.</span>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-400">YouTube cookies</label>
          <p className="mb-2 text-xs text-gray-500">
            {user.has_youtube_cookies ? 'Cookies are set. Paste new text below to replace.' : 'Required for “Add from YouTube”. Paste Netscape-format cookies here.'}
          </p>
          <textarea
            value={youtubeCookies}
            onChange={(e) => { setYoutubeCookies(e.target.value); setCookiesDirty(true); }}
            placeholder={user.has_youtube_cookies ? 'Leave blank to keep current cookies, or paste new export to replace' : 'Paste your cookies.txt export here (Netscape format)'}
            rows={6}
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 font-mono text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
          />
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-ray-400 hover:text-ray-300">How to get YouTube cookies</summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-groove-800 p-3 text-xs text-gray-400">
              {COOKIES_INSTRUCTIONS}
            </pre>
          </details>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-ray-600 py-3 font-medium text-white transition hover:bg-ray-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
