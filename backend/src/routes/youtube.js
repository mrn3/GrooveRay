import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { addYouTube, getYouTubeJobs } from '../services/youtube.js';

const router = Router();
router.use(authMiddleware);

router.post('/add', async (req, res) => {
  const { url } = req.body || {};
  if (!url?.trim()) {
    return res.status(400).json({ error: 'YouTube URL required' });
  }
  try {
    const jobId = await addYouTube(req.userId, url.trim());
    res.status(202).json({ jobId, message: 'Download started' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Invalid URL' });
  }
});

router.get('/jobs', async (req, res) => {
  const jobs = await getYouTubeJobs(req.userId);
  res.json(jobs);
});

export default router;
