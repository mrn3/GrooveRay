import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'grooveray-dev-secret-change-in-production';

export function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization' });
  }
  try {
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.username = payload.username;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function optionalAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return next();
  }
  try {
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.username = payload.username;
  } catch (_) {}
  next();
}

export { JWT_SECRET };
