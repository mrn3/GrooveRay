import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import PlayerBar from './components/PlayerBar';
import Login from './pages/Login';
import Register from './pages/Register';
import AuthCallback from './pages/AuthCallback';
import Songs from './pages/Songs';
import Upload from './pages/Upload';
import YouTube from './pages/YouTube';
import Stations from './pages/Stations';
import Station from './pages/Station';
import Playlists from './pages/Playlists';
import Playlist from './pages/Playlist';
import Profile from './pages/Profile';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-ray-500 border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col pb-24">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/songs" replace />} />
          <Route path="songs" element={<ProtectedRoute><Songs /></ProtectedRoute>} />
          <Route path="upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
          <Route path="youtube" element={<ProtectedRoute><YouTube /></ProtectedRoute>} />
          <Route path="playlists" element={<ProtectedRoute><Playlists /></ProtectedRoute>} />
          <Route path="playlists/by/:slug" element={<Playlist />} />
          <Route path="playlists/:id" element={<ProtectedRoute><Playlist /></ProtectedRoute>} />
          <Route path="stations" element={<Stations />} />
          <Route path="stations/:slugOrId" element={<ProtectedRoute><Station /></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PlayerBar />
    </div>
  );
}
