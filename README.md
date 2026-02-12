# GrooveRay

A GrooveShark-style music app: upload songs, add torrents to download media, and run crowd-sourced radio stations where the most upvoted tracks play next.

## Features

- **Upload** — Upload your own audio files (MP3, etc.)
- **YouTube** — Paste a YouTube music video URL; GrooveRay extracts the audio and adds it to your library (requires **yt-dlp** and **ffmpeg** on the server)
- **Torrents** — Paste a magnet link; GrooveRay downloads the content and adds the largest audio file to your library
- **Stations** — Create a station, add songs to the queue, and upvote. The queue is sorted by votes; most upvoted plays next. Real-time updates via WebSockets.

## Stack

- **Backend:** Node.js, Express, SQLite (better-sqlite3), Socket.io, Multer, WebTorrent
- **Frontend:** React, Vite, Tailwind CSS, React Router, Socket.io client

## Setup

### Backend

```bash
cd backend
npm install
npm run dev
```

Runs at `http://localhost:3000`. Creates `backend/data/grooveray.db` and uses `backend/uploads/` and `backend/downloads/` for files.

For YouTube audio extraction, install **yt-dlp** and **ffmpeg** on the machine running the backend (e.g. `brew install yt-dlp ffmpeg` on macOS).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173` and proxies `/api` and `/socket.io` to the backend.

### First run

1. Start backend, then frontend.
2. Open `http://localhost:5173`, sign up, then use Upload, YouTube, or Torrents to add tracks.
3. Create a station under Stations, add songs to the queue, and upvote to reorder. Play from the queue; the bar at the bottom is the global player.

## Environment (optional)

- **Backend:** `PORT`, `JWT_SECRET`, `CORS_ORIGIN`
- **Frontend:** Vite proxy is set for local dev; set `VITE_API_URL` if you use a different API origin.

## License

MIT
