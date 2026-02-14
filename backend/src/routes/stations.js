import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/schema.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { emitStationUpdate, getStationListenerCounts, getStationListenerCount } from '../socket.js';

const router = Router();

const MAX_LIST = 1000;
const SORT_KEYS = ['name', 'created_at', 'community_avg_rating', 'listener_count'];

function parseListQuery(query) {
  const tab = ['all', 'mine', 'contributions'].includes(query.tab) ? query.tab : 'all';
  const title = typeof query.title === 'string' ? query.title.trim() : '';
  const owner = typeof query.owner === 'string' ? query.owner.trim() : '';
  const sortBy = SORT_KEYS.includes(query.sortBy) ? query.sortBy : 'created_at';
  const sortOrder = query.sortOrder === 'asc' || query.sortOrder === 'desc' ? query.sortOrder : 'desc';
  const page = query.page != null ? Math.max(1, parseInt(query.page, 10)) : 1;
  const limitRaw = query.limit != null ? parseInt(query.limit, 10) : 20;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.max(1, limitRaw)) : 20;
  const minRatingCommunity = query.minRatingCommunity != null ? parseFloat(query.minRatingCommunity) : null;
  const minRatingMe = query.minRatingMe != null ? parseInt(query.minRatingMe, 10) : null;
  return {
    tab,
    title: title || null,
    owner: owner || null,
    sortBy,
    sortOrder,
    page: Number.isFinite(page) ? page : 1,
    limit,
    minRatingCommunity: Number.isFinite(minRatingCommunity) && minRatingCommunity >= 0 && minRatingCommunity <= 5 ? minRatingCommunity : null,
    minRatingMe: Number.isFinite(minRatingMe) && minRatingMe >= 1 && minRatingMe <= 5 ? minRatingMe : null,
  };
}

function slugify(s) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function getQueue(stationId) {
  return db.all(
    `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds, s.thumbnail_url
     FROM station_queue q
     JOIN songs s ON s.id = q.song_id
     WHERE q.station_id = ? AND q.played_at IS NULL
     ORDER BY q.votes DESC, q.added_at ASC`,
    [stationId]
  );
}

/** Advance station playback: ensure now_playing is set from queue head, or advance if current song ended. Returns { nowPlaying, queue }. */
export async function advanceStationPlayback(stationId) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const np = await db.get('SELECT queue_id, started_at FROM station_now_playing WHERE station_id = ?', [stationId]);

  if (np) {
    const row = await db.get(
      `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds, s.thumbnail_url
       FROM station_queue q JOIN songs s ON s.id = q.song_id WHERE q.id = ?`,
      [np.queue_id]
    );
    const duration = (row?.duration_seconds ?? 0) || 60;
    const endAt = new Date(new Date(np.started_at).getTime() + duration * 1000);
    if (endAt <= new Date()) {
      await db.run('UPDATE station_queue SET played_at = NOW() WHERE id = ? AND station_id = ?', [np.queue_id, stationId]);
      await db.run('DELETE FROM station_now_playing WHERE station_id = ?', [stationId]);
      const queue = await getQueue(stationId);
      const next = queue[0];
      if (next) {
        await db.run('INSERT INTO station_now_playing (station_id, queue_id, started_at) VALUES (?, ?, ?)', [
          stationId,
          next.id,
          now,
        ]);
        emitStationUpdate(stationId, 'queue', queue);
        const payload = { queueId: next.id, startedAt: now, item: next };
        emitStationUpdate(stationId, 'nowPlaying', payload);
        return { nowPlaying: payload, queue };
      }
      emitStationUpdate(stationId, 'queue', queue);
      emitStationUpdate(stationId, 'nowPlaying', null);
      return { nowPlaying: null, queue };
    }
    const queue = await getQueue(stationId);
    const current = await db.get(
      `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds, s.thumbnail_url
       FROM station_queue q JOIN songs s ON s.id = q.song_id WHERE q.id = ?`,
      [np.queue_id]
    );
    return { nowPlaying: { queueId: np.queue_id, startedAt: np.started_at, item: current }, queue };
  }

  const queue = await getQueue(stationId);
  const first = queue[0];
  if (first) {
    await db.run('INSERT INTO station_now_playing (station_id, queue_id, started_at) VALUES (?, ?, ?)', [
      stationId,
      first.id,
      now,
    ]);
    const payload = { queueId: first.id, startedAt: now, item: first };
    emitStationUpdate(stationId, 'nowPlaying', payload);
    return { nowPlaying: payload, queue };
  }
  return { nowPlaying: null, queue };
}

router.post('/', authMiddleware, async (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Station name required' });
  const id = uuid();
  let slug = slugify(name);
  const existing = await db.get('SELECT id FROM stations WHERE slug = ?', [slug]);
  if (existing) slug = `${slug}-${id.slice(0, 8)}`;
  await db.run(
    'INSERT INTO stations (id, owner_id, name, slug, description) VALUES (?, ?, ?, ?, ?)',
    [id, req.userId, name.trim(), slug, description?.trim() || '']
  );
  const station = await db.get('SELECT * FROM stations WHERE id = ?', [id]);
  res.status(201).json(station);
});

router.get('/', optionalAuth, async (req, res) => {
  const opts = parseListQuery(req.query);
  const userId = req.userId || null;

  const conditions = [];
  const params = [];
  if (opts.tab === 'mine') {
    if (!userId) {
      return res.json({ items: [], total: 0 });
    }
    conditions.push('s.owner_id = ?');
    params.push(userId);
  } else if (opts.tab === 'contributions') {
    if (!userId) {
      return res.json({ items: [], total: 0 });
    }
    conditions.push('s.id IN (SELECT DISTINCT station_id FROM station_votes WHERE user_id = ?)');
    params.push(userId);
  }
  if (opts.title) {
    conditions.push('s.name LIKE ?');
    params.push(`%${opts.title.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`);
  }
  if (opts.owner) {
    conditions.push('u.username LIKE ?');
    params.push(`%${opts.owner.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const list = await db.all(
    `SELECT s.*, u.username as owner_name,
       (SELECT COALESCE(AVG(rating), 0) FROM user_station_ratings WHERE station_id = s.id) as community_avg_rating,
       (SELECT COUNT(*) FROM user_station_ratings WHERE station_id = s.id) as community_rating_count
     FROM stations s
     JOIN users u ON u.id = s.owner_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [...params, MAX_LIST]
  );

  const listenerCounts = getStationListenerCounts();
  let withListeners = list.map((row) => ({
    ...row,
    community_avg_rating: row.community_avg_rating != null ? Number(row.community_avg_rating) : null,
    community_rating_count: Number(row.community_rating_count ?? 0),
    listener_count: listenerCounts[row.id] ?? 0,
  }));

  if (userId && withListeners.length > 0) {
    const ids = withListeners.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const ratings = await db.all(
      `SELECT station_id, rating FROM user_station_ratings WHERE user_id = ? AND station_id IN (${placeholders})`,
      [userId, ...ids]
    );
    const ratingMap = Object.fromEntries(ratings.map((r) => [r.station_id, r.rating]));
    withListeners = withListeners.map((r) => ({ ...r, rating: ratingMap[r.id] ?? null }));
  } else {
    withListeners = withListeners.map((r) => ({ ...r, rating: null }));
  }

  if (opts.minRatingCommunity != null) {
    withListeners = withListeners.filter((r) => (r.community_avg_rating ?? 0) >= opts.minRatingCommunity);
  }
  if (opts.minRatingMe != null && userId) {
    withListeners = withListeners.filter((r) => (r.rating ?? 0) >= opts.minRatingMe);
  }

  const mult = opts.sortOrder === 'asc' ? 1 : -1;
  withListeners.sort((a, b) => {
    let va = a[opts.sortBy];
    let vb = b[opts.sortBy];
    if (opts.sortBy === 'name') {
      va = (va || '').toLowerCase();
      vb = (vb || '').toLowerCase();
      return mult * (va < vb ? -1 : va > vb ? 1 : 0);
    }
    if (opts.sortBy === 'created_at') {
      va = new Date(va || 0).getTime();
      vb = new Date(vb || 0).getTime();
      return mult * (va - vb);
    }
    va = Number(va) ?? 0;
    vb = Number(vb) ?? 0;
    return mult * (va - vb);
  });

  const total = withListeners.length;
  const start = (opts.page - 1) * opts.limit;
  const items = withListeners.slice(start, start + opts.limit);

  res.json({ items, total });
});

router.get('/:slugOrId', optionalAuth, async (req, res) => {
  const station = await db.get(
    `SELECT s.*, u.username as owner_name,
       (SELECT COALESCE(AVG(rating), 0) FROM user_station_ratings WHERE station_id = s.id) as community_avg_rating,
       (SELECT COUNT(*) FROM user_station_ratings WHERE station_id = s.id) as community_rating_count
     FROM stations s JOIN users u ON u.id = s.owner_id
     WHERE s.id = ? OR s.slug = ?`,
    [req.params.slugOrId, req.params.slugOrId]
  );
  if (!station) return res.status(404).json({ error: 'Station not found' });
  const out = {
    ...station,
    community_avg_rating: station.community_avg_rating != null ? Number(station.community_avg_rating) : null,
    community_rating_count: Number(station.community_rating_count ?? 0),
    listener_count: getStationListenerCount(station.id),
  };
  if (req.userId) {
    const myRating = await db.get(
      'SELECT rating FROM user_station_ratings WHERE user_id = ? AND station_id = ?',
      [req.userId, station.id]
    );
    out.rating = myRating?.rating ?? null;
  } else {
    out.rating = null;
  }
  res.json(out);
});

router.patch('/:id/rating', authMiddleware, async (req, res) => {
  const station = await db.get('SELECT id FROM stations WHERE id = ?', [req.params.id]);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  const rating = req.body?.rating != null ? parseInt(req.body.rating, 10) : null;
  if (rating === null || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be 1–5' });
  }
  await db.run(
    `INSERT INTO user_station_ratings (user_id, station_id, rating) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
    [req.userId, req.params.id, rating]
  );
  const updated = await db.get(
    'SELECT rating FROM user_station_ratings WHERE user_id = ? AND station_id = ?',
    [req.userId, req.params.id]
  );
  res.json({ rating: updated?.rating ?? rating });
});

router.patch('/:id', authMiddleware, async (req, res) => {
  const station = await db.get('SELECT id, owner_id FROM stations WHERE id = ?', [req.params.id]);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  if (station.owner_id !== req.userId) return res.status(403).json({ error: 'Only the station creator can edit' });
  const { image_url, name, description } = req.body || {};
  const updates = [];
  const params = [];
  if (typeof image_url !== 'undefined') {
    updates.push('image_url = ?');
    params.push(image_url === null || image_url === '' ? null : String(image_url));
  }
  if (typeof name === 'string' && name.trim()) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (typeof description !== 'undefined') {
    updates.push('description = ?');
    params.push(description === null || description === '' ? null : String(description).trim());
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  params.push(req.params.id);
  await db.run(`UPDATE stations SET ${updates.join(', ')} WHERE id = ?`, params);
  const updated = await db.get(
    `SELECT s.*, u.username as owner_name FROM stations s JOIN users u ON u.id = s.owner_id WHERE s.id = ?`,
    [req.params.id]
  );
  res.json(updated);
});

router.get('/:id/queue', async (req, res) => {
  res.json(await getQueue(req.params.id));
});

router.get('/:id/now-playing', async (req, res) => {
  const station = await db.get('SELECT id FROM stations WHERE id = ?', [req.params.id]);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  const { nowPlaying } = await advanceStationPlayback(req.params.id);
  res.json(nowPlaying);
});

router.post('/:id/queue', authMiddleware, async (req, res) => {
  const { songId } = req.body || {};
  if (!songId) return res.status(400).json({ error: 'songId required' });
  const song = await db.get('SELECT id FROM songs WHERE id = ?', [songId]);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  const station = await db.get('SELECT id FROM stations WHERE id = ?', [req.params.id]);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  const existing = await db.get(
    'SELECT id FROM station_queue WHERE station_id = ? AND song_id = ? AND played_at IS NULL',
    [req.params.id, songId]
  );
  if (existing) return res.status(409).json({ error: 'Song already in queue' });
  const queueId = uuid();
  const maxRow = await db.get('SELECT COALESCE(MAX(position), 0) as m FROM station_queue WHERE station_id = ?', [
    req.params.id,
  ]);
  const maxPos = maxRow?.m ?? 0;
  await db.run(
    'INSERT INTO station_queue (id, station_id, song_id, votes, position) VALUES (?, ?, ?, 0, ?)',
    [queueId, req.params.id, songId, maxPos + 1]
  );
  const row = await db.get(
    `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds, s.thumbnail_url
     FROM station_queue q JOIN songs s ON s.id = q.song_id WHERE q.id = ?`,
    [queueId]
  );
  const queue = await getQueue(req.params.id);
  emitStationUpdate(req.params.id, 'queue', queue);
  res.status(201).json(row);
});

router.post('/:id/vote/:queueId', authMiddleware, async (req, res) => {
  const { id: stationId, queueId } = req.params;
  const station = await db.get('SELECT id FROM stations WHERE id = ?', [stationId]);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  const row = await db.get(
    'SELECT id, votes FROM station_queue WHERE id = ? AND station_id = ? AND played_at IS NULL',
    [queueId, stationId]
  );
  if (!row) return res.status(404).json({ error: 'Queue item not found' });
  try {
    await db.run('INSERT INTO station_votes (station_id, user_id, queue_id) VALUES (?, ?, ?)', [
      stationId,
      req.userId,
      queueId,
    ]);
    await db.run('UPDATE station_queue SET votes = votes + 1 WHERE id = ?', [queueId]);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY' || e.message?.includes('Duplicate')) {
      return res.status(409).json({ error: 'Already voted' });
    }
    throw e;
  }
  const updated = await db.get(
    `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds, s.thumbnail_url
     FROM station_queue q JOIN songs s ON s.id = q.song_id WHERE q.id = ?`,
    [queueId]
  );
  const queue = await getQueue(stationId);
  emitStationUpdate(stationId, 'queue', queue);
  res.json(updated);
});

router.delete('/:id/vote/:queueId', authMiddleware, async (req, res) => {
  const { id: stationId, queueId } = req.params;
  const r = await db.run('DELETE FROM station_votes WHERE station_id = ? AND user_id = ? AND queue_id = ?', [
    stationId,
    req.userId,
    queueId,
  ]);
  if (r.affectedRows > 0) {
    await db.run('UPDATE station_queue SET votes = votes - 1 WHERE id = ?', [queueId]);
  }
  const updated = await db.get(
    `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds, s.thumbnail_url
     FROM station_queue q JOIN songs s ON s.id = q.song_id WHERE q.id = ?`,
    [queueId]
  );
  const queue = await getQueue(req.params.id);
  emitStationUpdate(req.params.id, 'queue', queue);
  res.json(updated || {});
});

export default router;
