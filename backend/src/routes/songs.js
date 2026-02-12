import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import jwt from 'jsonwebtoken';
import db from '../db/schema.js';
import { authMiddleware, JWT_SECRET } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

// Public songs (for everyone) — no auth required for listing
router.get('/public', (req, res) => {
  const list = db.prepare(
    `SELECT s.*, u.username as uploader_name
     FROM songs s
     JOIN users u ON u.id = s.user_id
     WHERE s.is_public = 1
     ORDER BY s.created_at DESC`
  ).all();
  res.json(list);
});

router.use(authMiddleware);

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { title, artist } = req.body || {};
  const id = uuid();
  db.prepare(
    `INSERT INTO songs (id, user_id, title, artist, source, file_path, duration_seconds, is_public)
     VALUES (?, ?, ?, ?, 'upload', ?, 0, 1)`
  ).run(id, req.userId, title || req.file.originalname || 'Untitled', artist || 'Unknown', req.file.filename);
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
  res.json(list);
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
  const { is_public } = req.body || {};
  if (typeof is_public !== 'boolean') return res.status(400).json({ error: 'is_public must be a boolean' });
  db.prepare('UPDATE songs SET is_public = ? WHERE id = ?').run(is_public ? 1 : 0, req.params.id);
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
