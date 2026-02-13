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

async function attachCommunityRatings(list) {
  if (!list?.length) return list;
  const ids = list.map((s) => s.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.all(
    `SELECT song_id, AVG(rating) as avg_rating, COUNT(*) as rating_count
     FROM user_song_ratings
     WHERE song_id IN (${placeholders})
     GROUP BY song_id`,
    ids
  );
  const map = Object.fromEntries(rows.map((r) => [r.song_id, { avg_rating: r.avg_rating, rating_count: r.rating_count }]));
  return list.map((s) => ({
    ...s,
    community_avg_rating: map[s.id]?.avg_rating ?? null,
    community_rating_count: map[s.id]?.rating_count ?? 0,
  }));
}

async function attachUserStats(list, userId) {
  if (!userId || !list?.length) return list;
  const ids = list.map((s) => s.id);
  const placeholders = ids.map(() => '?').join(',');
  const ratings = await db.all(
    `SELECT song_id, rating FROM user_song_ratings WHERE user_id = ? AND song_id IN (${placeholders})`,
    [userId, ...ids]
  );
  const listens = await db.all(
    `SELECT song_id, listen_count FROM user_song_listens WHERE user_id = ? AND song_id IN (${placeholders})`,
    [userId, ...ids]
  );
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

router.get('/:id/stream', async (req, res) => {
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
  const song = await db.get('SELECT * FROM songs WHERE id = ?', [req.params.id]);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  if (!song.file_path) return res.status(404).json({ error: 'Song not found' });
  const filePath = path.join(uploadsDir, song.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

router.get('/public', optionalAuth, async (req, res) => {
  const list = await db.all(
    `SELECT s.*, u.username as uploader_name
     FROM songs s
     JOIN users u ON u.id = s.user_id
     WHERE s.is_public = 1
     ORDER BY s.created_at DESC`
  );
  if (list.length > 0) {
    const placeholders = list.map(() => '?').join(',');
    const totals = await db.all(
      `SELECT song_id, SUM(listen_count) as total_listen_count
       FROM user_song_listens
       WHERE song_id IN (${placeholders})
       GROUP BY song_id`,
      list.map((s) => s.id)
    );
    const totalMap = Object.fromEntries(totals.map((r) => [r.song_id, r.total_listen_count]));
    list.forEach((s) => {
      s.total_listen_count = totalMap[s.id] ?? 0;
    });
  }
  const withCommunity = await attachCommunityRatings(list);
  res.json(await attachUserStats(withCommunity, req.userId));
});

router.use(authMiddleware);

async function fetchThumbnailForTrack(artist, title) {
  const term = encodeURIComponent(`${artist} ${title}`.trim());
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=1`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const track = data?.results?.[0];
    return track?.artworkUrl100 || track?.artworkUrl60 || null;
  } catch (_) {
    return null;
  }
}

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { title, artist } = req.body || {};
  const finalTitle = title || req.file.originalname || 'Untitled';
  const finalArtist = artist || 'Unknown';
  const id = uuid();
  const filePath = path.join(uploadsDir, req.file.filename);
  let durationSeconds = 0;
  try {
    const metadata = await parseFile(filePath);
    durationSeconds = Math.round(Number(metadata.format?.duration) || 0);
  } catch (_) {}
  await db.run(
    `INSERT INTO songs (id, user_id, title, artist, source, file_path, duration_seconds, is_public, thumbnail_url)
     VALUES (?, ?, ?, ?, 'upload', ?, ?, 1, ?)`,
    [id, req.userId, finalTitle, finalArtist, req.file.filename, durationSeconds, null]
  );
  let thumbnailUrl = null;
  try {
    thumbnailUrl = await fetchThumbnailForTrack(finalArtist, finalTitle);
    if (thumbnailUrl) {
      await db.run('UPDATE songs SET thumbnail_url = ? WHERE id = ?', [thumbnailUrl, id]);
    }
  } catch (_) {}
  const song = await db.get('SELECT * FROM songs WHERE id = ?', [id]);
  res.status(201).json(song);
});

router.get('/', async (req, res) => {
  const list = await db.all(
    `SELECT s.*, u.username as uploader_name
     FROM songs s
     JOIN users u ON u.id = s.user_id
     WHERE s.user_id = ?
     ORDER BY s.created_at DESC`,
    [req.userId]
  );
  res.json(await attachUserStats(list, req.userId));
});

router.get('/favorites', async (req, res) => {
  const userId = req.userId;
  const ratedRows = await db.all('SELECT song_id FROM user_song_ratings WHERE user_id = ? AND rating > 0', [userId]);
  const listenedRows = await db.all('SELECT song_id FROM user_song_listens WHERE user_id = ? AND listen_count > 0', [userId]);
  const ratedSongIds = ratedRows.map((r) => r.song_id);
  const listenedSongIds = listenedRows.map((r) => r.song_id);
  const allIds = [...new Set([...ratedSongIds, ...listenedSongIds])];
  if (allIds.length === 0) {
    return res.json(await attachUserStats([], userId));
  }
  const placeholders = allIds.map(() => '?').join(',');
  const list = await db.all(
    `SELECT s.*, u.username as uploader_name
     FROM songs s
     JOIN users u ON u.id = s.user_id
     WHERE s.id IN (${placeholders})`,
    allIds
  );
  const withCommunity = await attachCommunityRatings(list);
  const withStats = await attachUserStats(withCommunity, userId);
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

router.post('/:id/played', async (req, res) => {
  const song = await db.get('SELECT id FROM songs WHERE id = ?', [req.params.id]);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  await db.run(
    `INSERT INTO user_song_listens (user_id, song_id, listen_count)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE listen_count = listen_count + 1`,
    [req.userId, req.params.id]
  );
  res.status(204).send();
});

router.patch('/:id/rating', async (req, res) => {
  const song = await db.get('SELECT id FROM songs WHERE id = ?', [req.params.id]);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  const { rating } = req.body || {};
  const r = typeof rating === 'number' ? Math.max(0, Math.min(5, Math.round(rating))) : null;
  if (r === null) return res.status(400).json({ error: 'Provide rating (1-5)' });
  await db.run(
    `INSERT INTO user_song_ratings (user_id, song_id, rating) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
    [req.userId, req.params.id, r]
  );
  res.status(204).send();
});

router.get('/:id', async (req, res) => {
  const song = await db.get(
    `SELECT s.*, u.username as uploader_name FROM songs s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [req.params.id]
  );
  if (!song) return res.status(404).json({ error: 'Song not found' });
  res.json(song);
});

router.patch('/:id', async (req, res) => {
  const song = await db.get('SELECT * FROM songs WHERE id = ?', [req.params.id]);
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
  await db.run(`UPDATE songs SET ${updates.join(', ')} WHERE id = ?`, values);
  const updated = await db.get(
    `SELECT s.*, u.username as uploader_name FROM songs s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [req.params.id]
  );
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const song = await db.get('SELECT * FROM songs WHERE id = ?', [req.params.id]);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  if (song.user_id !== req.userId) return res.status(403).json({ error: 'You can only delete your own songs' });

  const songId = req.params.id;

  // Remove all references so we can delete the song (FK constraints)
  await db.run('DELETE FROM station_queue WHERE song_id = ?', [songId]);
  await db.run('DELETE FROM user_song_favorites WHERE song_id = ?', [songId]);
  await db.run('DELETE FROM user_song_ratings WHERE song_id = ?', [songId]);
  await db.run('DELETE FROM user_song_listens WHERE song_id = ?', [songId]);
  await db.run('DELETE FROM youtube_jobs WHERE song_id = ?', [songId]);

  // Delete the song row
  await db.run('DELETE FROM songs WHERE id = ?', [songId]);

  // Delete the MP3 file from disk if it exists
  if (song.file_path) {
    const filePath = path.join(uploadsDir, song.file_path);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error('Failed to delete song file:', filePath, err);
      // Still return success; DB row is already removed
    }
  }

  res.status(204).send();
});

export default router;
