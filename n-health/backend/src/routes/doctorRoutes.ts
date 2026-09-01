import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import * as doctor from '../controllers/doctorController';

const router = Router();

router.use(requireAuth, requireRole('DOCTOR'));

router.get('/profile', asyncHandler(doctor.getProfile));
router.patch('/profile', asyncHandler(doctor.updateProfile));

router.get('/appointments', asyncHandler(doctor.listAppointments));
router.post('/appointments/:id/respond', asyncHandler(doctor.respondToAppointment));

router.get('/patients', asyncHandler(doctor.listPatients));
router.get('/patients/:patientId', asyncHandler(doctor.getPatientDetail));

router.post('/prescriptions', asyncHandler(doctor.createPrescription));
router.get('/prescriptions', asyncHandler(doctor.listPrescriptionsIssued));
router.get('/prescriptions/:id/pdf', asyncHandler(doctor.getPrescriptionPdf));

export default router;
