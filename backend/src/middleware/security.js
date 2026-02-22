/**
 * Production security: IP blocklist, rate limiting, and helpers.
 * Banned IPs: set BANNED_IPS=1.2.3.4,5.6.7.8 or use banned-ips.txt (one IP per line).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Get client IP from request (respects X-Forwarded-For / X-Real-IP behind nginx). */
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0];
    return (first || '').trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || req.ip || '';
}

/** Load banned IPs from BANNED_IPS env (comma-separated) or banned-ips.txt. */
function loadBannedIps() {
  const fromEnv = process.env.BANNED_IPS;
  if (fromEnv) {
    return new Set(fromEnv.split(',').map((s) => s.trim()).filter(Boolean));
  }
  const filePath = path.join(__dirname, '../../banned-ips.txt');
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const ips = content
        .split('\n')
        .map((line) => line.replace(/#.*$/, '').trim())
        .filter(Boolean);
      return new Set(ips);
    }
  } catch (_) {}
  return new Set();
}

let bannedSet = loadBannedIps();

/** Reload banned IPs (call after updating banned-ips.txt or env). */
export function reloadBannedIps() {
  bannedSet = loadBannedIps();
  return bannedSet.size;
}

/** Middleware: block requests from banned IPs. */
export function blockBannedIps(req, res, next) {
  const ip = getClientIp(req);
  if (bannedSet.has(ip)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

/** Options for express-rate-limit (production-safe). */
export const rateLimitOptions = {
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // general API: 120 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => process.env.NODE_ENV !== 'production',
};

/** Stricter rate limit for auth routes (login/register). */
export const authRateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => process.env.NODE_ENV !== 'production',
};
