import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/grooveray.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT,
    source TEXT NOT NULL,
    file_path TEXT,
    duration_seconds INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS station_queue (
    id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    played_at TEXT,
    position INTEGER DEFAULT 0,
    added_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (song_id) REFERENCES songs(id)
  );

  CREATE TABLE IF NOT EXISTS station_votes (
    station_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    queue_id TEXT NOT NULL,
    PRIMARY KEY (station_id, user_id, queue_id),
    FOREIGN KEY (station_id) REFERENCES stations(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (queue_id) REFERENCES station_queue(id)
  );

  CREATE TABLE IF NOT EXISTS torrent_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    magnet_or_torrent TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    song_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (song_id) REFERENCES songs(id)
  );

  CREATE INDEX IF NOT EXISTS idx_songs_user ON songs(user_id);
  CREATE INDEX IF NOT EXISTS idx_station_queue_station ON station_queue(station_id);
  CREATE INDEX IF NOT EXISTS idx_station_queue_votes ON station_queue(station_id, votes DESC);
`);

export default db;
