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
  /** Full URL to start Google OAuth (redirects away). Pass next path e.g. "/songs". */
  googleAuthUrl: (next = 'songs') => `${apiBase}/api/auth/google?next=${encodeURIComponent(next.startsWith('/') ? next : `/${next}`)}`,
};

// Songs
export const songs = {
  list: () => request('/songs'),
  listFavorites: () => request('/songs/favorites'),
  listPublic: () => request('/songs/public'),
  get: (id) => request(`/songs/${id}`),
  setPublic: (id, isPublic) =>
    request(`/songs/${id}`, { method: 'PATCH', body: JSON.stringify({ is_public: isPublic }) }),
  update: (id, payload) =>
    request(`/songs/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  delete: (id) => request(`/songs/${id}`, { method: 'DELETE' }),
  recordPlay: (id) => request(`/songs/${id}/played`, { method: 'POST' }),
  setRating: (id, rating) =>
    request(`/songs/${id}/rating`, { method: 'PATCH', body: JSON.stringify({ rating }) }),
  upload: (file, title, artist) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    if (artist) form.append('artist', artist);
    return fetch(`${API}/songs/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: form,
    }).then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(new Error(d.error || 'Upload failed')))));
  },
  /** Upload with progress callback: onProgress(percent 0-100) */
  uploadWithProgress: (file, title, artist, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    if (artist) form.append('artist', artist);
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
  list: () => request('/stations'),
  get: (slugOrId) => request(`/stations/${slugOrId}`),
  create: (name, description) =>
    request('/stations', { method: 'POST', body: JSON.stringify({ name, description }) }),
  queue: (id) => request(`/stations/${id}/queue`),
  addToQueue: (stationId, songId) =>
    request(`/stations/${stationId}/queue`, { method: 'POST', body: JSON.stringify({ songId }) }),
  vote: (stationId, queueId) =>
    request(`/stations/${stationId}/vote/${queueId}`, { method: 'POST' }),
  unvote: (stationId, queueId) =>
    request(`/stations/${stationId}/vote/${queueId}`, { method: 'DELETE' }),
  nowPlaying: (id) => request(`/stations/${id}/now-playing`),
};
