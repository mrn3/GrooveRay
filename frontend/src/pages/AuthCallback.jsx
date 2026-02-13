import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

/** Handles OAuth callback: ?token=...&next=... or ?error=... */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      setMessage(decodeURIComponent(error));
      setTimeout(() => navigate('/login', { replace: true }), 2500);
      return;
    }
    const token = searchParams.get('token');
    const next = searchParams.get('next') || '/songs';
    if (!token) {
      setMessage('Missing token');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
      return;
    }
    localStorage.setItem('grooveray_token', token);
    setMessage('Success! Redirecting…');
    refreshUser().then(() => {
      navigate(next.startsWith('/') ? next : `/${next}`, { replace: true });
    });
  }, [searchParams, navigate, refreshUser]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Logo className="mb-6 h-10 w-10 text-ray-400" showWordmark wordmarkClassName="text-xl" />
      <p className="text-center text-white">{message}</p>
    </div>
  );
}
