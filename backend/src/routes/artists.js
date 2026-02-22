import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import db from '../db/schema.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { attachCommunityRatings, attachUserStats } from './songs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, '../../uploads/artists');
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, imagesDir),
    filename: (_, file, cb) => {
      const ext = (file.originalname && path.extname(file.originalname).toLowerCase()) || '.jpg';
      const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
      cb(null, `${uuid()}${safeExt}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = file.mimetype && /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    cb(null, !!ok);
  },
});

const router = Router();

function normalizeArtistName(name) {
  if (name == null || typeof name !== 'string') return '';
  return name.trim().slice(0, 255);
}

function parseListQuery(query) {
  const name = typeof query.name === 'string' ? query.name.trim() : '';
  const sortBy = ['name', 'song_count', 'total_listen_count', 'community_avg_rating', 'listen_count', 'rating'].includes(query.sortBy)
    ? query.sortBy
    : 'name';
  const sortOrder = query.sortOrder === 'asc' || query.sortOrder === 'desc' ? query.sortOrder : 'asc';
  const page = query.page != null ? Math.max(1, parseInt(query.page, 10)) : 1;
  const limitRaw = query.limit != null ? parseInt(query.limit, 10) : 20;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.max(1, limitRaw)) : 20;
  return { name: name || null, sortBy, sortOrder, page: Number.isFinite(page) ? page : 1, limit };
}

/** Get distinct artists from a list of song IDs (or from public songs if songIds null). Returns rows with artist (trimmed). */
async function getDistinctArtistsFromSongs(songIds = null) {
  if (songIds && songIds.length === 0) return [];
  let rows;
  if (songIds) {
    const placeholders = songIds.map(() => '?').join(',');
    rows = await db.all(
      `SELECT TRIM(s.artist) as artist, COUNT(*) as song_count
       FROM songs s
       WHERE s.id IN (${placeholders}) AND s.artist IS NOT NULL AND TRIM(s.artist) != ''
       GROUP BY TRIM(s.artist)`,
      songIds
    );
  } else {
    rows = await db.all(
      `SELECT TRIM(s.artist) as artist, COUNT(*) as song_count
       FROM songs s
       WHERE s.is_public = 1 AND s.artist IS NOT NULL AND TRIM(s.artist) != ''
       GROUP BY TRIM(s.artist)`
    );
  }
  return rows;
}

/** Attach total_listen_count and community_avg_rating per artist (by summing/averaging over songs). */
async function attachArtistAggregates(artistRows, userId) {
  if (!artistRows?.length) return artistRows;
  const names = artistRows.map((r) => r.artist);
  const namePlaceholders = names.map(() => '?').join(',');
  const songRows = await db.all(
    `SELECT s.id, TRIM(s.artist) as artist FROM songs s
     WHERE TRIM(s.artist) IN (${namePlaceholders}) AND (s.is_public = 1 ${userId ? 'OR s.user_id = ?' : ''})`,
    userId ? [...names, userId] : names
  );
  const songIds = songRows.map((r) => r.id);
  if (songIds.length === 0) return artistRows.map((r) => ({ ...r, total_listen_count: 0, community_avg_rating: null, community_rating_count: 0 }));

  const totals = await db.all(
    `SELECT song_id, SUM(listen_count) as total_listen_count
     FROM user_song_listens WHERE song_id IN (${songIds.map(() => '?').join(',')})
     GROUP BY song_id`,
    songIds
  );
  const totalMap = Object.fromEntries(totals.map((r) => [r.song_id, r.total_listen_count]));
  const ratingRows = await db.all(
    `SELECT song_id, AVG(rating) as avg_rating, COUNT(*) as rating_count
     FROM user_song_ratings WHERE song_id IN (${songIds.map(() => '?').join(',')})
     GROUP BY song_id`,
    songIds
  );
  const ratingMap = Object.fromEntries(ratingRows.map((r) => [r.song_id, { avg_rating: r.avg_rating, rating_count: r.rating_count }]));

  const artistToSongs = {};
  songRows.forEach((r) => {
    if (!artistToSongs[r.artist]) artistToSongs[r.artist] = [];
    artistToSongs[r.artist].push(r.id);
  });

  let withAgg = artistRows.map((r) => {
    const ids = artistToSongs[r.artist] || [];
    const total_listen_count = ids.reduce((sum, id) => sum + (totalMap[id] ?? 0), 0);
    const ratings = ids.map((id) => ratingMap[id]).filter(Boolean);
    const community_rating_count = ratings.reduce((s, x) => s + (x.rating_count ?? 0), 0);
    const community_avg_rating =
      ratings.length > 0
        ? ratings.reduce((s, x) => s + (x.avg_rating ?? 0) * (x.rating_count ?? 0), 0) / community_rating_count
        : null;
    return { ...r, total_listen_count, community_avg_rating, community_rating_count };
  });

  if (userId) {
    const myListens = await db.all(
      `SELECT song_id, listen_count FROM user_song_listens WHERE user_id = ? AND song_id IN (${songIds.map(() => '?').join(',')})`,
      [userId, ...songIds]
    );
    const listenMap = Object.fromEntries(myListens.map((r) => [r.song_id, r.listen_count]));
    const namePlaceholdersForRatings = names.map(() => '?').join(',');
    const myArtistRatings = await db.all(
      `SELECT artist_name, rating FROM user_artist_ratings WHERE user_id = ? AND artist_name IN (${namePlaceholdersForRatings})`,
      [userId, ...names]
    );
    const artistRatingMap = Object.fromEntries(myArtistRatings.map((r) => [r.artist_name, r.rating]));
    withAgg = withAgg.map((r) => {
      const ids = artistToSongs[r.artist] || [];
      const listen_count = ids.reduce((sum, id) => sum + (listenMap[id] ?? 0), 0);
      const rating = artistRatingMap[r.artist] ?? null;
      return { ...r, listen_count, rating };
    });
  } else {
    withAgg = withAgg.map((r) => ({ ...r, listen_count: 0, rating: null }));
  }

  return withAgg;
}

/** Attach image_url from artist_images for each artist in the list. */
async function attachArtistImages(artistRows) {
  if (!artistRows?.length) return artistRows;
  const names = artistRows.map((r) => r.artist);
  const placeholders = names.map(() => '?').join(',');
  const rows = await db.all(
    `SELECT artist_name, image_url FROM artist_images WHERE artist_name IN (${placeholders})`,
    names
  );
  const imageMap = Object.fromEntries(rows.map((r) => [r.artist_name, r.image_url]));
  return artistRows.map((r) => ({ ...r, image_url: imageMap[r.artist] ?? null }));
}

// GET /api/artists — list all artists (public), paginated, with filters
router.get('/', optionalAuth, async (req, res) => {
  const opts = parseListQuery(req.query);
  let artistRows = await getDistinctArtistsFromSongs(null);
  if (opts.name) {
    const lower = opts.name.toLowerCase();
    artistRows = artistRows.filter((r) => (r.artist || '').toLowerCase().includes(lower));
  }
  let withAgg = await attachArtistAggregates(artistRows, req.userId);
  if (opts.sortBy) {
    const key = opts.sortBy;
    const order = opts.sortOrder === 'asc' ? 1 : -1;
    withAgg = [...withAgg].sort((a, b) => {
      let va = a[key];
      let vb = b[key];
      if (key === 'name') {
        va = (va ?? '').toLowerCase();
        vb = (vb ?? '').toLowerCase();
        return order * (va < vb ? -1 : va > vb ? 1 : 0);
      }
      va = Number(va) ?? 0;
      vb = Number(vb) ?? 0;
      return order * (va - vb);
    });
  }
  const total = withAgg.length;
  const start = (opts.page - 1) * opts.limit;
  let items = withAgg.slice(start, start + opts.limit);
  items = await attachArtistImages(items);
  res.json({ items, total });
});

// GET /api/artists/mine — list artists from my songs (contributed + favorited)
router.get('/mine', authMiddleware, async (req, res) => {
  const userId = req.userId;
  const opts = parseListQuery(req.query);
  const contributionRows = await db.all('SELECT id FROM songs WHERE user_id = ?', [userId]);
  const ratedRows = await db.all('SELECT song_id FROM user_song_ratings WHERE user_id = ? AND rating > 0', [userId]);
  const listenedRows = await db.all('SELECT song_id FROM user_song_listens WHERE user_id = ? AND listen_count > 0', [userId]);
  const favoriteIds = [...new Set([...ratedRows.map((r) => r.song_id), ...listenedRows.map((r) => r.song_id)])];
  const allIds = [...new Set([...contributionRows.map((r) => r.id), ...favoriteIds])];
  if (allIds.length === 0) return res.json({ items: [], total: 0 });

  let artistRows = await getDistinctArtistsFromSongs(allIds);
  if (opts.name) {
    const lower = opts.name.toLowerCase();
    artistRows = artistRows.filter((r) => (r.artist || '').toLowerCase().includes(lower));
  }
  let withAgg = await attachArtistAggregates(artistRows, userId);
  if (opts.sortBy) {
    const key = opts.sortBy;
    const order = opts.sortOrder === 'asc' ? 1 : -1;
    withAgg = [...withAgg].sort((a, b) => {
      let va = a[key];
      let vb = b[key];
      if (key === 'name') {
        va = (va ?? '').toLowerCase();
        vb = (vb ?? '').toLowerCase();
        return order * (va < vb ? -1 : va > vb ? 1 : 0);
      }
      va = Number(va) ?? 0;
      vb = Number(vb) ?? 0;
      return order * (va - vb);
    });
  }
  const total = withAgg.length;
  const start = (opts.page - 1) * opts.limit;
  let items = withAgg.slice(start, start + opts.limit);
  items = await attachArtistImages(items);
  res.json({ items, total });
});

// GET /api/artists/:name — artist detail + paginated songs
router.get('/:name', optionalAuth, async (req, res) => {
  const artistName = normalizeArtistName(decodeURIComponent(req.params.name || ''));
  if (!artistName) return res.status(400).json({ error: 'Invalid artist name' });

  const songList = await db.all(
    `SELECT s.*, u.username as uploader_name
     FROM songs s
     JOIN users u ON u.id = s.user_id
     WHERE TRIM(s.artist) = ? AND (s.is_public = 1 ${req.userId ? 'OR s.user_id = ?' : ''})
     ORDER BY s.created_at DESC`,
    req.userId ? [artistName, req.userId] : [artistName]
  );
  if (songList.length === 0) return res.status(404).json({ error: 'Artist not found' });

  const songIds = songList.map((s) => s.id);
  const placeholders = songIds.map(() => '?').join(',');
  const totals = await db.all(
    `SELECT song_id, SUM(listen_count) as total_listen_count
     FROM user_song_listens WHERE song_id IN (${placeholders}) GROUP BY song_id`,
    songIds
  );
  const totalMap = Object.fromEntries(totals.map((r) => [r.song_id, r.total_listen_count]));
  songList.forEach((s) => {
    s.total_listen_count = totalMap[s.id] ?? 0;
  });
  const withCommunity = await attachCommunityRatings(songList);
  const withStats = await attachUserStats(withCommunity, req.userId);

  const total_listen_count = withStats.reduce((sum, s) => sum + (s.total_listen_count ?? 0), 0);
  const community_ratings = withStats.filter((s) => (s.community_rating_count ?? 0) > 0);
  const community_rating_count = community_ratings.reduce((s, x) => s + (x.community_rating_count ?? 0), 0);
  const community_avg_rating =
    community_rating_count > 0
      ? community_ratings.reduce((s, x) => s + (x.community_avg_rating ?? 0) * (x.community_rating_count ?? 0), 0) / community_rating_count
      : null;
  const my_listen_count = req.userId ? withStats.reduce((sum, s) => sum + (s.listen_count ?? 0), 0) : 0;

  let my_rating = null;
  let can_edit = false;
  if (req.userId) {
    const row = await db.get('SELECT rating FROM user_artist_ratings WHERE user_id = ? AND artist_name = ?', [req.userId, artistName]);
    my_rating = row?.rating ?? null;
    const contributed = await db.get('SELECT 1 FROM songs WHERE user_id = ? AND TRIM(artist) = ? LIMIT 1', [req.userId, artistName]);
    can_edit = !!contributed;
  }

  const imageRow = await db.get('SELECT image_url FROM artist_images WHERE artist_name = ?', [artistName]);
  const image_url = imageRow?.image_url ?? null;

  const page = req.query.page != null ? Math.max(1, parseInt(req.query.page, 10)) : 1;
  const limitRaw = req.query.limit != null ? parseInt(req.query.limit, 10) : 20;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.max(1, limitRaw)) : 20;
  const start = (page - 1) * limit;
  const songsItems = withStats.slice(start, start + limit);

  res.json({
    artist: artistName,
    image_url,
    can_edit,
    song_count: withStats.length,
    total_listen_count,
    community_avg_rating,
    community_rating_count,
    my_listen_count,
    my_rating,
    songs: { items: songsItems, total: withStats.length },
  });
});

// PATCH /api/artists/:name — update artist name (rename my songs) and/or image_url
router.patch('/:name', authMiddleware, async (req, res) => {
  const currentName = normalizeArtistName(decodeURIComponent(req.params.name || ''));
  if (!currentName) return res.status(400).json({ error: 'Invalid artist name' });

  const contributed = await db.get('SELECT 1 FROM songs WHERE user_id = ? AND TRIM(artist) = ? LIMIT 1', [req.userId, currentName]);
  if (!contributed) return res.status(403).json({ error: 'You can only edit artists you have contributed songs to' });

  const { name: newNameRaw, image_url: newImageUrl } = req.body || {};
  const newName = typeof newNameRaw === 'string' ? normalizeArtistName(newNameRaw) : null;
  const imageValue = newImageUrl === null || (typeof newImageUrl === 'string' && newImageUrl.trim() !== '') ? newImageUrl : undefined;

  if (newName != null && newName !== currentName) {
    await db.run('UPDATE songs SET artist = ? WHERE user_id = ? AND TRIM(artist) = ?', [newName, req.userId, currentName]);
    await db.run('UPDATE user_artist_ratings SET artist_name = ? WHERE user_id = ? AND artist_name = ?', [newName, req.userId, currentName]);
    const imgRow = await db.get('SELECT 1 FROM artist_images WHERE artist_name = ?', [currentName]);
    if (imgRow) {
      await db.run('UPDATE artist_images SET artist_name = ? WHERE artist_name = ?', [newName, currentName]);
    }
  }

  if (imageValue !== undefined) {
    const existing = await db.get('SELECT 1 FROM artist_images WHERE artist_name = ?', [newName ?? currentName]);
    if (existing) {
      await db.run('UPDATE artist_images SET image_url = ? WHERE artist_name = ?', [newImageUrl, newName ?? currentName]);
    } else {
      await db.run('INSERT INTO artist_images (artist_name, image_url) VALUES (?, ?)', [newName ?? currentName, newImageUrl]);
    }
  }

  const finalName = newName ?? currentName;
  const imageRow = await db.get('SELECT image_url FROM artist_images WHERE artist_name = ?', [finalName]);
  res.json({ artist: finalName, image_url: imageRow?.image_url ?? null });
});

// POST /api/artists/:name/image — upload artist image (user must have contributed a song with this artist)
router.post('/:name/image', authMiddleware, imageUpload.single('image'), async (req, res) => {
  const artistName = normalizeArtistName(decodeURIComponent(req.params.name || ''));
  if (!artistName) return res.status(400).json({ error: 'Invalid artist name' });
  if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });

  const contributed = await db.get('SELECT 1 FROM songs WHERE user_id = ? AND TRIM(artist) = ? LIMIT 1', [req.userId, artistName]);
  if (!contributed) return res.status(403).json({ error: 'You can only edit artists you have contributed songs to' });

  const imageUrl = `/api/uploads/artists/${req.file.filename}`;
  const existing = await db.get('SELECT 1 FROM artist_images WHERE artist_name = ?', [artistName]);
  if (existing) {
    await db.run('UPDATE artist_images SET image_url = ? WHERE artist_name = ?', [imageUrl, artistName]);
  } else {
    await db.run('INSERT INTO artist_images (artist_name, image_url) VALUES (?, ?)', [artistName, imageUrl]);
  }
  res.json({ artist: artistName, image_url: imageUrl });
});

// PATCH /api/artists/:name/rating — set my rating for this artist
router.patch('/:name/rating', authMiddleware, async (req, res) => {
  const artistName = normalizeArtistName(decodeURIComponent(req.params.name || ''));
  if (!artistName) return res.status(400).json({ error: 'Invalid artist name' });
  const rating = req.body?.rating != null ? parseInt(req.body.rating, 10) : null;
  if (rating != null && (rating < 1 || rating > 5)) return res.status(400).json({ error: 'Rating must be 1–5' });

  const songExists = await db.get(
    'SELECT 1 FROM songs WHERE TRIM(artist) = ? AND (is_public = 1 OR user_id = ?) LIMIT 1',
    [artistName, req.userId]
  );
  if (!songExists) return res.status(404).json({ error: 'Artist not found' });

  if (rating == null) {
    await db.run('DELETE FROM user_artist_ratings WHERE user_id = ? AND artist_name = ?', [req.userId, artistName]);
    return res.status(204).send();
  }
  await db.run(
    `INSERT INTO user_artist_ratings (user_id, artist_name, rating) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = ?, updated_at = CURRENT_TIMESTAMP`,
    [req.userId, artistName, rating, rating]
  );
  res.json({ rating });
});

export default router;
