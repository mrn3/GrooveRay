import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { addYouTube, getYouTubeJobs } from '../services/youtube.js';

const router = Router();
router.use(authMiddleware);

router.post('/add', (req, res) => {
  const { url } = req.body || {};
  if (!url?.trim()) {
    return res.status(400).json({ error: 'YouTube URL required' });
  }
  try {
    const jobId = addYouTube(req.userId, url.trim());
    res.status(202).json({ jobId, message: 'Download started' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Invalid URL' });
  }
});

router.get('/jobs', (req, res) => {
  const jobs = getYouTubeJobs(req.userId);
  res.json(jobs);
});

export default router;
