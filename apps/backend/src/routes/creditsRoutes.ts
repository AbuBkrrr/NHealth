import { Router } from 'express';
import {
  balance,
  transactions,
  initiatePurchase,
  confirmPurchase,
  gateways,
} from '../controllers/creditsController';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { sensitiveLimiter } from '../middleware/rateLimit';

const router = Router();

router.get('/gateways', requireAuth, asyncHandler(gateways));
router.get('/balance', requireAuth, asyncHandler(balance));
router.get('/transactions', requireAuth, asyncHandler(transactions));
router.post('/purchase/initiate', requireAuth, sensitiveLimiter, asyncHandler(initiatePurchase));
router.post('/purchase/confirm', requireAuth, sensitiveLimiter, asyncHandler(confirmPurchase));

export default router;
