import { Router } from 'express';
import {
  getBankAccount,
  upsertBankAccount,
  deleteBankAccount,
} from '../controllers/providerBankController';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ============================================================
// LOCAL CORS PREFLIGHT HANDLER
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

router.get('/bank', requireAuth, asyncHandler(getBankAccount));
router.post('/bank', requireAuth, asyncHandler(upsertBankAccount));
router.delete('/bank', requireAuth, asyncHandler(deleteBankAccount));

export default router;