import { Router } from 'express';
import {
  balance,
  transactions,
  initiatePurchase,
  confirmPurchase,
} from '../controllers/creditsController';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/balance', requireAuth, asyncHandler(balance));
router.get('/transactions', requireAuth, asyncHandler(transactions));
router.post('/purchase/initiate', requireAuth, asyncHandler(initiatePurchase));
router.post('/purchase/confirm', requireAuth, asyncHandler(confirmPurchase));

export default router;
