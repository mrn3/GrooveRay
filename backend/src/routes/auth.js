import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import db from '../db/schema.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: 'Username, email and password required' });
  }
  const id = uuid();
  const password_hash = bcrypt.hashSync(password, 10);
  try {
    db.prepare(
      'INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)'
    ).run(id, username.trim(), email.trim(), password_hash);
    const token = jwt.sign({ userId: id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: { id, username, email }, token });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }
    throw e;
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  const user = db.prepare(
    'SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?'
  ).get(username.trim(), username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
});

router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    const user = db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
