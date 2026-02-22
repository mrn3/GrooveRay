import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/schema.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';

const router = Router();
const SORT_KEYS = ['username', 'name', 'created_at'];
const MAX_LIST = 2000;

function parseListQuery(query) {
  const tab = ['all', 'connections'].includes(query.tab) ? query.tab : 'all';
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const sortBy = SORT_KEYS.includes(query.sortBy) ? query.sortBy : 'username';
  const sortOrder = query.sortOrder === 'asc' || query.sortOrder === 'desc' ? query.sortOrder : 'asc';
  const page = query.page != null ? Math.max(1, parseInt(query.page, 10)) : 1;
  const limitRaw = query.limit != null ? parseInt(query.limit, 10) : 20;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.max(1, limitRaw)) : 20;
  return { tab, search, sortBy, sortOrder, page, limit };
}

/** Public user row: no email, no youtube_cookies */
function toPublicUser(row) {
  if (!row) return null;
  const { email, password_hash, google_id, youtube_cookies, ...rest } = row;
  return rest;
}

/** List messages with another user (DMs) - must be before /:username */
router.get('/messages/with/:userId', authMiddleware, async (req, res) => {
  const otherId = req.params.userId;
  if (otherId === req.userId) return res.status(400).json({ error: 'Cannot message yourself' });

  const messages = await db.all(
    `SELECT m.id, m.sender_id, m.receiver_id, m.message, m.created_at, u.username as sender_username
     FROM direct_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
     ORDER BY m.created_at ASC
     LIMIT 500`,
    [req.userId, otherId, otherId, req.userId]
  );
  res.json({ items: messages });
});

/** Send a direct message */
router.post('/messages', authMiddleware, async (req, res) => {
  const { toUserId, message: rawMessage } = req.body || {};
  if (!toUserId || typeof rawMessage !== 'string') {
    return res.status(400).json({ error: 'toUserId and message required' });
  }
  const message = rawMessage.trim();
  if (!message || message.length > 5000) {
    return res.status(400).json({ error: 'Message must be 1–5000 characters' });
  }
  if (toUserId === req.userId) return res.status(400).json({ error: 'Cannot message yourself' });

  const receiver = await db.get('SELECT id FROM users WHERE id = ?', [toUserId]);
  if (!receiver) return res.status(404).json({ error: 'User not found' });

  const id = uuid();
  await db.run(
    'INSERT INTO direct_messages (id, sender_id, receiver_id, message) VALUES (?, ?, ?, ?)',
    [id, req.userId, toUserId, message]
  );
  const row = await db.get(
    `SELECT m.id, m.sender_id, m.receiver_id, m.message, m.created_at, u.username as sender_username
     FROM direct_messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`,
    [id]
  );
  res.status(201).json(row);
});

/** List groovers (users) with optional auth for "connections" tab */
router.get('/', optionalAuth, async (req, res) => {
  const opts = parseListQuery(req.query);
  const userId = req.userId || null;

  let sql = `
    SELECT id, username, name, location, avatar_url, created_at
    FROM users
  `;
  const params = [];

  if (opts.tab === 'connections') {
    if (!userId) {
      return res.json({ items: [], total: 0 });
    }
    sql += ` WHERE id IN (
      SELECT connected_user_id FROM user_connections WHERE user_id = ?
      UNION
      SELECT user_id FROM user_connections WHERE connected_user_id = ?
    )`;
    params.push(userId, userId);
  }

  if (opts.search) {
    const like = `%${opts.search.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    sql += params.length ? ' AND ' : ' WHERE ';
    sql += '(username LIKE ? OR name LIKE ?)';
    params.push(like, like);
  }

  const orderCol = opts.sortBy === 'name' ? 'COALESCE(NULLIF(TRIM(name),\'\'), username)' : opts.sortBy;
  sql += ` ORDER BY ${orderCol} ${opts.sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
  sql += ` LIMIT ?`;
  params.push(MAX_LIST);

  const list = await db.all(sql, params);

  if (userId && list.length > 0) {
    const ids = list.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const conn = await db.all(
      `SELECT connected_user_id FROM user_connections WHERE user_id = ? AND connected_user_id IN (${placeholders})
       UNION
       SELECT user_id FROM user_connections WHERE connected_user_id = ? AND user_id IN (${placeholders})`,
      [userId, ...ids, userId, ...ids]
    );
    const connectedSet = new Set(conn.map((r) => r.connected_user_id || r.user_id));
    list.forEach((u) => { u.is_connected = connectedSet.has(u.id); });
  } else {
    list.forEach((u) => { u.is_connected = false; });
  }

  const total = list.length;
  const start = (opts.page - 1) * opts.limit;
  const items = list.slice(start, start + opts.limit);

  res.json({ items, total });
});

/** Get public profile by username (handle) */
router.get('/:username', optionalAuth, async (req, res) => {
  const username = decodeURIComponent(req.params.username);
  const viewerId = req.userId || null;

  const user = await db.get(
    'SELECT id, username, name, location, avatar_url, created_at FROM users WHERE username = ?',
    [username]
  );
  if (!user) return res.status(404).json({ error: 'Groover not found' });

  const profile = toPublicUser(user);

  const [songCount, playlistCount, stationCount] = await Promise.all([
    db.get('SELECT COUNT(*) as c FROM songs WHERE user_id = ? AND is_public = 1', [user.id]).then((r) => r?.c ?? 0),
    db.get('SELECT COUNT(*) as c FROM playlists WHERE user_id = ? AND is_public = 1', [user.id]).then((r) => r?.c ?? 0),
    db.get('SELECT COUNT(*) as c FROM stations WHERE owner_id = ?', [user.id]).then((r) => r?.c ?? 0),
  ]);

  profile.song_count = songCount;
  profile.playlist_count = playlistCount;
  profile.station_count = stationCount;

  const artistRows = await db.all(
    'SELECT DISTINCT artist FROM songs WHERE user_id = ? AND is_public = 1 AND artist IS NOT NULL AND artist != \'\' ORDER BY artist LIMIT 100',
    [user.id]
  );
  profile.artist_count = artistRows.length;

  const [recentSongs, recentPlaylists, recentStations] = await Promise.all([
    db.all(
      'SELECT id, title, artist, thumbnail_url, duration_seconds FROM songs WHERE user_id = ? AND is_public = 1 ORDER BY created_at DESC LIMIT 12',
      [user.id]
    ),
    db.all(
      'SELECT id, name, slug, thumbnail_url, description FROM playlists WHERE user_id = ? AND is_public = 1 ORDER BY created_at DESC LIMIT 12',
      [user.id]
    ),
    db.all(
      'SELECT id, name, slug, description, image_url FROM stations WHERE owner_id = ? ORDER BY created_at DESC LIMIT 12',
      [user.id]
    ),
  ]);
  profile.recent_songs = recentSongs;
  profile.recent_playlists = recentPlaylists;
  profile.recent_stations = recentStations;

  if (viewerId && viewerId !== user.id) {
    const [connected] = await db.all(
      'SELECT 1 FROM user_connections WHERE (user_id = ? AND connected_user_id = ?) OR (user_id = ? AND connected_user_id = ?)',
      [viewerId, user.id, user.id, viewerId]
    );
    profile.is_connected = !!connected;

    const [commonSongs, commonArtists, commonPlaylists, commonStations] = await Promise.all([
      db.all(
        `SELECT s.id, s.title, s.artist FROM user_song_favorites a
         JOIN user_song_favorites b ON a.song_id = b.song_id
         JOIN songs s ON s.id = a.song_id
         WHERE a.user_id = ? AND b.user_id = ? AND s.is_public = 1
         ORDER BY s.title LIMIT 50`,
        [viewerId, user.id]
      ),
      db.all(
        `SELECT DISTINCT s.artist as name FROM user_song_favorites a
         JOIN user_song_favorites b ON a.song_id = b.song_id
         JOIN songs s ON s.id = a.song_id
         WHERE a.user_id = ? AND b.user_id = ? AND s.artist IS NOT NULL AND s.artist != ''
         ORDER BY s.artist LIMIT 50`,
        [viewerId, user.id]
      ),
      db.all(
        `SELECT p.id, p.name, p.slug FROM user_playlist_ratings a
         JOIN user_playlist_ratings b ON a.playlist_id = b.playlist_id
         JOIN playlists p ON p.id = a.playlist_id
         WHERE a.user_id = ? AND b.user_id = ? AND p.is_public = 1
         ORDER BY p.name LIMIT 50`,
        [viewerId, user.id]
      ),
      db.all(
        `SELECT s.id, s.name, s.slug FROM user_station_ratings a
         JOIN user_station_ratings b ON a.station_id = b.station_id
         JOIN stations s ON s.id = a.station_id
         WHERE a.user_id = ? AND b.user_id = ?
         ORDER BY s.name LIMIT 50`,
        [viewerId, user.id]
      ),
    ]);
    profile.common_songs = commonSongs;
    profile.common_artists = commonArtists;
    profile.common_playlists = commonPlaylists;
    profile.common_stations = commonStations;
  } else {
    profile.is_connected = false;
    profile.common_songs = [];
    profile.common_artists = [];
    profile.common_playlists = [];
    profile.common_stations = [];
  }

  res.json(profile);
});

/** Connect with a groover */
router.post('/:username/connect', authMiddleware, async (req, res) => {
  const username = decodeURIComponent(req.params.username);
  const target = await db.get('SELECT id FROM users WHERE username = ?', [username]);
  if (!target) return res.status(404).json({ error: 'Groover not found' });
  if (target.id === req.userId) return res.status(400).json({ error: 'Cannot connect with yourself' });

  const [existing] = await db.all(
    'SELECT 1 FROM user_connections WHERE (user_id = ? AND connected_user_id = ?) OR (user_id = ? AND connected_user_id = ?)',
    [req.userId, target.id, target.id, req.userId]
  );
  if (existing) return res.json({ connected: true });

  await db.run(
    'INSERT INTO user_connections (user_id, connected_user_id) VALUES (?, ?)',
    [req.userId, target.id]
  );
  res.status(201).json({ connected: true });
});

/** Disconnect */
router.delete('/:username/connect', authMiddleware, async (req, res) => {
  const username = decodeURIComponent(req.params.username);
  const target = await db.get('SELECT id FROM users WHERE username = ?', [username]);
  if (!target) return res.status(404).json({ error: 'Groover not found' });

  await db.run(
    'DELETE FROM user_connections WHERE (user_id = ? AND connected_user_id = ?) OR (user_id = ? AND connected_user_id = ?)',
    [req.userId, target.id, target.id, req.userId]
  );
  res.status(204).send();
});

export default router;
