import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  fincraWebhook,
  monnifyWebhook,
  flutterwaveWebhook,
  payscrowWebhook,
  paystackWebhook,
  diditWebhook,
} from '../controllers/webhookController';

const router = Router();

router.post('/paystack', asyncHandler(paystackWebhook));
router.post('/flutterwave', asyncHandler(flutterwaveWebhook));
router.post('/fincra', asyncHandler(fincraWebhook));
router.post('/monnify', asyncHandler(monnifyWebhook));
router.post('/payscrow', asyncHandler(payscrowWebhook));
router.post('/didit', asyncHandler(diditWebhook));

export default router;
