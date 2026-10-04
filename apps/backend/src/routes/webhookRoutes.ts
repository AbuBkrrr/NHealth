import { Router } from 'express';
import {
  fincraWebhook,
  monnifyWebhook,
  flutterwaveWebhook,
  payscrowWebhook,
} from '../controllers/webhookController';

const router = Router();

router.post('/fincra', fincraWebhook);
router.post('/monnify', monnifyWebhook);
router.post('/flutterwave', flutterwaveWebhook);
router.post('/payscrow', payscrowWebhook);

export default router;
