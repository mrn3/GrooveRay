import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { emitStationUpdate } from '../socket.js';

const router = Router();

function slugify(s) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

router.post('/', authMiddleware, (req, res) => {
  const { name, description } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Station name required' });
  const id = uuid();
  let slug = slugify(name);
  const existing = db.prepare('SELECT id FROM stations WHERE slug = ?').get(slug);
  if (existing) slug = `${slug}-${id.slice(0, 8)}`;
  db.prepare(
    'INSERT INTO stations (id, owner_id, name, slug, description) VALUES (?, ?, ?, ?, ?)'
  ).run(id, req.userId, name.trim(), slug, description?.trim() || '');
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(id);
  res.status(201).json(station);
});

router.get('/', (req, res) => {
  const list = db.prepare(
    `SELECT s.*, u.username as owner_name
     FROM stations s JOIN users u ON u.id = s.owner_id
     ORDER BY s.created_at DESC`
  ).all();
  res.json(list);
});

router.get('/:slugOrId', (req, res) => {
  const station = db.prepare(
    `SELECT s.*, u.username as owner_name
     FROM stations s JOIN users u ON u.id = s.owner_id
     WHERE s.id = ? OR s.slug = ?`
  ).get(req.params.slugOrId, req.params.slugOrId);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json(station);
});

router.get('/:id/queue', (req, res) => {
  const queue = db.prepare(
    `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds
     FROM station_queue q
     JOIN songs s ON s.id = q.song_id
     WHERE q.station_id = ? AND q.played_at IS NULL
     ORDER BY q.votes DESC, q.added_at ASC`
  ).all(req.params.id);
  res.json(queue);
});

router.post('/:id/queue', authMiddleware, (req, res) => {
  const { songId } = req.body || {};
  if (!songId) return res.status(400).json({ error: 'songId required' });
  const song = db.prepare('SELECT id FROM songs WHERE id = ?').get(songId);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  const station = db.prepare('SELECT id FROM stations WHERE id = ?').get(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  const existing = db.prepare(
    'SELECT id FROM station_queue WHERE station_id = ? AND song_id = ? AND played_at IS NULL'
  ).get(req.params.id, songId);
  if (existing) return res.status(409).json({ error: 'Song already in queue' });
  const queueId = uuid();
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) as m FROM station_queue WHERE station_id = ?')
    .get(req.params.id).m;
  db.prepare(
    'INSERT INTO station_queue (id, station_id, song_id, votes, position) VALUES (?, ?, ?, 0, ?)'
  ).run(queueId, req.params.id, songId, maxPos + 1);
  const row = db.prepare(
    `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds
     FROM station_queue q JOIN songs s ON s.id = q.song_id WHERE q.id = ?`
  ).get(queueId);
  const queue = db.prepare(
    `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds
     FROM station_queue q JOIN songs s ON s.id = q.song_id
     WHERE q.station_id = ? AND q.played_at IS NULL ORDER BY q.votes DESC, q.added_at ASC`
  ).all(req.params.id);
  emitStationUpdate(req.params.id, 'queue', queue);
  res.status(201).json(row);
});

router.post('/:id/vote/:queueId', authMiddleware, (req, res) => {
  const { id: stationId, queueId } = req.params;
  const station = db.prepare('SELECT id FROM stations WHERE id = ?').get(stationId);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  const row = db.prepare('SELECT id, votes FROM station_queue WHERE id = ? AND station_id = ? AND played_at IS NULL')
    .get(queueId, stationId);
  if (!row) return res.status(404).json({ error: 'Queue item not found' });
  try {
    db.prepare('INSERT INTO station_votes (station_id, user_id, queue_id) VALUES (?, ?, ?)')
      .run(stationId, req.userId, queueId);
    db.prepare('UPDATE station_queue SET votes = votes + 1 WHERE id = ?').run(queueId);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Already voted' });
    }
    throw e;
  }
  const updated = db.prepare(
    `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds
     FROM station_queue q JOIN songs s ON s.id = q.song_id WHERE q.id = ?`
  ).get(queueId);
  const queue = db.prepare(
    `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds
     FROM station_queue q JOIN songs s ON s.id = q.song_id
     WHERE q.station_id = ? AND q.played_at IS NULL ORDER BY q.votes DESC, q.added_at ASC`
  ).all(stationId);
  emitStationUpdate(stationId, 'queue', queue);
  res.json(updated);
});

router.delete('/:id/vote/:queueId', authMiddleware, (req, res) => {
  const { id: stationId, queueId } = req.params;
  const r = db.prepare(
    'DELETE FROM station_votes WHERE station_id = ? AND user_id = ? AND queue_id = ?'
  ).run(stationId, req.userId, queueId);
  if (r.changes) {
    db.prepare('UPDATE station_queue SET votes = votes - 1 WHERE id = ?').run(queueId);
  }
  const updated = db.prepare(
    `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds
     FROM station_queue q JOIN songs s ON s.id = q.song_id WHERE q.id = ?`
  ).get(queueId);
  const queue = db.prepare(
    `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds
     FROM station_queue q JOIN songs s ON s.id = q.song_id
     WHERE q.station_id = ? AND q.played_at IS NULL ORDER BY q.votes DESC, q.added_at ASC`
  ).all(req.params.id);
  emitStationUpdate(req.params.id, 'queue', queue);
  res.json(updated || {});
});

router.post('/:id/played', authMiddleware, (req, res) => {
  const { queueId } = req.body || {};
  if (!queueId) return res.status(400).json({ error: 'queueId required' });
  db.prepare(
    'UPDATE station_queue SET played_at = datetime(\'now\') WHERE id = ? AND station_id = ?'
  ).run(queueId, req.params.id);
  const queue = db.prepare(
    `SELECT q.*, s.title, s.artist, s.source, s.file_path, s.duration_seconds
     FROM station_queue q JOIN songs s ON s.id = q.song_id
     WHERE q.station_id = ? AND q.played_at IS NULL ORDER BY q.votes DESC, q.added_at ASC`
  ).all(req.params.id);
  emitStationUpdate(req.params.id, 'queue', queue);
  emitStationUpdate(req.params.id, 'nowPlaying', { queueId });
  res.json({ ok: true });
});

export default router;
