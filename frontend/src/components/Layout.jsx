import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { selfHostedImageUrl } from '../utils/images';
import Logo from './Logo';

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/songs', label: 'Songs' },
  { to: '/playlists', label: 'Playlists' },
  { to: '/stations', label: 'Stations' },
];

function AvatarMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    if (open) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [open]);

  const displayName = user?.name || user?.username || 'User';
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-groove-600 bg-groove-800 ring-2 ring-transparent transition hover:border-ray-500 focus:outline-none focus:ring-2 focus:ring-ray-500"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {selfHostedImageUrl(user?.avatar_url) ? (
          <img src={selfHostedImageUrl(user.avatar_url)} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-medium text-ray-400">{initials}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-groove-600 bg-groove-900 py-1 shadow-xl">
          <NavLink
            to="/profile"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-300 hover:bg-groove-800 hover:text-white"
          >
            Edit Profile
          </NavLink>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="block w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-groove-800 hover:text-white"
          >
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-groove-700 bg-groove-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* Hamburger: visible only on mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-groove-800 hover:text-white md:hidden"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <NavLink to="/" className="flex items-center font-semibold text-ray-400">
              <Logo className="h-7 w-7" />
            </NavLink>
          </div>

          {/* Desktop nav: hidden on mobile */}
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
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
              <AvatarMenu user={user} logout={logout} />
            ) : (
              <>
                <NavLink to="/login" className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white">Log in</NavLink>
                <NavLink to="/register" className="rounded-lg bg-ray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-ray-500">Sign up</NavLink>
              </>
            )}
          </div>
        </div>

        {/* Mobile nav panel */}
        {mobileMenuOpen && (
          <div className="border-t border-groove-700 bg-groove-900/95 md:hidden">
            <nav className="flex flex-col px-4 py-3">
              {nav.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-3 text-sm font-medium transition ${isActive ? 'bg-groove-700 text-ray-400' : 'text-gray-400 hover:bg-groove-800 hover:text-white'}`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </>
  );
}
