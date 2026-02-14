import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import db from '../db/schema.js';

/** Throw with a clear message if yt-dlp or ffmpeg are missing (so we can return 400 before 202). */
function ensureYouTubeDeps() {
  try {
    execSync('command -v yt-dlp >/dev/null 2>&1', { stdio: 'pipe' });
  } catch {
    throw new Error(
      'yt-dlp is not installed on the server. Install it (and ffmpeg for MP3): e.g. brew install yt-dlp ffmpeg'
    );
  }
  try {
    execSync('command -v ffmpeg >/dev/null 2>&1', { stdio: 'pipe' });
  } catch {
    throw new Error(
      'ffmpeg is not installed on the server (required for MP3). Install with: brew install ffmpeg'
    );
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads');
const youtubeDir = path.join(__dirname, '../../downloads/youtube');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(youtubeDir)) fs.mkdirSync(youtubeDir, { recursive: true });

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/i;
const YOUTUBE_ID_REGEX = /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([\w-]{10,12})/i;

export function isValidYouTubeUrl(url) {
  return typeof url === 'string' && YOUTUBE_URL_REGEX.test(url.trim());
}

/** Extract YouTube video ID from a URL (e.g. watch?v=ID, youtu.be/ID, shorts/ID). */
export function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.trim().match(YOUTUBE_ID_REGEX);
  return m ? m[1] : null;
}

export async function addYouTube(userId, url) {
  if (!isValidYouTubeUrl(url)) {
    throw new Error('Invalid YouTube URL. Use a youtube.com or youtu.be link.');
  }
  const normalizedUrl = url.trim();
  const youtubeId = extractYouTubeVideoId(normalizedUrl);
  if (youtubeId) {
    const existing = await db.get('SELECT id FROM songs WHERE user_id = ? AND youtube_id = ?', [userId, youtubeId]);
    if (existing) {
      throw new Error('This video is already in your library.');
    }
  }
  ensureYouTubeDeps();
  const jobId = uuid();
  await db.run(
    'INSERT INTO youtube_jobs (id, user_id, url, status) VALUES (?, ?, ?, ?)',
    [jobId, userId, normalizedUrl, 'downloading']
  );

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
  ];

  // YouTube often requires cookies to avoid "Sign in to confirm you're not a bot"
  // Prefer per-user cookies from profile; then env cookies file or browser
  let cookiesFileToUse = null;
  const user = await db.get('SELECT youtube_cookies FROM users WHERE id = ?', [userId]);
  const userCookies = user?.youtube_cookies && String(user.youtube_cookies).trim();
  if (userCookies) {
    const userCookiesPath = path.join(jobDir, 'cookies.txt');
    fs.writeFileSync(userCookiesPath, userCookies, 'utf8');
    cookiesFileToUse = userCookiesPath;
  }
  if (!cookiesFileToUse) {
    const cookiesFromBrowser = process.env.YTDLP_COOKIES_FROM_BROWSER;
    const cookiesFile = process.env.YTDLP_COOKIES_FILE;
    if (cookiesFromBrowser) {
      args.push('--cookies-from-browser', cookiesFromBrowser);
    } else if (cookiesFile && fs.existsSync(cookiesFile)) {
      args.push('--cookies', cookiesFile);
    }
  } else {
    args.push('--cookies', cookiesFileToUse);
  }

  args.push(normalizedUrl);

  // So yt-dlp can find Deno/Node for YouTube n-signature (EJS) when needed
  const denoBin = process.env.HOME && path.join(process.env.HOME, '.deno', 'bin');
  const nodeBin = path.dirname(process.execPath);
  const extraPath = [denoBin, nodeBin].filter(Boolean).join(path.delimiter);
  const env = extraPath
    ? { ...process.env, PATH: `${extraPath}${path.delimiter}${process.env.PATH || ''}` }
    : process.env;

  const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'], env });

  let stderr = '';
  proc.stderr?.on('data', (chunk) => { stderr += chunk; });

  function friendlyError(msg) {
    if (typeof msg !== 'string' || !msg.trim()) return msg || null;
    const s = msg.toLowerCase();
    if (s.includes('ffmpeg') && (s.includes('not found') || s.includes('not installed') || s.includes('missing'))) {
      return 'ffmpeg is not installed on the server (required for MP3). Install with: brew install ffmpeg';
    }
    if (s.includes('yt-dlp') && (s.includes('not found') || s.includes('no such file'))) {
      return 'yt-dlp is not installed on the server. Install with: brew install yt-dlp ffmpeg';
    }
    return msg.length > 500 ? msg.slice(0, 497) + '...' : msg;
  }

  async function setFailed(msg) {
    const truncated = friendlyError(typeof msg === 'string' ? msg : (msg && msg.message) || '');
    await db.run('UPDATE youtube_jobs SET status = ?, error_message = ? WHERE id = ?', ['failed', truncated, jobId]);
  }

  proc.on('close', async (code) => {
    try {
      if (code !== 0) {
        await setFailed(stderr.trim() || `yt-dlp exited with code ${code}`);
        return;
      }
      const files = fs.readdirSync(jobDir);
      const audioFile = files.find((f) => /\.(mp3|m4a|opus|ogg|webm)$/i.test(f));
      const jsonFile = files.find((f) => f.endsWith('.info.json'));
      if (!audioFile) {
        await setFailed(stderr.trim() || 'No audio file produced');
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
      let thumbnailUrl = null;
      let youtubeId = null;
      let description = null;
      if (jsonFile) {
        try {
          const info = JSON.parse(fs.readFileSync(path.join(jobDir, jsonFile), 'utf8'));
          title = info.title || title;
          artist = info.uploader || info.channel || artist;
          durationSeconds = Math.round(Number(info.duration) || 0);
          thumbnailUrl = info.thumbnail && typeof info.thumbnail === 'string' ? info.thumbnail : null;
          if (info.id && typeof info.id === 'string') youtubeId = info.id;
          const rawDesc = info.description;
          if (rawDesc && typeof rawDesc === 'string' && rawDesc.trim()) {
            description = rawDesc.length > 10000 ? rawDesc.slice(0, 9997) + '...' : rawDesc.trim();
          }
        } catch (_) {}
      }

      const songId = uuid();
      await db.run(
        `INSERT INTO songs (id, user_id, title, artist, source, file_path, duration_seconds, is_public, thumbnail_url, youtube_id, description)
         VALUES (?, ?, ?, ?, 'youtube', ?, ?, 1, ?, ?, ?)`,
        [songId, userId, title, artist, destName, durationSeconds, thumbnailUrl, youtubeId, description]
      );
      await db.run('UPDATE youtube_jobs SET status = ?, song_id = ? WHERE id = ?', ['completed', songId, jobId]);
    } finally {
      try {
        fs.rmSync(jobDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  proc.on('error', async (err) => {
    if (err?.code === 'ENOENT') {
      await db.run('UPDATE youtube_jobs SET status = ?, error_message = ? WHERE id = ?', [
        'failed',
        'yt-dlp not found. Install it (and ffmpeg for MP3): e.g. brew install yt-dlp ffmpeg',
        jobId,
      ]);
    } else {
      await setFailed(err?.message || 'Unknown error');
    }
  });

  return jobId;
}

export async function getYouTubeJobs(userId) {
  return db.all('SELECT * FROM youtube_jobs WHERE user_id = ? ORDER BY created_at DESC', [userId]);
}
