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

// Generate silent WAV for demo AI tracks (no real audio generated yet)
function silentWavBuffer(seconds = 30) {
  const sampleRate = 44100;
  const numChannels = 2;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const dataSize = Math.floor(seconds * byteRate);
  const fileSize = 36 + dataSize;
  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;
  const write = (buf) => { buf.copy(buffer, offset); offset += buf.length; };
  write(Buffer.from('RIFF', 'ascii'));
  buffer.writeUInt32LE(fileSize, offset); offset += 4;
  write(Buffer.from('WAVEfmt ', 'ascii'));
  buffer.writeUInt32LE(16, offset); offset += 4;   // fmt chunk size
  buffer.writeUInt16LE(1, offset); offset += 2;  // PCM
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  write(Buffer.from('data', 'ascii'));
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  // rest is already zero (silent samples)
  return buffer;
}

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

  // AI demo tracks have no real file; serve silent placeholder so they "play"
  if (song.source === 'ai' && song.file_path?.startsWith?.('ai:')) {
    const duration = Math.min(600, Math.max(1, (song.duration_seconds || 30)));
    const wav = silentWavBuffer(duration);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', wav.length);
    return res.send(wav);
  }

  if (!song.file_path) return res.status(404).json({ error: 'Song not found' });
  const filePath = path.join(uploadsDir, song.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

router.use(authMiddleware);

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { title, artist } = req.body || {};
  const id = uuid();
  db.prepare(
    `INSERT INTO songs (id, user_id, title, artist, source, file_path, duration_seconds)
     VALUES (?, ?, ?, ?, 'upload', ?, 0)`
  ).run(id, req.userId, title || req.file.originalname || 'Untitled', artist || 'Unknown', req.file.filename);
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
  res.status(201).json(song);
});

router.get('/', (req, res) => {
  const list = db.prepare(
    `SELECT s.*, u.username as uploader_name
     FROM songs s
     JOIN users u ON u.id = s.user_id
     ORDER BY s.created_at DESC`
  ).all();
  res.json(list);
});

router.get('/:id', (req, res) => {
  const song = db.prepare(
    `SELECT s.*, u.username as uploader_name FROM songs s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
  ).get(req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  res.json(song);
});

export default router;
