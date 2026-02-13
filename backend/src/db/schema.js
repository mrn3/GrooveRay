import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'grooveray',
  password: process.env.MYSQL_PASSWORD || 'grooveray',
  database: process.env.MYSQL_DATABASE || 'grooveray',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/** Run a query and return first row or null (like SQLite .get()) */
export async function get(sql, params = []) {
  const [rows] = await pool.execute(sql, Array.isArray(params) ? params : [params]);
  return rows[0] ?? null;
}

/** Run a query and return all rows (like SQLite .all()) */
export async function all(sql, params = []) {
  const [rows] = await pool.execute(sql, Array.isArray(params) ? params : [params]);
  return rows;
}

/** Run INSERT/UPDATE/DELETE; returns { affectedRows, insertId } (like SQLite .run() with .changes) */
export async function run(sql, params = []) {
  const [result] = await pool.execute(sql, Array.isArray(params) ? params : [params]);
  return {
    affectedRows: result.affectedRows ?? 0,
    insertId: result.insertId,
    changes: result.affectedRows ?? 0,
  };
}

/** Run multiple statements (e.g. DDL). No prepared params. */
export async function exec(sql) {
  const conn = await pool.getConnection();
  try {
    await conn.query(sql);
  } finally {
    conn.release();
  }
}

// --- Schema (MariaDB/MySQL) ---
const DDL = `
  CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NULL,
    google_id VARCHAR(255) UNIQUE NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS songs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(500) NOT NULL,
    artist VARCHAR(500),
    source VARCHAR(50) NOT NULL,
    file_path VARCHAR(500),
    duration_seconds INT,
    is_public TINYINT NOT NULL DEFAULT 1,
    thumbnail_url TEXT,
    youtube_id VARCHAR(20) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY (user_id, youtube_id)
  );

  CREATE TABLE IF NOT EXISTS stations (
    id VARCHAR(36) PRIMARY KEY,
    owner_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS station_queue (
    id VARCHAR(36) PRIMARY KEY,
    station_id VARCHAR(36) NOT NULL,
    song_id VARCHAR(36) NOT NULL,
    votes INT DEFAULT 0,
    played_at DATETIME NULL,
    position INT DEFAULT 0,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (song_id) REFERENCES songs(id)
  );

  CREATE TABLE IF NOT EXISTS station_votes (
    station_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    queue_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (station_id, user_id, queue_id),
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (queue_id) REFERENCES station_queue(id)
  );

  CREATE TABLE IF NOT EXISTS youtube_jobs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    url TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    song_id VARCHAR(36),
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (song_id) REFERENCES songs(id)
  );

  CREATE TABLE IF NOT EXISTS user_song_favorites (
    user_id VARCHAR(36) NOT NULL,
    song_id VARCHAR(36) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, song_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (song_id) REFERENCES songs(id)
  );

  CREATE TABLE IF NOT EXISTS user_song_ratings (
    user_id VARCHAR(36) NOT NULL,
    song_id VARCHAR(36) NOT NULL,
    rating INT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, song_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (song_id) REFERENCES songs(id)
  );

  CREATE TABLE IF NOT EXISTS user_song_listens (
    user_id VARCHAR(36) NOT NULL,
    song_id VARCHAR(36) NOT NULL,
    listen_count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, song_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (song_id) REFERENCES songs(id)
  );

  CREATE TABLE IF NOT EXISTS station_now_playing (
    station_id VARCHAR(36) PRIMARY KEY,
    queue_id VARCHAR(36) NOT NULL,
    started_at DATETIME NOT NULL,
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (queue_id) REFERENCES station_queue(id)
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_public TINYINT NOT NULL DEFAULT 0,
    slug VARCHAR(255) UNIQUE NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id VARCHAR(36) NOT NULL,
    song_id VARCHAR(36) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, song_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id)
  );

  CREATE TABLE IF NOT EXISTS user_playlist_ratings (
    user_id VARCHAR(36) NOT NULL,
    playlist_id VARCHAR(36) NOT NULL,
    rating INT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, playlist_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id)
  );

  CREATE TABLE IF NOT EXISTS user_playlist_listens (
    user_id VARCHAR(36) NOT NULL,
    playlist_id VARCHAR(36) NOT NULL,
    listen_count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, playlist_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id)
  );
`;

// MySQL doesn't support "IF NOT EXISTS" for indexes in older versions; use separate statements and ignore errors
const indexStatements = [
  'CREATE INDEX idx_songs_user ON songs(user_id)',
  'CREATE INDEX idx_youtube_jobs_user ON youtube_jobs(user_id)',
  'CREATE INDEX idx_station_queue_station ON station_queue(station_id)',
  'CREATE INDEX idx_station_queue_votes ON station_queue(station_id, votes DESC)',
  'CREATE INDEX idx_user_song_favorites_user ON user_song_favorites(user_id)',
  'CREATE INDEX idx_user_song_listens_user ON user_song_listens(user_id)',
  'CREATE INDEX idx_playlists_user ON playlists(user_id)',
  'CREATE INDEX idx_playlists_slug ON playlists(slug)',
  'CREATE INDEX idx_playlists_public ON playlists(is_public)',
  'CREATE INDEX idx_playlist_tracks_playlist ON playlist_tracks(playlist_id)',
  'CREATE INDEX idx_user_playlist_ratings_playlist ON user_playlist_ratings(playlist_id)',
  'CREATE INDEX idx_user_playlist_listens_playlist ON user_playlist_listens(playlist_id)',
];

async function ensureSchema() {
  const ddlBlocks = DDL.split(';').map((s) => s.trim()).filter(Boolean);
  for (const block of ddlBlocks) {
    if (block.startsWith('CREATE INDEX IF NOT EXISTS')) continue;
    await exec(block);
  }
  for (const sql of indexStatements) {
    try {
      await exec(sql);
    } catch (_) {
      // index may already exist
    }
  }
  // Optional columns (migrations)
  try {
    await exec('ALTER TABLE youtube_jobs ADD COLUMN error_message TEXT');
  } catch (_) {}
  try {
    await exec('ALTER TABLE songs ADD COLUMN is_public TINYINT DEFAULT 1');
  } catch (_) {}
  try {
    await exec('ALTER TABLE songs ADD COLUMN thumbnail_url TEXT');
  } catch (_) {}
  try {
    await exec('ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE NULL');
  } catch (_) {}
  try {
    await exec('ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL');
  } catch (_) {}
  try {
    await exec('ALTER TABLE songs ADD COLUMN youtube_id VARCHAR(20) NULL');
  } catch (_) {}
  try {
    await exec('CREATE UNIQUE INDEX idx_songs_user_youtube ON songs (user_id, youtube_id)');
  } catch (_) {}
  try {
    await exec('ALTER TABLE stations ADD COLUMN image_url TEXT');
  } catch (_) {}
  try {
    await exec('ALTER TABLE playlists ADD COLUMN thumbnail_url TEXT');
  } catch (_) {}
  try {
    await exec('ALTER TABLE users ADD COLUMN name VARCHAR(255) NULL');
  } catch (_) {}
  try {
    await exec('ALTER TABLE users ADD COLUMN location VARCHAR(255) NULL');
  } catch (_) {}
  try {
    await exec('ALTER TABLE users ADD COLUMN youtube_cookies TEXT NULL');
  } catch (_) {}
}

let schemaReady = null;
export async function ensureDb() {
  if (schemaReady) return schemaReady;
  schemaReady = ensureSchema();
  await schemaReady;
  return schemaReady;
}

// Default export: db-like object with get, all, run for drop-in async usage
const db = {
  get,
  all,
  run,
  exec,
  ensureDb,
};

export default db;
