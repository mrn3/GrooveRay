# GrooveRay

A GrooveShark-style music app: upload songs and run crowd-sourced radio stations where the most upvoted tracks play next.

## Features

- **Upload** — Upload your own audio files (MP3, etc.)
- **YouTube** — Paste a YouTube music video URL; GrooveRay extracts the audio and adds it to your library (requires **yt-dlp** and **ffmpeg** on the server)
- **Stations** — Create a station, add songs to the queue, and upvote. The queue is sorted by votes; most upvoted plays next. Real-time updates via WebSockets.

## Stack

- **Backend:** Node.js, Express, MariaDB/MySQL (mysql2), Socket.io, Multer
- **Frontend:** React, Vite, Tailwind CSS, React Router, Socket.io client

## Setup

### MariaDB (local)

Create a database and user (e.g. with MariaDB 10.6+ or MySQL 8):

```bash
mysql -u root -e "CREATE DATABASE grooveray; CREATE USER 'grooveray'@'localhost' IDENTIFIED BY 'grooveray'; GRANT ALL ON grooveray.* TO 'grooveray'@'localhost'; FLUSH PRIVILEGES;"
```

Copy env and start the backend:

```bash
cd backend
cp .env.example .env
# Edit .env if your DB user/password differ
npm install
npm run dev
```

Runs at `http://localhost:3000`. Tables are created automatically on first run. Uses `backend/uploads/` and `backend/downloads/` for files.

For YouTube audio extraction, install **yt-dlp** and **ffmpeg** (e.g. `brew install yt-dlp ffmpeg` on macOS).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173` and proxies `/api` and `/socket.io` to the backend.

### First run

1. Start backend, then frontend.
2. Open `http://localhost:5173`, sign up, then use Upload or YouTube to add tracks.
3. Create a station under Stations, add songs to the queue, and upvote to reorder. Play from the queue; the bar at the bottom is the global player.

## Environment

- **Backend:** See `backend/.env.example`. Required: `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`. Optional: `PORT`, `JWT_SECRET`, `CORS_ORIGIN`, `NODE_ENV`.
- **Frontend:** Vite proxy is set for local dev; set `VITE_API_URL` if you use a different API origin.

## License

MIT
