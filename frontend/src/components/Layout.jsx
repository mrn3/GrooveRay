import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';

const nav = [
  { to: '/songs', label: 'Songs' },
  { to: '/stations', label: 'Stations' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-groove-700 bg-groove-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <NavLink to="/songs" className="flex items-center font-semibold text-ray-400">
            <Logo className="h-7 w-7" />
          </NavLink>
          <nav className="flex items-center gap-1">
            {nav.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-groove-700 text-ray-400' : 'text-gray-400 hover:bg-groove-800 hover:text-white'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm text-gray-400">{user.username}</span>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-lg bg-groove-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-groove-600"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white">Log in</NavLink>
                <NavLink to="/register" className="rounded-lg bg-ray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-ray-500">Sign up</NavLink>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </>
  );
}
