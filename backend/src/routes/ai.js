import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createAISong } from '../services/aiMusic.js';

const router = Router();
router.use(authMiddleware);

router.post('/generate', (req, res) => {
  const { prompt, genre, mood, durationSeconds } = req.body || {};
  const song = createAISong(req.userId, { prompt, genre, mood, durationSeconds });
  res.status(201).json(song);
});

export default router;
