import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth as authApi } from '../api';
import Logo from '../components/Logo';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/songs');
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="rounded-2xl border border-groove-700 bg-groove-900/80 p-8 shadow-xl">
        <div className="mb-8 flex justify-center text-ray-400">
          <Logo className="h-10 w-10" showWordmark wordmarkClassName="text-xl" />
        </div>
        <h1 className="mb-6 text-center text-xl font-semibold text-white">Log in</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-400">{error}</p>}
          <input
            type="text"
            placeholder="Username or email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-3 text-white placeholder-gray-500 focus:border-ray-500"
            autoComplete="username"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-3 text-white placeholder-gray-500 focus:border-ray-500"
            autoComplete="current-password"
            required
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-ray-600 py-3 font-medium text-white transition hover:bg-ray-500"
          >
            Log in
          </button>
          {typeof authApi.googleAuthUrl === 'function' && (
            <>
              <p className="text-center text-sm text-gray-500">or</p>
              <a
                href={authApi.googleAuthUrl('songs')}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-groove-600 bg-groove-800 py-3 font-medium text-white transition hover:bg-groove-700"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </a>
            </>
          )}
        </form>
        <p className="mt-6 text-center text-sm text-gray-400">
          No account? <Link to="/register" className="text-ray-400 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
