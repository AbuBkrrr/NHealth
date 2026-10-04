import { Router } from 'express';
import { listProviders } from '../controllers/providerListController';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/list', requireAuth, asyncHandler(listProviders));

export default router;