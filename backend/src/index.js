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
import { setIO } from './socket.js';
import db from './db/schema.js';

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
app.use('/api/songs', songRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/stations', stationRoutes);

io.on('connection', (socket) => {
  socket.on('station:subscribe', (stationId) => {
    socket.join(`station:${stationId}`);
  });
  socket.on('station:unsubscribe', (stationId) => {
    socket.leave(`station:${stationId}`);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`GrooveRay API running at http://localhost:${PORT}`);
  setInterval(() => {
    try {
      const rows = db.prepare('SELECT station_id FROM station_now_playing').all();
      for (const { station_id } of rows) advanceStationPlayback(station_id);
    } catch (_) {}
  }, 5000);
});

export { io };
