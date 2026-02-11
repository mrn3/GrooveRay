import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
      navigate('/library');
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
        </form>
        <p className="mt-6 text-center text-sm text-gray-400">
          No account? <Link to="/register" className="text-ray-400 hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
