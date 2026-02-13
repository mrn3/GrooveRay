import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import db from '../db/schema.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = Router();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Username, email and password required' });
  }
  const id = uuid();
  const password_hash = bcrypt.hashSync(password, 10);
  try {
    await db.run(
      'INSERT INTO users (id, username, email, password_hash, google_id) VALUES (?, ?, ?, ?, NULL)',
      [id, username.trim(), email.trim(), password_hash]
    );
    const token = jwt.sign({ userId: id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: { id, username, email }, token });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY' || e.message?.includes('Duplicate')) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }
    throw e;
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = await db.get(
    'SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?',
    [username.trim(), username.trim()]
  );
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!user.password_hash) return res.status(401).json({ error: 'This account uses Sign in with Google' });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
});

router.get('/me', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const user = await db.get('SELECT id, username, email FROM users WHERE id = ?', [payload.userId]);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// --- Google OAuth (Sign in with Google) ---
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  router.get('/google', (req, res) => {
    const next = req.query.next || 'songs';
    const state = Buffer.from(JSON.stringify({ next })).toString('base64url');
    const redirectUri = new URL('/api/auth/google/callback', process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`).toString();
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    res.redirect(url.toString());
  });

  router.get('/google/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const frontendCallback = new URL('/auth/callback', FRONTEND_URL).toString();
    if (error) {
      return res.redirect(`${frontendCallback}?error=${encodeURIComponent(error === 'access_denied' ? 'Sign in cancelled' : error)}`);
    }
    if (!code) return res.redirect(`${frontendCallback}?error=${encodeURIComponent('Missing code')}`);
    let next = 'songs';
    try {
      if (state) next = JSON.parse(Buffer.from(state, 'base64url').toString()).next || next;
    } catch (_) {}

    const redirectUri = new URL('/api/auth/google/callback', process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`).toString();
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return res.redirect(`${frontendCallback}?error=${encodeURIComponent('Google auth failed')}`);
    }
    const tokens = await tokenRes.json();
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) return res.redirect(`${frontendCallback}?error=${encodeURIComponent('Could not load profile')}`);
    const profile = await userRes.json();
    const googleId = profile.id;
    const email = profile.email || `${googleId}@google.user`;
    const username = profile.name?.replace(/\s+/g, '_').slice(0, 100) || profile.email?.split('@')[0] || `user_${googleId.slice(0, 8)}`;

    let user = await db.get('SELECT id, username, email FROM users WHERE google_id = ?', [googleId]);
    if (!user) {
      const existing = await db.get('SELECT id, username, email FROM users WHERE email = ?', [email]);
      if (existing) {
        await db.run('UPDATE users SET google_id = ? WHERE id = ?', [googleId, existing.id]);
        user = existing;
      } else {
        const id = uuid();
        let uname = username;
        let n = 0;
        while (await db.get('SELECT id FROM users WHERE username = ?', [uname])) {
          n += 1;
          uname = `${username}_${n}`;
        }
        await db.run(
          'INSERT INTO users (id, username, email, password_hash, google_id) VALUES (?, ?, ?, NULL, ?)',
          [id, uname, email, googleId]
        );
        user = { id, username: uname, email };
      }
    }
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(`${frontendCallback}?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`);
  });
} else {
  router.get('/google', (_, res) => res.status(503).json({ error: 'Sign in with Google is not configured' }));
}

export default router;
