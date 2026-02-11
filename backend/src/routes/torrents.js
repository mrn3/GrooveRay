import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { addTorrent, getTorrentJobs } from '../services/torrent.js';

const router = Router();
router.use(authMiddleware);

router.post('/add', (req, res) => {
  const { magnet } = req.body || {};
  if (!magnet?.trim()) {
    return res.status(400).json({ error: 'magnet link or torrent URL required' });
  }
  const jobId = addTorrent(req.userId, magnet.trim());
  res.status(202).json({ jobId, message: 'Download started' });
});

router.get('/jobs', (req, res) => {
  const jobs = getTorrentJobs(req.userId);
  res.json(jobs);
});

export default router;
