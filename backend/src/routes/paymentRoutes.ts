import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import * as payment from '../controllers/paymentController';

const router = Router();

router.use(requireAuth);

router.post('/', asyncHandler(payment.createPayment));
router.get('/mine', asyncHandler(payment.listMyPayments));
router.get('/incoming', asyncHandler(payment.listIncomingPayments));
router.get('/:id', asyncHandler(payment.getPayment));
router.get('/:id/receipt.pdf', asyncHandler(payment.getReceiptPdf));
router.post('/:id/confirm', asyncHandler(payment.confirmPayment));
router.post('/:id/cancel', asyncHandler(payment.cancelPayment));

export default router;
