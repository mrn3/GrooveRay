import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../db/schema.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';

const router = Router();

function slugify(s) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function getPlaylistWithMeta(playlistId, userId) {
  const p = await db.get(
    `SELECT p.*, u.username as owner_name FROM playlists p JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
    [playlistId]
  );
  if (!p) return null;

  const [tracks] = await Promise.all([
    db.all(
      `SELECT pt.playlist_id, pt.song_id, pt.position, pt.added_at,
        s.title, s.artist, s.source, s.duration_seconds, s.thumbnail_url
       FROM playlist_tracks pt
       JOIN songs s ON s.id = pt.song_id
       WHERE pt.playlist_id = ?
       ORDER BY pt.position ASC, pt.added_at ASC`,
      [playlistId]
    ),
  ]);
  p.tracks = tracks;

  const ratingRows = await db.all(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count FROM user_playlist_ratings WHERE playlist_id = ?`,
    [playlistId]
  );
  p.community_avg_rating = ratingRows[0]?.avg_rating ?? null;
  p.community_rating_count = ratingRows[0]?.rating_count ?? 0;

  const totalListens = await db.get(
    `SELECT COALESCE(SUM(listen_count), 0) as total_listen_count FROM user_playlist_listens WHERE playlist_id = ?`,
    [playlistId]
  );
  p.total_listen_count = totalListens?.total_listen_count ?? 0;

  if (userId) {
    const myRating = await db.get(
      'SELECT rating FROM user_playlist_ratings WHERE user_id = ? AND playlist_id = ?',
      [userId, playlistId]
    );
    const myListens = await db.get(
      'SELECT listen_count FROM user_playlist_listens WHERE user_id = ? AND playlist_id = ?',
      [userId, playlistId]
    );
    p.rating = myRating?.rating ?? null;
    p.listen_count = myListens?.listen_count ?? 0;
  }

  return p;
}

function canAccess(playlist, userId) {
  if (playlist.is_public) return true;
  return userId && playlist.user_id === userId;
}

router.post('/', authMiddleware, async (req, res) => {
  const { name, description, is_public } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Playlist name required' });
  const id = uuid();
  await db.run(
    'INSERT INTO playlists (id, user_id, name, description, is_public) VALUES (?, ?, ?, ?, ?)',
    [id, req.userId, name.trim(), (description && String(description).trim()) || null, is_public ? 1 : 0]
  );
  const playlist = await db.get(
    `SELECT p.*, u.username as owner_name FROM playlists p JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
    [id]
  );
  res.status(201).json(playlist);
});

router.get('/', authMiddleware, async (req, res) => {
  const list = await db.all(
    `SELECT p.*, u.username as owner_name,
      (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count,
      (SELECT COALESCE(AVG(rating), 0) FROM user_playlist_ratings WHERE playlist_id = p.id) as community_avg_rating,
      (SELECT COUNT(*) FROM user_playlist_ratings WHERE playlist_id = p.id) as community_rating_count,
      (SELECT COALESCE(SUM(listen_count), 0) FROM user_playlist_listens WHERE playlist_id = p.id) as total_listen_count
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC`,
    [req.userId]
  );
  const withMyStats = await Promise.all(
    list.map(async (row) => {
      const myRating = await db.get(
        'SELECT rating FROM user_playlist_ratings WHERE user_id = ? AND playlist_id = ?',
        [req.userId, row.id]
      );
      const myListens = await db.get(
        'SELECT listen_count FROM user_playlist_listens WHERE user_id = ? AND playlist_id = ?',
        [req.userId, row.id]
      );
      return {
        ...row,
        rating: myRating?.rating ?? null,
        listen_count: myListens?.listen_count ?? 0,
      };
    })
  );
  res.json(withMyStats);
});

router.get('/public', optionalAuth, async (req, res) => {
  const list = await db.all(
    `SELECT p.*, u.username as owner_name,
      (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count,
      (SELECT COALESCE(AVG(rating), 0) FROM user_playlist_ratings WHERE playlist_id = p.id) as community_avg_rating,
      (SELECT COUNT(*) FROM user_playlist_ratings WHERE playlist_id = p.id) as community_rating_count,
      (SELECT COALESCE(SUM(listen_count), 0) FROM user_playlist_listens WHERE playlist_id = p.id) as total_listen_count
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     WHERE p.is_public = 1
     ORDER BY p.created_at DESC`
  );
  if (!req.userId) return res.json(list);
  const withMyStats = await Promise.all(
    list.map(async (row) => {
      const myRating = await db.get(
        'SELECT rating FROM user_playlist_ratings WHERE user_id = ? AND playlist_id = ?',
        [req.userId, row.id]
      );
      const myListens = await db.get(
        'SELECT listen_count FROM user_playlist_listens WHERE user_id = ? AND playlist_id = ?',
        [req.userId, row.id]
      );
      return {
        ...row,
        rating: myRating?.rating ?? null,
        listen_count: myListens?.listen_count ?? 0,
      };
    })
  );
  res.json(withMyStats);
});

router.get('/by-slug/:slug', optionalAuth, async (req, res) => {
  const p = await db.get(
    `SELECT p.*, u.username as owner_name FROM playlists p JOIN users u ON u.id = p.user_id WHERE p.slug = ?`,
    [req.params.slug]
  );
  if (!p) return res.status(404).json({ error: 'Playlist not found' });
  const full = await getPlaylistWithMeta(p.id, req.userId);
  if (!canAccess(full, req.userId)) return res.status(404).json({ error: 'Playlist not found' });
  res.json(full);
});

router.get('/:id', optionalAuth, async (req, res) => {
  const p = await db.get(
    `SELECT p.*, u.username as owner_name FROM playlists p JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
    [req.params.id]
  );
  if (!p) return res.status(404).json({ error: 'Playlist not found' });
  if (!canAccess(p, req.userId)) return res.status(404).json({ error: 'Playlist not found' });
  const full = await getPlaylistWithMeta(p.id, req.userId);
  res.json(full);
});

router.patch('/:id', authMiddleware, async (req, res) => {
  const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.userId) return res.status(403).json({ error: 'Only the owner can edit this playlist' });
  const { name, description, is_public, slug } = req.body || {};
  const updates = [];
  const params = [];
  if (typeof name === 'string' && name.trim()) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (typeof description !== 'undefined') {
    updates.push('description = ?');
    params.push(description === null || description === '' ? null : String(description).trim());
  }
  if (typeof is_public === 'boolean') {
    updates.push('is_public = ?');
    params.push(is_public ? 1 : 0);
  }
  if (typeof slug === 'string') {
    const s = slug.trim() || null;
    if (s) {
      const existing = await db.get('SELECT id FROM playlists WHERE slug = ? AND id != ?', [s, req.params.id]);
      if (existing) return res.status(409).json({ error: 'Share link already taken' });
      updates.push('slug = ?');
      params.push(s);
    } else {
      updates.push('slug = NULL');
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  params.push(req.params.id);
  await db.run(`UPDATE playlists SET ${updates.join(', ')} WHERE id = ?`, params);
  const updated = await getPlaylistWithMeta(req.params.id, req.userId);
  res.json(updated);
});

router.post('/:id/share', authMiddleware, async (req, res) => {
  const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.userId) return res.status(403).json({ error: 'Only the owner can share this playlist' });
  let slug = playlist.slug;
  if (!slug) {
    slug = slugify(playlist.name);
    const existing = await db.get('SELECT id FROM playlists WHERE slug = ?', [slug]);
    if (existing) slug = `${slug}-${playlist.id.slice(0, 8)}`;
    await db.run('UPDATE playlists SET slug = ? WHERE id = ?', [slug, req.params.id]);
  }
  const updated = await db.get(
    `SELECT p.*, u.username as owner_name FROM playlists p JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
    [req.params.id]
  );
  res.json(updated);
});

router.delete('/:id', authMiddleware, async (req, res) => {
  const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.userId) return res.status(403).json({ error: 'Only the owner can delete this playlist' });
  await db.run('DELETE FROM user_playlist_ratings WHERE playlist_id = ?', [req.params.id]);
  await db.run('DELETE FROM user_playlist_listens WHERE playlist_id = ?', [req.params.id]);
  await db.run('DELETE FROM playlist_tracks WHERE playlist_id = ?', [req.params.id]);
  await db.run('DELETE FROM playlists WHERE id = ?', [req.params.id]);
  res.status(204).send();
});

router.get('/:id/tracks', optionalAuth, async (req, res) => {
  const p = await db.get('SELECT id, user_id, is_public FROM playlists WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Playlist not found' });
  if (!canAccess(p, req.userId)) return res.status(404).json({ error: 'Playlist not found' });
  const tracks = await db.all(
    `SELECT pt.playlist_id, pt.song_id, pt.position, pt.added_at,
      s.id as song_id, s.title, s.artist, s.source, s.duration_seconds, s.thumbnail_url, s.file_path
     FROM playlist_tracks pt
     JOIN songs s ON s.id = pt.song_id
     WHERE pt.playlist_id = ?
     ORDER BY pt.position ASC, pt.added_at ASC`,
    [req.params.id]
  );
  res.json(tracks);
});

router.post('/:id/tracks', authMiddleware, async (req, res) => {
  const { songId } = req.body || {};
  if (!songId) return res.status(400).json({ error: 'songId required' });
  const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.userId) return res.status(403).json({ error: 'Only the owner can add tracks' });
  const song = await db.get('SELECT id FROM songs WHERE id = ?', [songId]);
  if (!song) return res.status(404).json({ error: 'Song not found' });
  const existing = await db.get('SELECT 1 FROM playlist_tracks WHERE playlist_id = ? AND song_id = ?', [
    req.params.id,
    songId,
  ]);
  if (existing) return res.status(409).json({ error: 'Song already in playlist' });
  const maxRow = await db.get(
    'SELECT COALESCE(MAX(position), 0) as m FROM playlist_tracks WHERE playlist_id = ?',
    [req.params.id]
  );
  const position = (maxRow?.m ?? 0) + 1;
  await db.run('INSERT INTO playlist_tracks (playlist_id, song_id, position) VALUES (?, ?, ?)', [
    req.params.id,
    songId,
    position,
  ]);
  const track = await db.get(
    `SELECT pt.*, s.title, s.artist, s.source, s.duration_seconds, s.thumbnail_url
     FROM playlist_tracks pt JOIN songs s ON s.id = pt.song_id
     WHERE pt.playlist_id = ? AND pt.song_id = ?`,
    [req.params.id, songId]
  );
  res.status(201).json(track);
});

router.delete('/:id/tracks/:songId', authMiddleware, async (req, res) => {
  const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.userId) return res.status(403).json({ error: 'Only the owner can remove tracks' });
  const r = await db.run('DELETE FROM playlist_tracks WHERE playlist_id = ? AND song_id = ?', [
    req.params.id,
    req.params.songId,
  ]);
  if (r.affectedRows === 0) return res.status(404).json({ error: 'Track not in playlist' });
  res.status(204).send();
});

router.patch('/:id/tracks/reorder', authMiddleware, async (req, res) => {
  const { songIds } = req.body || {};
  if (!Array.isArray(songIds)) return res.status(400).json({ error: 'songIds array required' });
  const playlist = await db.get('SELECT * FROM playlists WHERE id = ?', [req.params.id]);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
  if (playlist.user_id !== req.userId) return res.status(403).json({ error: 'Only the owner can reorder tracks' });
  for (let i = 0; i < songIds.length; i++) {
    await db.run('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND song_id = ?', [
      i,
      req.params.id,
      songIds[i],
    ]);
  }
  const tracks = await db.all(
    `SELECT pt.*, s.title, s.artist, s.source, s.duration_seconds, s.thumbnail_url
     FROM playlist_tracks pt JOIN songs s ON s.id = pt.song_id
     WHERE pt.playlist_id = ? ORDER BY pt.position ASC`,
    [req.params.id]
  );
  res.json(tracks);
});

router.patch('/:id/rating', authMiddleware, async (req, res) => {
  const playlist = await db.get('SELECT id FROM playlists WHERE id = ?', [req.params.id]);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
  const p = await db.get('SELECT id, is_public FROM playlists WHERE id = ?', [req.params.id]);
  if (!canAccess(p, req.userId)) return res.status(404).json({ error: 'Playlist not found' });
  const { rating } = req.body || {};
  const r = typeof rating === 'number' ? Math.max(0, Math.min(5, Math.round(rating))) : null;
  if (r === null) return res.status(400).json({ error: 'Provide rating (1-5)' });
  await db.run(
    `INSERT INTO user_playlist_ratings (user_id, playlist_id, rating) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE rating = VALUES(rating)`,
    [req.userId, req.params.id, r]
  );
  res.status(204).send();
});

router.get('/:id/ratings', optionalAuth, async (req, res) => {
  const p = await db.get('SELECT id, user_id, is_public FROM playlists WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Playlist not found' });
  if (!canAccess(p, req.userId)) return res.status(404).json({ error: 'Playlist not found' });
  const rows = await db.all(
    `SELECT r.user_id, r.rating, r.updated_at, u.username
     FROM user_playlist_ratings r
     JOIN users u ON u.id = r.user_id
     WHERE r.playlist_id = ?
     ORDER BY r.updated_at DESC`,
    [req.params.id]
  );
  const summary = await db.get(
    `SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count FROM user_playlist_ratings WHERE playlist_id = ?`,
    [req.params.id]
  );
  res.json({
    avg_rating: summary?.avg_rating ?? null,
    rating_count: summary?.rating_count ?? 0,
    ratings: rows,
  });
});

router.post('/:id/played', authMiddleware, async (req, res) => {
  const playlist = await db.get('SELECT id FROM playlists WHERE id = ?', [req.params.id]);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
  const p = await db.get('SELECT id, is_public FROM playlists WHERE id = ?', [req.params.id]);
  if (!canAccess(p, req.userId)) return res.status(404).json({ error: 'Playlist not found' });
  await db.run(
    `INSERT INTO user_playlist_listens (user_id, playlist_id, listen_count)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE listen_count = listen_count + 1`,
    [req.userId, req.params.id]
  );
  res.status(204).send();
});

router.get('/:id/listens', optionalAuth, async (req, res) => {
  const p = await db.get('SELECT id, user_id, is_public FROM playlists WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Playlist not found' });
  if (!canAccess(p, req.userId)) return res.status(404).json({ error: 'Playlist not found' });
  const total = await db.get(
    'SELECT COALESCE(SUM(listen_count), 0) as total FROM user_playlist_listens WHERE playlist_id = ?',
    [req.params.id]
  );
  const byUser = await db.all(
    `SELECT l.user_id, l.listen_count, u.username
     FROM user_playlist_listens l
     JOIN users u ON u.id = l.user_id
     WHERE l.playlist_id = ?
     ORDER BY l.listen_count DESC`,
    [req.params.id]
  );
  res.json({
    total_listen_count: total?.total ?? 0,
    by_user: byUser,
  });
});

export default router;
