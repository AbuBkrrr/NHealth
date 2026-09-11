import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import * as patient from '../controllers/patientController';

const router = Router();

router.use(requireAuth, requireRole('PATIENT'));

router.get('/profile', asyncHandler(patient.getProfile));
router.patch('/profile', asyncHandler(patient.updateProfile));

router.get('/appointments', asyncHandler(patient.listAppointments));
router.post('/appointments', asyncHandler(patient.createAppointment));
router.post('/appointments/:id/cancel', asyncHandler(patient.cancelAppointment));

router.get('/orders', asyncHandler(patient.listOrders));
router.post('/orders', asyncHandler(patient.createOrder));
router.get('/orders/:id/invoice.pdf', asyncHandler(patient.getOrderInvoicePdf));

router.get('/prescriptions', asyncHandler(patient.listPrescriptions));
router.get('/prescriptions/:id/pdf', asyncHandler(patient.getPrescriptionPdf));

router.get('/lab-tests', asyncHandler(patient.listLabTests));
router.post('/lab-tests', asyncHandler(patient.createLabTest));

router.get('/emergency', asyncHandler(patient.listEmergencyRequests));
router.post('/emergency', asyncHandler(patient.requestEmergency));
router.post('/emergency/:id/cancel', asyncHandler(patient.cancelEmergencyRequest));

router.post('/nurse-requests', asyncHandler(patient.requestNurse));

router.get('/donations', asyncHandler(patient.listDonations));
router.post('/donations', asyncHandler(patient.createDonation));

router.get('/insurance', asyncHandler(patient.listInsurance));
router.post('/insurance', asyncHandler(patient.addInsurance));

export default router;
