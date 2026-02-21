import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import sharp from 'sharp';
import { authMiddleware } from '../middleware/auth.js';
import { searchImage } from '../services/imageSearch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UPLOADS = path.join(__dirname, '../../uploads');
const AVATARS_DIR = path.join(UPLOADS, 'avatars');
const THUMBNAILS_DIR = path.join(UPLOADS, 'thumbnails');
const PLAYLISTS_DIR = path.join(UPLOADS, 'playlists');
const STATIONS_DIR = path.join(UPLOADS, 'stations');

[AVATARS_DIR, THUMBNAILS_DIR, PLAYLISTS_DIR, STATIONS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const TYPE_CONFIG = {
  avatar: { dir: AVATARS_DIR, urlPrefix: '/api/uploads/avatars/', maxSize: 400 },
  thumbnail: { dir: THUMBNAILS_DIR, urlPrefix: '/api/uploads/thumbnails/', maxSize: 1200 },
  playlist: { dir: PLAYLISTS_DIR, urlPrefix: '/api/uploads/playlists/', maxSize: 1200 },
  station: { dir: STATIONS_DIR, urlPrefix: '/api/uploads/stations/', maxSize: 1200 },
};

const router = Router();

/**
 * POST /api/images/fetch-from-url
 * Body: { url: string, type: 'avatar'|'thumbnail'|'playlist'|'station' }
 * Downloads image from URL, resizes if necessary, saves to uploads, returns { url }.
 */
router.post('/fetch-from-url', authMiddleware, async (req, res) => {
  const { url: imageUrl, type } = req.body || {};
  const config = TYPE_CONFIG[type];
  if (!config) {
    return res.status(400).json({ error: 'Invalid type. Use: avatar, thumbnail, playlist, or station' });
  }
  if (!imageUrl || typeof imageUrl !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid url' });
  }
  let href;
  try {
    href = new URL(imageUrl);
  } catch (_) {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (href.protocol !== 'http:' && href.protocol !== 'https:') {
    return res.status(400).json({ error: 'URL must be http or https' });
  }
  const hostname = href.hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname) || hostname.endsWith('.local')) {
    return res.status(400).json({ error: 'Cannot fetch from local URLs' });
  }

  try {
    const response = await fetch(imageUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'GrooveRay/1.0 (image fetch)' },
    });
    if (!response.ok) {
      return res.status(400).json({ error: `Failed to fetch image: ${response.status}` });
    }
    const contentType = response.headers.get('content-type') || '';
    if (!/^image\/(jpeg|png|gif|webp)/i.test(contentType)) {
      return res.status(400).json({ error: 'URL did not return an image' });
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large (max 10MB)' });
    }

    const ext = '.jpg';
    const filename = `${uuid()}${ext}`;
    const destPath = path.join(config.dir, filename);
    const maxSize = config.maxSize;

    await sharp(buffer)
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toFile(destPath);

    const url = `${config.urlPrefix}${filename}`;
    res.json({ url });
  } catch (err) {
    console.error('images fetch-from-url error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process image' });
  }
});

/**
 * GET /api/images/search?q=...
 * Returns { url } for first image result (Unsplash). Requires UNSPLASH_ACCESS_KEY when set.
 */
router.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter q' });
  }
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey?.trim()) {
    return res.status(503).json({
      error: 'Image search unavailable. Set UNSPLASH_ACCESS_KEY in server .env to enable finding images by name.',
    });
  }
  const url = await searchImage(q);
  if (!url) {
    return res.status(503).json({
      error: 'No image found for this query. Try a different search or add an image another way.',
    });
  }
  res.json({ url });
});

/**
 * GET /api/images/youtube-thumbnail?id=...
 * Returns { url } for the best available YouTube thumbnail (maxresdefault or hqdefault).
 * No auth required; used by frontend to get URL before calling fetch-from-url.
 */
router.get('/youtube-thumbnail', async (req, res) => {
  const id = typeof req.query.id === 'string' ? req.query.id.trim() : '';
  if (!id) {
    return res.status(400).json({ error: 'Missing query parameter id' });
  }
  const base = `https://img.youtube.com/vi/${encodeURIComponent(id)}`;
  res.json({
    url: `${base}/maxresdefault.jpg`,
    fallbackUrl: `${base}/hqdefault.jpg`,
  });
});

export default router;
