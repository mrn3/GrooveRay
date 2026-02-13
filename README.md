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

If you see **"Sign in to confirm you're not a bot"** when adding a YouTube link, YouTube is blocking unauthenticated requests. Use one of these options (on the server):

- **Cookies file:** Export a Netscape-format `cookies.txt` from your browser while logged into YouTube (e.g. with the "Get cookies.txt LOCALLY" extension), put it on the server, and set:
  ```bash
  export YTDLP_COOKIES_FILE=/path/to/cookies.txt
  ```
- **Browser cookies (same machine):** If the app runs on a machine where you're logged into YouTube in Chrome, set:
  ```bash
  export YTDLP_COOKIES_FROM_BROWSER=chrome
  ```

Then restart the backend. Note: Google OAuth login (below) does not provide cookies for yt-dlp; these options do.

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

## Sign in with Google

Users can log in with Google in addition to username/password. To enable it:

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/) and enable the **Google+ API** (or **Google Identity**) and create an **OAuth 2.0 Client ID** (Web application).
2. Set **Authorized redirect URIs** to your backend callback, e.g. `https://your-api-host/api/auth/google/callback` (or `http://localhost:3000/api/auth/google/callback` for local dev).
3. Set these environment variables on the backend:
   - `GOOGLE_CLIENT_ID` — OAuth client ID
   - `GOOGLE_CLIENT_SECRET` — OAuth client secret
   - `FRONTEND_URL` — Where the frontend is served (e.g. `https://grooveray.funkpad.com`), used to redirect after login
   - `API_URL` — Full backend URL (e.g. `https://your-api-host`) so the redirect_uri sent to Google is correct

The login page will show a **Sign in with Google** button when these are set.

## Environment

- **Backend:** See `backend/.env.example`. Required: `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`. Optional: `PORT`, `JWT_SECRET`, `CORS_ORIGIN`, `NODE_ENV`, `YTDLP_COOKIES_FILE`, `YTDLP_COOKIES_FROM_BROWSER`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`, `API_URL`.
- **Frontend:** Vite proxy is set for local dev; set `VITE_API_URL` if you use a different API origin.

## License

MIT
