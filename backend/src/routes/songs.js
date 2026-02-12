import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import jwt from 'jsonwebtoken';
import { parseFile } from 'music-metadata';
import db from '../db/schema.js';
import { authMiddleware, optionalAuth, JWT_SECRET } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper: attach current user's rating and listen_count to each song
function attachUserStats(list, userId) {
  if (!userId || !list?.length) return list;
  const ids = list.map((s) => s.id);
  const placeholders = ids.map(() => '?').join(',');
  const ratings = db.prepare(
    `SELECT song_id, rating FROM user_song_ratings WHERE user_id = ? AND song_id IN (${placeholders})`
  ).all(userId, ...ids);
  const listens = db.prepare(
    `SELECT song_id, listen_count FROM user_song_listens WHERE user_id = ? AND song_id IN (${placeholders})`
  ).all(userId, ...ids);
  const ratingMap = Object.fromEntries(ratings.map((r) => [r.song_id, r.rating]));
  const listenMap = Object.fromEntries(listens.map((r) => [r.song_id, r.listen_count]));
  return list.map((s) => ({
    ...s,
    rating: ratingMap[s.id] ?? null,
    listen_count: listenMap[s.id] ?? 0,
  }));
}
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname) || '.mp3'}`),
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

const router = Router();

// Stream must allow query token (Audio element cannot send Authorization header)
router.get('/:id/stream', (req, res) => {
  const token = req.query.token || req.headers.authorization?.slice(7);
  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ error: 'Authorization required' });
  }
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  if (!song.file_path) return res.status(404).json({ error: 'Song not found' });
  const filePath = path.join(uploadsDir, song.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

// Public songs — optional auth to attach user's favorite/rating/listen_count + total listens
router.get('/public', optionalAuth, (req, res) => {
  const list = db.prepare(
    `SELECT s.*, u.username as uploader_name
     FROM songs s
     JOIN users u ON u.id = s.user_id
     WHERE s.is_public = 1
     ORDER BY s.created_at DESC`
  ).all();
  if (list.length > 0) {
    const placeholders = list.map(() => '?').join(',');
    const totals = db.prepare(
      `SELECT song_id, SUM(listen_count) as total_listen_count
       FROM user_song_listens
       WHERE song_id IN (${placeholders})
       GROUP BY song_id`
    ).all(...list.map((s) => s.id));
    const totalMap = Object.fromEntries(totals.map((r) => [r.song_id, r.total_listen_count]));
    list.forEach((s) => {
      s.total_listen_count = totalMap[s.id] ?? 0;
    });
  }
  res.json(attachUserStats(list, req.userId));
});

router.use(authMiddleware);

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { title, artist } = req.body || {};
  const id = uuid();
  const filePath = path.join(uploadsDir, req.file.filename);
  let durationSeconds = 0;
  try {
    const metadata = await parseFile(filePath);
    durationSeconds = Math.round(Number(metadata.format?.duration) || 0);
  } catch (_) {
    // Keep 0 if metadata parsing fails (e.g. unsupported or corrupt file)
  }
  db.prepare(
    `INSERT INTO songs (id, user_id, title, artist, source, file_path, duration_seconds, is_public)
     VALUES (?, ?, ?, ?, 'upload', ?, ?, 1)`
  ).run(id, req.userId, title || req.file.originalname || 'Untitled', artist || 'Unknown', req.file.filename, durationSeconds);
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
  res.status(201).json(song);
});

// My library (authenticated) — only songs owned by current user
router.get('/', (req, res) => {
  const list = db.prepare(
    `SELECT s.*, u.username as uploader_name
     FROM songs s
     JOIN users u ON u.id = s.user_id
     WHERE s.user_id = ?
     ORDER BY s.created_at DESC`
  ).all(req.userId);
  res.json(attachUserStats(list, req.userId));
});

// My songs — rated or listened; with listen_count
router.get('/favorites', (req, res) => {
  const userId = req.userId;
  const ratedSongIds = db.prepare(
    'SELECT song_id FROM user_song_ratings WHERE user_id = ? AND rating > 0'
  ).all(userId).map((r) => r.song_id);
  const listenedSongIds = db.prepare(
    'SELECT song_id FROM user_song_listens WHERE user_id = ? AND listen_count > 0'
  ).all(userId).map((r) => r.song_id);
  const allIds = [...new Set([...ratedSongIds, ...listenedSongIds])];
  if (allIds.length === 0) {
    return res.json(attachUserStats([], userId));
  }
  const placeholders = allIds.map(() => '?').join(',');
  const list = db.prepare(
    `SELECT s.*, u.username as uploader_name
     FROM songs s
     JOIN users u ON u.id = s.user_id
     WHERE s.id IN (${placeholders})`
  ).all(...allIds);
  const withStats = attachUserStats(list, userId);
  const byId = Object.fromEntries(withStats.map((s) => [s.id, s]));
  const ordered = allIds
    .map((id) => byId[id])
    .filter(Boolean)
    .sort((a, b) => {
      const ra = a.rating ?? 0;
      const rb = b.rating ?? 0;
      if (ra !== rb) return rb - ra;
      return (b.listen_count ?? 0) - (a.listen_count ?? 0);
    });
  res.json(ordered);
});

router.post('/:id/played', (req, res) => {
  const song = db.prepare('SELECT id FROM songs WHERE id = ?').get(req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  db.prepare(
    `INSERT INTO user_song_listens (user_id, song_id, listen_count)
     VALUES (?, ?, 1)
     ON CONFLICT(user_id, song_id) DO UPDATE SET listen_count = listen_count + 1`
  ).run(req.userId, req.params.id);
  res.status(204).send();
});

router.patch('/:id/rating', (req, res) => {
  const song = db.prepare('SELECT id FROM songs WHERE id = ?').get(req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  const { rating } = req.body || {};
  const r = typeof rating === 'number' ? Math.max(0, Math.min(5, Math.round(rating))) : null;
  if (r === null) return res.status(400).json({ error: 'Provide rating (1-5)' });
  db.prepare(
    `INSERT INTO user_song_ratings (user_id, song_id, rating) VALUES (?, ?, ?)
     ON CONFLICT(user_id, song_id) DO UPDATE SET rating = excluded.rating`
  ).run(req.userId, req.params.id, r);
  res.status(204).send();
});

router.get('/:id', (req, res) => {
  const song = db.prepare(
    `SELECT s.*, u.username as uploader_name FROM songs s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
  ).get(req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  res.json(song);
});

router.patch('/:id', (req, res) => {
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  if (song.user_id !== req.userId) return res.status(403).json({ error: 'You can only update your own songs' });
  const { is_public, title, artist } = req.body || {};

  const updates = [];
  const values = [];
  if (typeof is_public === 'boolean') {
    updates.push('is_public = ?');
    values.push(is_public ? 1 : 0);
  }
  if (typeof title === 'string') {
    const t = title.trim();
    if (t.length === 0) return res.status(400).json({ error: 'Title cannot be empty' });
    updates.push('title = ?');
    values.push(t);
  }
  if (typeof artist === 'string') {
    updates.push('artist = ?');
    values.push(artist.trim());
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Provide at least one of: is_public, title, artist' });

  values.push(req.params.id);
  db.prepare(`UPDATE songs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare(
    `SELECT s.*, u.username as uploader_name FROM songs s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
  ).get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  if (song.user_id !== req.userId) return res.status(403).json({ error: 'You can only delete your own songs' });

  db.prepare('DELETE FROM station_queue WHERE song_id = ?').run(req.params.id);
  db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.id);

  if (song.file_path) {
    const filePath = path.join(uploadsDir, song.file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  res.status(204).send();
});

export default router;
