import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import * as lab from '../controllers/labController';

const router = Router();

router.use(requireAuth, requireRole('LAB'));

router.get('/profile', asyncHandler(lab.getProfile));
router.patch('/profile', asyncHandler(lab.updateProfile));

router.get('/stats', asyncHandler(lab.getStats));

router.get('/tests', asyncHandler(lab.listTests));
router.get('/tests/:id', asyncHandler(lab.getTestDetail));
router.post('/tests/:id/status', asyncHandler(lab.updateTestStatus));
router.post('/tests/:id/result', asyncHandler(lab.uploadResult));
router.get('/tests/:id/result/pdf', asyncHandler(lab.getResultPdf));

export default router;
