import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import * as ambulance from '../controllers/ambulanceController';

const router = Router();

router.use(requireAuth, requireRole('AMBULANCE'));

router.get('/profile', asyncHandler(ambulance.getProfile));
router.patch('/profile', asyncHandler(ambulance.updateProfile));
router.patch('/availability', asyncHandler(ambulance.setAvailability));
router.post('/location', asyncHandler(ambulance.updateLocation));

router.get('/stats', asyncHandler(ambulance.getStats));

router.get('/requests/available', asyncHandler(ambulance.listAvailableRequests));
router.get('/requests/mine', asyncHandler(ambulance.listMyRequests));
router.get('/requests/:id', asyncHandler(ambulance.getRequestDetail));
router.post('/requests/:id/accept', asyncHandler(ambulance.acceptRequest));
router.post('/requests/:id/status', asyncHandler(ambulance.updateRequestStatus));

export default router;
