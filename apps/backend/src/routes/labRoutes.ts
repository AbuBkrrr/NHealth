import { Router } from 'express';
import { requireAuth, requireRole, requireVerifiedProvider } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import * as lab from '../controllers/labController';

const router = Router();

router.use(requireAuth, requireRole('LAB'));
// Only verified providers can act on patients; reading data and editing their own profile stays open.
router.use((req, res, next) => (req.method === 'GET' || req.path.startsWith('/profile') || req.path.startsWith('/availability') ? next() : requireVerifiedProvider(req, res, next)));

router.get('/profile', asyncHandler(lab.getProfile));
router.patch('/profile', asyncHandler(lab.updateProfile));

router.get('/stats', asyncHandler(lab.getStats));

router.get('/tests', asyncHandler(lab.listTests));
router.get('/tests/:id', asyncHandler(lab.getTestDetail));
router.post('/tests/:id/status', asyncHandler(lab.updateTestStatus));
router.post('/tests/:id/result', asyncHandler(lab.uploadResult));
router.get('/tests/:id/result/pdf', asyncHandler(lab.getResultPdf));

export default router;
