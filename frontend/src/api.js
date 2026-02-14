const API = '/api';

function getToken() {
  return localStorage.getItem('grooveray_token');
}

export async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  // 204 No Content has no body; don't try to parse JSON
  const data =
    res.status === 204
      ? null
      : res.headers.get('content-type')?.includes('application/json')
        ? await res.json().catch(() => ({}))
        : null;
  if (!res.ok) throw new Error(data?.error || res.statusText || 'Request failed');
  return data;
}

export function streamUrl(songId) {
  const path = `${API}/songs/${songId}/stream${getToken() ? `?token=${getToken()}` : ''}`;
  return typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
}

// Auth
const apiBase = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL ? import.meta.env.VITE_API_URL : '';
export const auth = {
  register: (username, email, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/auth/me'),
  updateProfile: (payload) =>
    request('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) }),
  /** Full URL to start Google OAuth (redirects away). Pass next path e.g. "/songs". */
  googleAuthUrl: (next = 'songs') => `${apiBase}/api/auth/google?next=${encodeURIComponent(next.startsWith('/') ? next : `/${next}`)}`,
};

function buildSearchParams(params) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v != null && v !== '') sp.set(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

// Songs
export const songs = {
  list: (params) => request(`/songs${buildSearchParams(params)}`),
  listFavorites: (params) => request(`/songs/favorites${buildSearchParams(params)}`),
  listPublic: (params) => request(`/songs/public${buildSearchParams(params)}`),
  titles: (q) => request(`/songs/titles${q != null && q !== '' ? `?q=${encodeURIComponent(q)}` : ''}`),
  artists: (q) => request(`/songs/artists${q != null && q !== '' ? `?q=${encodeURIComponent(q)}` : ''}`),
  get: (id) => request(`/songs/${id}`),
  ratings: (id, params) => request(`/songs/${id}/ratings${buildSearchParams(params)}`),
  listens: (id) => request(`/songs/${id}/listens`),
  listensHistory: (id, params) => request(`/songs/${id}/listens/history${buildSearchParams(params)}`),
  setPublic: (id, isPublic) =>
    request(`/songs/${id}`, { method: 'PATCH', body: JSON.stringify({ is_public: isPublic }) }),
  update: (id, payload) =>
    request(`/songs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  delete: (id) => request(`/songs/${id}`, { method: 'DELETE' }),
  recordPlay: (id) => request(`/songs/${id}/played`, { method: 'POST' }),
  setRating: (id, rating) =>
    request(`/songs/${id}/rating`, { method: 'PATCH', body: JSON.stringify({ rating }) }),
  upload: (file, title, artist, extra = {}) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    if (artist) form.append('artist', artist);
    if (extra.description != null) form.append('description', String(extra.description));
    if (extra.lyrics != null) form.append('lyrics', String(extra.lyrics));
    if (extra.guitar_tab != null) form.append('guitar_tab', String(extra.guitar_tab));
    return fetch(`${API}/songs/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    }).then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(new Error(d.error || 'Upload failed')))));
  },
  /** Upload with progress callback: onProgress(percent 0-100). extra: { description, lyrics, guitar_tab }. */
  uploadWithProgress: (file, title, artist, onProgress, extra = {}) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    if (artist) form.append('artist', artist);
    if (extra.description != null) form.append('description', String(extra.description));
    if (extra.lyrics != null) form.append('lyrics', String(extra.lyrics));
    if (extra.guitar_tab != null) form.append('guitar_tab', String(extra.guitar_tab));
    const token = getToken();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && typeof onProgress === 'function') {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Upload failed'));
          }
        } else {
          try {
            const d = JSON.parse(xhr.responseText);
            reject(new Error(d?.error || 'Upload failed'));
          } catch {
            reject(new Error(xhr.statusText || 'Upload failed'));
          }
        }
      });
      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
      xhr.open('POST', `${API}/songs/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(form);
    });
  },
};

// YouTube
export const youtube = {
  add: (url) => request('/youtube/add', { method: 'POST', body: JSON.stringify({ url }) }),
  jobs: () => request('/youtube/jobs'),
};

// Stations
export const stations = {
  list: (params) => request(`/stations${buildSearchParams(params)}`),
  get: (slugOrId) => request(`/stations/${slugOrId}`),
  create: (name, description) =>
    request('/stations', { method: 'POST', body: JSON.stringify({ name, description }) }),
  update: (id, payload) =>
    request(`/stations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  setRating: (id, rating) =>
    request(`/stations/${id}/rating`, { method: 'PATCH', body: JSON.stringify({ rating }) }),
  queue: (id) => request(`/stations/${id}/queue`),
  addToQueue: (stationId, songId) =>
    request(`/stations/${stationId}/queue`, { method: 'POST', body: JSON.stringify({ songId }) }),
  vote: (stationId, queueId) =>
    request(`/stations/${stationId}/vote/${queueId}`, { method: 'POST' }),
  unvote: (stationId, queueId) =>
    request(`/stations/${stationId}/vote/${queueId}`, { method: 'DELETE' }),
  nowPlaying: (id) => request(`/stations/${id}/now-playing`),
};

// Playlists
export const playlists = {
  list: (params) => request(`/playlists${buildSearchParams(params)}`),
  listPublic: (params) => request(`/playlists/public${buildSearchParams(params)}`),
  get: (id) => request(`/playlists/${id}`),
  getBySlug: (slug) => request(`/playlists/by-slug/${slug}`),
  create: (name, description, isPublic) =>
    request('/playlists', {
      method: 'POST',
      body: JSON.stringify({ name, description: description || '', is_public: !!isPublic }),
    }),
  update: (id, payload) =>
    request(`/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  share: (id) => request(`/playlists/${id}/share`, { method: 'POST' }),
  delete: (id) => request(`/playlists/${id}`, { method: 'DELETE' }),
  tracks: (id) => request(`/playlists/${id}/tracks`),
  addTrack: (playlistId, songId) =>
    request(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ songId }),
    }),
  removeTrack: (playlistId, songId) =>
    request(`/playlists/${playlistId}/tracks/${songId}`, { method: 'DELETE' }),
  reorderTracks: (playlistId, songIds) =>
    request(`/playlists/${playlistId}/tracks/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ songIds }),
    }),
  setRating: (id, rating) =>
    request(`/playlists/${id}/rating`, { method: 'PATCH', body: JSON.stringify({ rating }) }),
  ratings: (id, params) => request(`/playlists/${id}/ratings${buildSearchParams(params)}`),
  recordPlay: (id) => request(`/playlists/${id}/played`, { method: 'POST' }),
  listens: (id) => request(`/playlists/${id}/listens`),
  listensHistory: (id, params) => request(`/playlists/${id}/listens/history${buildSearchParams(params)}`),
};
