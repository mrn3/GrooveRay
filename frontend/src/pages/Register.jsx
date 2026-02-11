import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(username, email, password);
      navigate('/library');
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="rounded-2xl border border-groove-700 bg-groove-900/80 p-8 shadow-xl">
        <div className="mb-8 flex justify-center text-ray-400">
          <Logo className="h-10 w-10" showWordmark wordmarkClassName="text-xl" />
        </div>
        <h1 className="mb-6 text-center text-xl font-semibold text-white">Create account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-400">{error}</p>}
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-3 text-white placeholder-gray-500 focus:border-ray-500"
            autoComplete="username"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-3 text-white placeholder-gray-500 focus:border-ray-500"
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-groove-600 bg-groove-800 px-4 py-3 text-white placeholder-gray-500 focus:border-ray-500"
            autoComplete="new-password"
            required
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-ray-600 py-3 font-medium text-white transition hover:bg-ray-500"
          >
            Sign up
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account? <Link to="/login" className="text-ray-400 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
