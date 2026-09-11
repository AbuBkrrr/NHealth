import express from 'express';
import { requireAuth } from '../middleware/auth';
import { ScreenAggregationService } from '../services/ScreenAggregationService';
import { asyncHandler } from '../utils/asyncHandler';

const router = express.Router();

/**
 * Screen aggregation endpoints
 * These combine multiple related API calls into single optimized responses
 * Reduces data consumption and improves performance on slow connections
 */

// Patient home screen - combines profile, appointments, orders, prescriptions, messages
router.get(
  '/patient/home',
  requireAuth(['PATIENT']),
  asyncHandler(async (req, res) => {
    const lastSync = req.query.lastSync ? new Date(req.query.lastSync as string) : undefined;
    const screen = await ScreenAggregationService.getPatientHomeScreen(req.user!.id, lastSync);
    res.json(screen);
  })
);

// Doctor dashboard - combines appointments, patients, payments, stats
router.get(
  '/doctor/dashboard',
  requireAuth(['DOCTOR']),
  asyncHandler(async (req, res) => {
    const screen = await ScreenAggregationService.getDoctorDashboardScreen(req.user!.id);
    res.json(screen);
  })
);

// Pharmacy dashboard - combines pending orders, inventory, revenue
router.get(
  '/pharmacy/dashboard',
  requireAuth(['PHARMACY']),
  asyncHandler(async (req, res) => {
    const screen = await ScreenAggregationService.getPharmacyDashboardScreen(req.user!.id);
    res.json(screen);
  })
);

// Lab dashboard - combines pending/in-progress/completed tests
router.get(
  '/lab/dashboard',
  requireAuth(['LAB']),
  asyncHandler(async (req, res) => {
    const screen = await ScreenAggregationService.getLabDashboardScreen(req.user!.id);
    res.json(screen);
  })
);

export default router;
