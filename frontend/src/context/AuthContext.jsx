import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth as authApi } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('grooveray_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('grooveray_token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const { user: u, token } = await authApi.login(username, password);
    localStorage.setItem('grooveray_token', token);
    setUser(u);
    return u;
  };

  const register = async (username, email, password) => {
    const { user: u, token } = await authApi.register(username, email, password);
    localStorage.setItem('grooveray_token', token);
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('grooveray_token');
    setUser(null);
  };

  const refreshUser = () => {
    const token = localStorage.getItem('grooveray_token');
    if (!token) return Promise.resolve(null);
    return authApi.me().then((u) => {
      setUser(u);
      return u;
    }).catch(() => null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
