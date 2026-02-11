import WebTorrent from 'webtorrent';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import db from '../db/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const downloadsDir = path.join(__dirname, '../../downloads');
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

const client = new WebTorrent();
const AUDIO_EXT = ['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aac'];

function getLargestAudioFile(files) {
  const audio = files.filter(f => AUDIO_EXT.includes(path.extname(f.name).toLowerCase()));
  if (audio.length === 0) return files[0];
  return audio.reduce((a, b) => (a.length > b.length ? a : b));
}

export function addTorrent(userId, magnetOrTorrent, onProgress, onDone) {
  const jobId = uuid();
  db.prepare(
    'INSERT INTO torrent_jobs (id, user_id, magnet_or_torrent, status) VALUES (?, ?, ?, ?)'
  ).run(jobId, userId, magnetOrTorrent, 'downloading');

  client.add(magnetOrTorrent, { path: path.join(downloadsDir, jobId) }, (torrent) => {
    const file = getLargestAudioFile(torrent.files);
    if (!file) {
      db.prepare('UPDATE torrent_jobs SET status = ? WHERE id = ?').run('failed', jobId);
      onDone?.(jobId, null);
      return;
    }
    const interval = setInterval(() => {
      const p = torrent.progress;
      db.prepare('UPDATE torrent_jobs SET status = ? WHERE id = ?').run('downloading', jobId);
      onProgress?.(jobId, p);
      if (p === 1) {
        clearInterval(interval);
        const destDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const ext = path.extname(file.name) || '.mp3';
        const destName = `${uuid()}${ext}`;
        const destPath = path.join(destDir, destName);
        file.getBuffer((err, buf) => {
          if (err) {
            db.prepare('UPDATE torrent_jobs SET status = ? WHERE id = ?').run('failed', jobId);
            onDone?.(jobId, null);
            return;
          }
          fs.writeFileSync(destPath, buf);
          const songId = uuid();
          const title = path.basename(file.name, ext);
          db.prepare(
            `INSERT INTO songs (id, user_id, title, artist, source, file_path, duration_seconds)
             VALUES (?, ?, ?, ?, 'torrent', ?, 0)`
          ).run(songId, userId, title, 'Torrent', destName);
          db.prepare('UPDATE torrent_jobs SET status = ?, song_id = ? WHERE id = ?')
            .run('completed', songId, jobId);
          onDone?.(jobId, songId);
        });
      }
    }, 1000);
  });
  return jobId;
}

export function getTorrentJobs(userId) {
  return db.prepare('SELECT * FROM torrent_jobs WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
}
