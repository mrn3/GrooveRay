import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import songRoutes from './routes/songs.js';
import youtubeRoutes from './routes/youtube.js';
import stationRoutes, { advanceStationPlayback } from './routes/stations.js';
import playlistRoutes from './routes/playlists.js';
import dashboardRoutes from './routes/dashboard.js';
import imageRoutes from './routes/images.js';
import { setIO, addStationListener, removeStationListener, removeSocketFromStations, emitStationUpdate } from './socket.js';
import db from './db/schema.js';
import { JWT_SECRET } from './middleware/auth.js';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true },
});
setIO(io);

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/uploads/avatars', express.static(path.join(__dirname, '../uploads/avatars')));
app.use('/api/uploads/thumbnails', express.static(path.join(__dirname, '../uploads/thumbnails')));
app.use('/api/uploads/playlists', express.static(path.join(__dirname, '../uploads/playlists')));
app.use('/api/uploads/stations', express.static(path.join(__dirname, '../uploads/stations')));
app.use('/api/songs', songRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/images', imageRoutes);

// Production: serve built frontend from ../frontend/dist
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(frontendDist));
  app.get('*', (_, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

io.on('connection', (socket) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.userId = payload.userId;
      socket.username = payload.username || payload.userId;
    } catch (_) {}
  }

  socket.on('station:subscribe', (stationId) => {
    if (!stationId || typeof stationId !== 'string') return;
    socket.join(`station:${stationId}`);
    if (socket.userId && socket.username) {
      const listeners = addStationListener(stationId, socket.userId, socket.username, socket.id);
      socket.currentStationId = stationId;
      io.to(`station:${stationId}`).emit('listeners', listeners);
    }
  });

  socket.on('station:unsubscribe', (stationId) => {
    if (!stationId || typeof stationId !== 'string') return;
    if (socket.userId) {
      const listeners = removeStationListener(stationId, socket.userId, socket.id);
      io.to(`station:${stationId}`).emit('listeners', listeners);
    }
    socket.leave(`station:${stationId}`);
    socket.currentStationId = null;
  });

  socket.on('station:chat', async (payload) => {
    const stationId = payload?.stationId;
    const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
    if (!stationId || !message || message.length > 2000) return;
    if (!socket.userId || !socket.username) return;
    const station = await db.get('SELECT id FROM stations WHERE id = ?', [stationId]);
    if (!station) return;
    const id = uuid();
    await db.run(
      'INSERT INTO station_chat_messages (id, station_id, user_id, message) VALUES (?, ?, ?, ?)',
      [id, stationId, socket.userId, message]
    );
    const row = {
      id,
      user_id: socket.userId,
      username: socket.username,
      message,
      created_at: new Date().toISOString(),
    };
    emitStationUpdate(stationId, 'chat', row);
  });

  socket.on('disconnect', () => {
    const updates = removeSocketFromStations(socket.id);
    for (const { stationId, listeners } of updates) {
      io.to(`station:${stationId}`).emit('listeners', listeners);
    }
  });
});

const PORT = process.env.PORT || 3000;

async function start() {
  await db.ensureDb();
  httpServer.listen(PORT, () => {
    console.log(`GrooveRay API running at http://localhost:${PORT}`);
    setInterval(async () => {
      try {
        const rows = await db.all('SELECT station_id FROM station_now_playing');
        for (const { station_id } of rows) await advanceStationPlayback(station_id);
      } catch (_) {}
    }, 5000);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

export { io };
