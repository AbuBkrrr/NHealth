import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import * as provider from '../controllers/providerController';

const router = Router();

router.use(requireAuth);

router.get('/doctors', asyncHandler(provider.listDoctors));
router.get('/pharmacies', asyncHandler(provider.listPharmacies));
router.get('/pharmacies/:pharmacyId/inventory', asyncHandler(provider.pharmacyInventory));
router.get('/labs', asyncHandler(provider.listLabs));
router.get('/ambulances', asyncHandler(provider.listAvailableAmbulances));
router.get('/nurses', asyncHandler(provider.listAvailableNurses));

export default router;
