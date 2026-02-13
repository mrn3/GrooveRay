import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { emitStationUpdate } from '../socket.js';

const router = Router();

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

router.get('/', async (req, res) => {
  const list = await db.all(
    `SELECT s.*, u.username as owner_name
     FROM stations s JOIN users u ON u.id = s.owner_id
     ORDER BY s.created_at DESC`
  );
  res.json(list);
});

router.get('/:slugOrId', async (req, res) => {
  const station = await db.get(
    `SELECT s.*, u.username as owner_name
     FROM stations s JOIN users u ON u.id = s.owner_id
     WHERE s.id = ? OR s.slug = ?`,
    [req.params.slugOrId, req.params.slugOrId]
  );
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json(station);
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
