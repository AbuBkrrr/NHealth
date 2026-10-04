import { Router } from 'express';
import {
  initiateEscrow,
  getEscrow,
  releaseEscrow,
  disputeEscrow,
  listMyEscrows,
  listBanks,
} from '../controllers/escrowController';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ============================================================
// LOCAL CORS PREFLIGHT HANDLER
// Ensures headers are set even if the app-level CORS middleware
// isn't reached first.
// ============================================================
router.use((req: any, res: any, next: any) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

router.get('/banks', requireAuth, asyncHandler(listBanks));
router.get('/my/list', requireAuth, asyncHandler(listMyEscrows));
router.post('/initiate', requireAuth, asyncHandler(initiateEscrow));
router.get('/:id', requireAuth, asyncHandler(getEscrow));
router.post('/:id/release', requireAuth, asyncHandler(releaseEscrow));
router.post('/:id/dispute', requireAuth, asyncHandler(disputeEscrow));

export default router;