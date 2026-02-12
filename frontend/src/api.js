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
  const data = res.headers.get('content-type')?.includes('application/json')
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
export const auth = {
  register: (username, email, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request('/auth/me'),
};

// Songs
export const songs = {
  list: () => request('/songs'),
  listPublic: () => request('/songs/public'),
  get: (id) => request(`/songs/${id}`),
  setPublic: (id, isPublic) =>
    request(`/songs/${id}`, { method: 'PATCH', body: JSON.stringify({ is_public: isPublic }) }),
  delete: (id) => request(`/songs/${id}`, { method: 'DELETE' }),
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
