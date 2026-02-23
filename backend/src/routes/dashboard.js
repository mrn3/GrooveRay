import { Router } from 'express';
import db from '../db/schema.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();
router.use(optionalAuth);

const PERIODS = ['day', 'week', 'month', 'year', 'all'];
const LIMIT = 8;

/** SQL fragment for played_at in period (use with params array). Returns [fragment, ...extraParams]. */
function playedAtCondition(period) {
  if (period === 'all') return ['1=1', []];
  if (period === 'day') return ['e.played_at >= CURDATE() AND e.played_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)', []];
  if (period === 'week') return ['e.played_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)', []];
  if (period === 'month') return ['e.played_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)', []];
  if (period === 'year') return ['e.played_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)', []];
  return ['1=1', []];
}

/** SQL fragment for created_at in period. */
function createdAtCondition(period) {
  if (period === 'all') return ['1=1', []];
  if (period === 'day') return ['s.created_at >= CURDATE() AND s.created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)', []];
  if (period === 'week') return ['s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)', []];
  if (period === 'month') return ['s.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)', []];
  if (period === 'year') return ['s.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)', []];
  return ['1=1', []];
}

router.get('/', async (req, res) => {
  const period = PERIODS.includes(req.query.period) ? req.query.period : 'week';

  const [playedCond, playedParams] = playedAtCondition(period);
  const [createdCondSongs, createdParamsSongs] = createdAtCondition(period);

  // --- Songs: popular & trending (most listens in period from song_listen_events) ---
  let songPopular = [];
  if (period === 'all') {
    const rows = await db.all(
      `SELECT s.id, s.title, s.artist, s.source, s.file_path, s.duration_seconds, s.thumbnail_url, s.created_at, u.username as uploader_name,
        COALESCE(SUM(l.listen_count), 0) as total_listen_count
       FROM songs s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN user_song_listens l ON l.song_id = s.id
       WHERE s.is_public = 1
       GROUP BY s.id
       HAVING total_listen_count > 0
       ORDER BY total_listen_count DESC
       LIMIT ?`,
      [LIMIT]
    );
    songPopular = rows;
  } else {
    const rows = await db.all(
      `SELECT s.id, s.title, s.artist, s.source, s.file_path, s.duration_seconds, s.thumbnail_url, s.created_at, u.username as uploader_name,
        COUNT(e.id) as period_listens
       FROM song_listen_events e
       JOIN songs s ON s.id = e.song_id
       JOIN users u ON u.id = s.user_id
       WHERE s.is_public = 1 AND ${playedCond}
       GROUP BY s.id
       ORDER BY period_listens DESC
       LIMIT ?`,
      [...playedParams, LIMIT]
    );
    songPopular = rows.map((r) => ({ ...r, total_listen_count: r.period_listens }));
  }

  // Songs: trending same as popular (most listens in period)
  const songTrending = [...songPopular];

  // --- Songs: highest rated (community avg; when period !== 'all', only songs with listens in period) ---
  let songHighestRated;
  if (period === 'all') {
    songHighestRated = await db.all(
      `SELECT s.id, s.title, s.artist, s.source, s.file_path, s.duration_seconds, s.thumbnail_url, s.created_at, u.username as uploader_name,
        (SELECT AVG(rating) FROM user_song_ratings WHERE song_id = s.id) as community_avg_rating,
        (SELECT COUNT(*) FROM user_song_ratings WHERE song_id = s.id) as community_rating_count
       FROM songs s
       JOIN users u ON u.id = s.user_id
       WHERE s.is_public = 1
       HAVING community_rating_count > 0
       ORDER BY community_avg_rating DESC, community_rating_count DESC
       LIMIT ?`,
      [LIMIT]
    );
  } else {
    const allowedSongIds = await db.all(
      `SELECT DISTINCT song_id FROM song_listen_events e WHERE ${playedCond}`,
      playedParams
    );
    const ids = allowedSongIds.map((r) => r.song_id);
    if (ids.length === 0) {
      songHighestRated = [];
    } else {
      const ph = ids.map(() => '?').join(',');
      songHighestRated = await db.all(
        `SELECT s.id, s.title, s.artist, s.source, s.file_path, s.duration_seconds, s.thumbnail_url, s.created_at, u.username as uploader_name,
          (SELECT AVG(rating) FROM user_song_ratings WHERE song_id = s.id) as community_avg_rating,
          (SELECT COUNT(*) FROM user_song_ratings WHERE song_id = s.id) as community_rating_count
         FROM songs s
         JOIN users u ON u.id = s.user_id
         WHERE s.is_public = 1 AND s.id IN (${ph})
         HAVING community_rating_count > 0
         ORDER BY community_avg_rating DESC, community_rating_count DESC
         LIMIT ?`,
        [...ids, LIMIT]
      );
    }
  }

  // --- Songs: new (created in period) ---
  const songNew = await db.all(
    `SELECT s.id, s.title, s.artist, s.source, s.file_path, s.duration_seconds, s.thumbnail_url, s.created_at, u.username as uploader_name
     FROM songs s
     JOIN users u ON u.id = s.user_id
     WHERE s.is_public = 1 AND ${createdCondSongs}
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [...createdParamsSongs, LIMIT]
  );

  // --- Playlists: popular / trending (listens in period from playlist_listen_events) ---
  const [playedCondPl, playedParamsPl] = playedAtCondition(period);
  let playlistPopular = [];
  if (period === 'all') {
    const rows = await db.all(
      `SELECT p.id, p.name, p.description, p.slug, p.thumbnail_url, p.created_at, u.username as owner_name,
        (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count,
        COALESCE((SELECT SUM(listen_count) FROM user_playlist_listens WHERE playlist_id = p.id), 0) as total_listen_count
       FROM playlists p
       JOIN users u ON u.id = p.user_id
       WHERE p.is_public = 1
       HAVING total_listen_count > 0
       ORDER BY total_listen_count DESC
       LIMIT ?`,
      [LIMIT]
    );
    playlistPopular = rows;
  } else {
    const rows = await db.all(
      `SELECT p.id, p.name, p.description, p.slug, p.thumbnail_url, p.created_at, u.username as owner_name,
        (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count,
        COUNT(e.id) as period_listens
       FROM playlist_listen_events e
       JOIN playlists p ON p.id = e.playlist_id
       JOIN users u ON u.id = p.user_id
       WHERE p.is_public = 1 AND ${playedCondPl}
       GROUP BY p.id
       ORDER BY period_listens DESC
       LIMIT ?`,
      [...playedParamsPl, LIMIT]
    );
    playlistPopular = rows.map((r) => ({ ...r, total_listen_count: r.period_listens }));
  }
  const playlistTrending = [...playlistPopular];

  // --- Playlists: highest rated ---
  const playlistIdsInPeriod =
    period === 'all'
      ? null
      : await db.all(
          `SELECT DISTINCT playlist_id FROM playlist_listen_events e WHERE ${playedCondPl}`,
          playedParamsPl
        );
  let playlistHighestRated;
  if (period === 'all' || !playlistIdsInPeriod || playlistIdsInPeriod.length === 0) {
    playlistHighestRated = await db.all(
      `SELECT p.id, p.name, p.description, p.slug, p.thumbnail_url, p.created_at, u.username as owner_name,
        (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count,
        (SELECT AVG(rating) FROM user_playlist_ratings WHERE playlist_id = p.id) as community_avg_rating,
        (SELECT COUNT(*) FROM user_playlist_ratings WHERE playlist_id = p.id) as community_rating_count
       FROM playlists p
       JOIN users u ON u.id = p.user_id
       WHERE p.is_public = 1
       HAVING community_rating_count > 0
       ORDER BY community_avg_rating DESC, community_rating_count DESC
       LIMIT ?`,
      [LIMIT]
    );
  } else {
    const ids = playlistIdsInPeriod.map((r) => r.playlist_id);
    const ph = ids.map(() => '?').join(',');
    playlistHighestRated = await db.all(
      `SELECT p.id, p.name, p.description, p.slug, p.thumbnail_url, p.created_at, u.username as owner_name,
        (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count,
        (SELECT AVG(rating) FROM user_playlist_ratings WHERE playlist_id = p.id) as community_avg_rating,
        (SELECT COUNT(*) FROM user_playlist_ratings WHERE playlist_id = p.id) as community_rating_count
       FROM playlists p
       JOIN users u ON u.id = p.user_id
       WHERE p.is_public = 1 AND p.id IN (${ph})
       ORDER BY community_avg_rating DESC, community_rating_count DESC
       LIMIT ?`,
      [...ids, LIMIT]
    );
  }

  const [createdCondPl, createdParamsPl] = createdAtCondition(period);
  const createdCondPlaylist = createdCondSongs.replace(/s\.created_at/g, 'p.created_at');
  const playlistNew = await db.all(
    `SELECT p.id, p.name, p.description, p.slug, p.thumbnail_url, p.created_at, u.username as owner_name,
      (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count
     FROM playlists p
     JOIN users u ON u.id = p.user_id
     WHERE p.is_public = 1 AND ${createdCondPlaylist}
     ORDER BY p.created_at DESC
     LIMIT ?`,
    [...createdParamsSongs, LIMIT]
  );

  // --- Stations: no listen events; popular/trending = by rating count or avg; highest rated; new ---
  const [createdCondSt, createdParamsSt] = createdAtCondition(period);
  const stationPopular = await db.all(
    `SELECT s.id, s.name, s.slug, s.description, s.image_url, s.created_at, u.username as owner_name,
       (SELECT COALESCE(AVG(rating), 0) FROM user_station_ratings WHERE station_id = s.id) as community_avg_rating,
       (SELECT COUNT(*) FROM user_station_ratings WHERE station_id = s.id) as community_rating_count
     FROM stations s
     JOIN users u ON u.id = s.owner_id
     ORDER BY community_rating_count DESC, community_avg_rating DESC
     LIMIT ?`,
    [LIMIT]
  );
  const stationTrending = [...stationPopular];
  const stationHighestRated = await db.all(
    `SELECT s.id, s.name, s.slug, s.description, s.image_url, s.created_at, u.username as owner_name,
       (SELECT COALESCE(AVG(rating), 0) FROM user_station_ratings WHERE station_id = s.id) as community_avg_rating,
       (SELECT COUNT(*) FROM user_station_ratings WHERE station_id = s.id) as community_rating_count
     FROM stations s
     JOIN users u ON u.id = s.owner_id
     HAVING community_rating_count > 0
     ORDER BY community_avg_rating DESC, community_rating_count DESC
     LIMIT ?`,
    [LIMIT]
  );
  const stationNew = await db.all(
    `SELECT s.id, s.name, s.slug, s.description, s.image_url, s.created_at, u.username as owner_name,
       (SELECT COALESCE(AVG(rating), 0) FROM user_station_ratings WHERE station_id = s.id) as community_avg_rating,
       (SELECT COUNT(*) FROM user_station_ratings WHERE station_id = s.id) as community_rating_count
     FROM stations s
     JOIN users u ON u.id = s.owner_id
     WHERE ${createdCondSt}
     ORDER BY s.created_at DESC
     LIMIT ?`,
    [...createdParamsSt, LIMIT]
  );

  res.json({
    period,
    songs: {
      popular: songPopular,
      trending: songTrending,
      highestRated: songHighestRated,
      new: songNew,
    },
    playlists: {
      popular: playlistPopular,
      trending: playlistTrending,
      highestRated: playlistHighestRated,
      new: playlistNew,
    },
    stations: {
      popular: stationPopular,
      trending: stationTrending,
      highestRated: stationHighestRated,
      new: stationNew,
    },
  });
});

export default router;
