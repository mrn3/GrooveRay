import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const ToastContext = createContext(null);

export const LOGIN_REQUIRED_MSG = 'Log in to add songs, playlists, stations, or vote on stations.';

export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setMessage(msg ?? LOGIN_REQUIRED_MSG);
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, []);

  const showLoginRequired = useCallback(() => {
    showToast(LOGIN_REQUIRED_MSG);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showLoginRequired }}>
      {children}
      {message && (
        <div
          className="fixed bottom-24 left-4 right-4 z-50 rounded-lg border border-groove-600 bg-groove-900 px-4 py-3 text-sm text-white shadow-xl md:left-auto md:right-4 md:max-w-sm"
          role="alert"
        >
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { showToast: () => {}, showLoginRequired: () => {} };
  return ctx;
}

/** Returns a function: call before an action; returns true if logged in, false otherwise (shows toast). */
export function useRequireLogin() {
  const { user } = useAuth();
  const { showLoginRequired } = useToast();
  return useCallback(() => {
    if (user) return true;
    showLoginRequired();
    return false;
  }, [user, showLoginRequired]);
}
