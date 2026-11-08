import { Router } from 'express';
import { requireAuth, requireRole, requireVerifiedProvider } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import * as nurse from '../controllers/nurseController';

const router = Router();

router.use(requireAuth, requireRole('NURSE'));
// Only verified providers can act on patients; reading data and editing their own profile stays open.
router.use((req, res, next) => (req.method === 'GET' || req.path.startsWith('/profile') || req.path.startsWith('/availability') ? next() : requireVerifiedProvider(req, res, next)));

router.get('/profile', asyncHandler(nurse.getProfile));
router.patch('/profile', asyncHandler(nurse.updateProfile));
router.patch('/availability', asyncHandler(nurse.setAvailability));

router.get('/stats', asyncHandler(nurse.getStats));

router.get('/requests/available', asyncHandler(nurse.listAvailableRequests));
router.get('/requests/mine', asyncHandler(nurse.listMyRequests));
router.get('/requests/:id', asyncHandler(nurse.getRequestDetail));
router.post('/requests/:id/accept', asyncHandler(nurse.acceptRequest));
router.post('/requests/:id/status', asyncHandler(nurse.updateRequestStatus));

export default router;
