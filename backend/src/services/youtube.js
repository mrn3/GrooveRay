import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import db from '../db/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads');
const youtubeDir = path.join(__dirname, '../../downloads/youtube');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(youtubeDir)) fs.mkdirSync(youtubeDir, { recursive: true });

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/i;

export function isValidYouTubeUrl(url) {
  return typeof url === 'string' && YOUTUBE_URL_REGEX.test(url.trim());
}

export function addYouTube(userId, url) {
  if (!isValidYouTubeUrl(url)) {
    throw new Error('Invalid YouTube URL. Use a youtube.com or youtu.be link.');
  }
  const jobId = uuid();
  const normalizedUrl = url.trim();
  db.prepare(
    'INSERT INTO youtube_jobs (id, user_id, url, status) VALUES (?, ?, ?, ?)'
  ).run(jobId, userId, normalizedUrl, 'downloading');

  const jobDir = path.join(youtubeDir, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const outTemplate = path.join(jobDir, 'audio.%(ext)s');

  const args = [
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '-o', outTemplate,
    '--write-info-json',
    '--no-playlist',
    '--no-warnings',
    normalizedUrl,
  ];

  const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let stderr = '';
  proc.stderr?.on('data', (chunk) => { stderr += chunk; });

  function setFailed(msg) {
    const truncated = typeof msg === 'string' && msg.length > 500 ? msg.slice(0, 497) + '...' : (msg || null);
    db.prepare('UPDATE youtube_jobs SET status = ?, error_message = ? WHERE id = ?').run('failed', truncated, jobId);
  }

  proc.on('close', (code) => {
    try {
      if (code !== 0) {
        setFailed(stderr.trim() || `yt-dlp exited with code ${code}`);
        return;
      }
      const files = fs.readdirSync(jobDir);
      const audioFile = files.find((f) => /\.(mp3|m4a|opus|ogg|webm)$/i.test(f));
      const jsonFile = files.find((f) => f.endsWith('.info.json'));
      if (!audioFile) {
        setFailed(stderr.trim() || 'No audio file produced');
        return;
      }
      const srcPath = path.join(jobDir, audioFile);
      const ext = path.extname(audioFile) || '.mp3';
      const destName = `${uuid()}${ext}`;
      const destPath = path.join(uploadsDir, destName);
      fs.renameSync(srcPath, destPath);

      let title = path.basename(audioFile, ext);
      let artist = 'YouTube';
      let durationSeconds = 0;
      if (jsonFile) {
        try {
          const info = JSON.parse(fs.readFileSync(path.join(jobDir, jsonFile), 'utf8'));
          title = info.title || title;
          artist = info.uploader || info.channel || artist;
          durationSeconds = Math.round(Number(info.duration) || 0);
        } catch (_) {}
      }

      const songId = uuid();
      db.prepare(
        `INSERT INTO songs (id, user_id, title, artist, source, file_path, duration_seconds)
         VALUES (?, ?, ?, ?, 'youtube', ?, ?)`
      ).run(songId, userId, title, artist, destName, durationSeconds);
      db.prepare('UPDATE youtube_jobs SET status = ?, song_id = ? WHERE id = ?')
        .run('completed', songId, jobId);
    } finally {
      try {
        fs.rmSync(jobDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  proc.on('error', (err) => {
    if (err?.code === 'ENOENT') {
      db.prepare('UPDATE youtube_jobs SET status = ?, error_message = ? WHERE id = ?')
        .run('failed', 'yt-dlp not found. Install it (and ffmpeg for MP3): e.g. brew install yt-dlp ffmpeg', jobId);
    } else {
      setFailed(err?.message || 'Unknown error');
    }
  });

  return jobId;
}

export function getYouTubeJobs(userId) {
  return db.prepare('SELECT * FROM youtube_jobs WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
}
