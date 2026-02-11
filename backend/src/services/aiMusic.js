import { v4 as uuid } from 'uuid';
import db from '../db/schema.js';

// Placeholder AI music: in production you would call Replicate, Suno, Mubert, etc.
// For demo we create a "virtual" track that points to a placeholder or generated file.

export function createAISong(userId, { prompt, genre, mood, durationSeconds = 30 }) {
  const id = uuid();
  const title = prompt?.trim() || `AI ${genre || 'Track'} - ${mood || 'Generated'}`;
  db.prepare(
    `INSERT INTO songs (id, user_id, title, artist, source, file_path, duration_seconds)
     VALUES (?, ?, ?, ?, 'ai', ?, ?)`
  ).run(id, userId, title, 'GrooveRay AI', `ai:${id}`, durationSeconds || 30);
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
  return song;
}

// Optional: stub for when you plug in a real API (e.g. Replicate)
export async function generateWithAPI(prompt, genre, mood) {
  // const response = await fetch('https://api.replicate.com/...', { ... });
  // return response.json();
  return { url: null, duration: 30 };
}
