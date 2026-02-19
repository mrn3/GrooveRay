import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth as authApi } from '../api';

const COOKIES_EXTENSION_URL = 'https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editCookiesOpen, setEditCookiesOpen] = useState(false);
  const [modalCookies, setModalCookies] = useState('');
  const [savingCookies, setSavingCookies] = useState(false);
  const [cookiesInfoOpen, setCookiesInfoOpen] = useState(false);
  const [clearingCookies, setClearingCookies] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setName(user.name || '');
      setLocation(user.location || '');
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
      const updated = await authApi.updateProfile(payload);
      await refreshUser();
      setMessage('Profile saved.');
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCookies = async () => {
    setSavingCookies(true);
    try {
      await authApi.updateProfile({ youtube_cookies: modalCookies.trim() || undefined });
      await refreshUser();
      setModalCookies('');
      setEditCookiesOpen(false);
      setMessage('Cookies saved.');
    } catch (err) {
      setError(err.message || 'Failed to save cookies');
    } finally {
      setSavingCookies(false);
    }
  };

  const handleClearCookies = async () => {
    setClearingCookies(true);
    try {
      await authApi.updateProfile({ youtube_cookies: null });
      await refreshUser();
      setModalCookies('');
      setEditCookiesOpen(false);
      setMessage('Cookies cleared.');
    } catch (err) {
      setError(err.message || 'Failed to clear cookies');
    } finally {
      setClearingCookies(false);
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
          <div className="mb-1 flex items-center gap-1.5">
            <label className="block text-sm text-gray-400">YouTube cookies</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setCookiesInfoOpen((o) => !o)}
                onBlur={() => setTimeout(() => setCookiesInfoOpen(false), 150)}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-500 text-gray-400 hover:border-ray-500 hover:text-ray-400 focus:outline-none focus:ring-1 focus:ring-ray-500"
                aria-label="How to get YouTube cookies"
              >
                <span className="text-xs font-medium">?</span>
              </button>
              {cookiesInfoOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-groove-600 bg-groove-800 p-3 text-sm text-gray-400 shadow-xl">
                  <p className="mb-2">To add songs from YouTube, we need cookies from your browser (while logged into YouTube).</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      Install the Chrome extension{' '}
                      <a href={COOKIES_EXTENSION_URL} target="_blank" rel="noopener noreferrer" className="text-ray-400 underline hover:text-ray-300">Get cookies.txt LOCALLY</a>.
                    </li>
                    <li>Go to <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" className="text-ray-400 underline hover:text-ray-300">youtube.com</a> and make sure you're signed in.</li>
                    <li>
                      Use the extension to export cookies in Netscape format and click the Copy button.
                      <img src="/cookies-extension-screenshot.png" alt="Get cookies.txt extension with Netscape format and Copy button" className="mt-2 block max-w-full rounded border border-groove-600" />
                    </li>
                    <li>Click &quot;Edit Cookies&quot; and paste the entire contents into the modal, then save.</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
          <p className="mb-2 text-xs text-gray-500">
            {user.has_youtube_cookies ? 'Cookies are set.' : 'Required for “Add from YouTube”. '}
          </p>
          {user.has_youtube_cookies && user.youtube_cookies && (
            <pre className="mb-2 max-h-48 overflow-auto rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 font-mono text-xs text-gray-300 whitespace-pre-wrap break-all">
              {user.youtube_cookies}
            </pre>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditCookiesOpen(true)}
              className="rounded-lg border border-groove-600 bg-groove-800 px-4 py-2 text-sm font-medium text-white hover:bg-groove-700 focus:outline-none focus:ring-1 focus:ring-ray-500"
            >
              {user.has_youtube_cookies ? 'Edit Cookies' : 'Set YouTube cookies'}
            </button>
            {user.has_youtube_cookies && (
              <button
                type="button"
                onClick={handleClearCookies}
                disabled={clearingCookies}
                className="rounded-lg border border-groove-600 px-4 py-2 text-sm text-gray-300 hover:bg-groove-700 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-ray-500"
              >
                {clearingCookies ? 'Clearing…' : 'Clear Cookies'}
              </button>
            )}
          </div>
        </div>

        {editCookiesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !savingCookies && setEditCookiesOpen(false)}>
            <div className="w-full max-w-lg rounded-xl border border-groove-600 bg-groove-800 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-2 text-lg font-medium text-white">YouTube cookies</h2>
              <p className="mb-3 text-xs text-gray-500">
                Paste your cookies.txt export here (Netscape format). Leave blank to clear existing cookies.
              </p>
              <textarea
                value={modalCookies}
                onChange={(e) => setModalCookies(e.target.value)}
                placeholder="Paste your cookies.txt export here (Netscape format)"
                rows={8}
                className="mb-4 w-full rounded-lg border border-groove-600 bg-groove-700 px-4 py-2 font-mono text-sm text-white placeholder-gray-500 focus:border-ray-500 focus:outline-none focus:ring-1 focus:ring-ray-500"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setEditCookiesOpen(false); setModalCookies(''); }}
                  disabled={savingCookies}
                  className="rounded-lg border border-groove-600 px-4 py-2 text-sm text-gray-300 hover:bg-groove-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCookies}
                  disabled={savingCookies}
                  className="rounded-lg bg-ray-600 px-4 py-2 text-sm font-medium text-white hover:bg-ray-500 disabled:opacity-50"
                >
                  {savingCookies ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

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
