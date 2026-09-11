// ==================== PATIENT ROUTES - PRODUCTION COMPLETE ====================

import { Router } from 'express';
import PatientController from '../controllers/PatientController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// ==================== PROFILE MANAGEMENT ====================

/**
 * POST /api/patient/profile
 * Create a new patient profile
 * Body: { firstName, lastName, dateOfBirth, gender, bloodType, medicalHistory, allergies, etc. }
 */
router.post('/profile', PatientController.createProfile);

/**
 * GET /api/patient/profile
 * Get current patient profile
 */
router.get('/profile', PatientController.getProfile);

/**
 * PATCH /api/patient/profile
 * Update patient profile
 * Body: { firstName, lastName, dateOfBirth, gender, bloodType, etc. }
 */
router.patch('/profile', PatientController.updateProfile);

/**
 * DELETE /api/patient/profile
 * Delete patient profile
 */
router.delete('/profile', PatientController.deleteProfile);

// ==================== MEDICAL HISTORY ====================

/**
 * PATCH /api/patient/medical-history
 * Update medical history
 * Body: { history: string }
 */
router.patch('/medical-history', PatientController.updateMedicalHistory);

// ==================== ALLERGIES ====================

/**
 * POST /api/patient/allergies
 * Add allergy
 * Body: { allergy: string }
 */
router.post('/allergies', PatientController.addAllergy);

/**
 * DELETE /api/patient/allergies/:allergy
 * Remove allergy
 */
router.delete('/allergies/:allergy', PatientController.removeAllergy);

/**
 * GET /api/patient/allergies
 * Get all allergies
 */
router.get('/allergies', PatientController.getAllergies);

// ==================== MEDICATIONS ====================

/**
 * POST /api/patient/medications
 * Add medication
 * Body: { name, dosage, frequency, startDate, endDate, reason, prescribedBy, refillsRemaining, etc. }
 */
router.post('/medications', PatientController.addMedication);

/**
 * PATCH /api/patient/medications/:medicationId
 * Update medication
 */
router.patch('/medications/:medicationId', PatientController.updateMedication);

/**
 * DELETE /api/patient/medications/:medicationId
 * Remove medication
 */
router.delete('/medications/:medicationId', PatientController.removeMedication);

/**
 * GET /api/patient/medications
 * Get all medications
 */
router.get('/medications', PatientController.getMedications);

/**
 * POST /api/patient/medications/check-interactions
 * Check for drug interactions
 */
router.post('/medications/check-interactions', PatientController.checkDrugInteractions);

// ==================== EMERGENCY CONTACTS ====================

/**
 * POST /api/patient/emergency-contacts
 * Add emergency contact
 * Body: { name, relationship, phone, email, address, isPrimary }
 */
router.post('/emergency-contacts', PatientController.addEmergencyContact);

/**
 * PATCH /api/patient/emergency-contacts/:contactId
 * Update emergency contact
 */
router.patch('/emergency-contacts/:contactId', PatientController.updateEmergencyContact);

/**
 * DELETE /api/patient/emergency-contacts/:contactId
 * Remove emergency contact
 */
router.delete('/emergency-contacts/:contactId', PatientController.removeEmergencyContact);

/**
 * GET /api/patient/emergency-contacts/primary
 * Get primary emergency contact
 */
router.get('/emergency-contacts/primary', PatientController.getPrimaryEmergencyContact);

// ==================== DEPENDENTS ====================

/**
 * POST /api/patient/dependents
 * Add dependent
 * Body: { name, relationship, dateOfBirth, gender, bloodType, insurance }
 */
router.post('/dependents', PatientController.addDependent);

/**
 * PATCH /api/patient/dependents/:dependentId
 * Update dependent
 */
router.patch('/dependents/:dependentId', PatientController.updateDependent);

/**
 * DELETE /api/patient/dependents/:dependentId
 * Remove dependent
 */
router.delete('/dependents/:dependentId', PatientController.removeDependent);

/**
 * GET /api/patient/dependents
 * Get all dependents
 */
router.get('/dependents', PatientController.getDependents);

// ==================== INSURANCE ====================

/**
 * POST /api/patient/insurance
 * Link insurance information
 * Body: { provider, insuranceNumber, nhisNumber }
 */
router.post('/insurance', PatientController.linkInsurance);

/**
 * GET /api/patient/insurance
 * Get insurance information
 */
router.get('/insurance', PatientController.getInsuranceInfo);

// ==================== HEALTH RECORDS ====================

/**
 * POST /api/patient/health-records
 * Upload health record
 * Body: { type, title, description, fileUrl, fileName, fileSize, mimeType, issuedDate, provider, tags }
 */
router.post('/health-records', PatientController.uploadHealthRecord);

/**
 * GET /api/patient/health-records
 * Get health records
 * Query: type (optional - lab_report, prescription, imaging, vaccination, allergy_test, other)
 */
router.get('/health-records', PatientController.getHealthRecords);

/**
 * DELETE /api/patient/health-records/:recordId
 * Archive health record
 */
router.delete('/health-records/:recordId', PatientController.deleteHealthRecord);

// ==================== VITALS ====================

/**
 * POST /api/patient/vitals
 * Record vitals
 * Body: { height, weight, bloodPressure, temperature, pulse, respiratoryRate }
 */
router.post('/vitals', PatientController.recordVitals);

/**
 * GET /api/patient/vitals/history
 * Get vitals history
 * Query: limit (optional, default 10)
 */
router.get('/vitals/history', PatientController.getVitalsHistory);

/**
 * GET /api/patient/vitals/trends
 * Get vitals trends
 */
router.get('/vitals/trends', PatientController.getVitalsTrends);

// ==================== APPOINTMENTS ====================

/**
 * POST /api/patient/appointments
 * Book appointment
 * Body: { doctorId, dateTime, duration, reason, consultationType, prepInstructions }
 */
router.post('/appointments', PatientController.bookAppointment);

/**
 * GET /api/patient/appointments
 * Get appointments
 * Query: status (optional - scheduled, confirmed, completed, cancelled, no_show, rescheduled)
 */
router.get('/appointments', PatientController.getAppointments);

/**
 * PATCH /api/patient/appointments/:appointmentId/reschedule
 * Reschedule appointment
 * Body: { newDateTime }
 */
router.patch('/appointments/:appointmentId/reschedule', PatientController.rescheduleAppointment);

/**
 * DELETE /api/patient/appointments/:appointmentId
 * Cancel appointment
 * Body: { reason }
 */
router.delete('/appointments/:appointmentId', PatientController.cancelAppointment);

/**
 * GET /api/patient/appointments/upcoming
 * Get upcoming appointments
 */
router.get('/appointments/upcoming', PatientController.getUpcomingAppointments);

// ==================== PROVIDER FAVORITES ====================

/**
 * POST /api/patient/favorite-providers
 * Add provider to favorites
 * Body: { providerId }
 */
router.post('/favorite-providers', PatientController.addProviderFavorite);

/**
 * DELETE /api/patient/favorite-providers/:providerId
 * Remove provider from favorites
 */
router.delete('/favorite-providers/:providerId', PatientController.removeProviderFavorite);

/**
 * GET /api/patient/favorite-providers
 * Get favorite providers
 */
router.get('/favorite-providers', PatientController.getFavoriteProviders);

// ==================== DATA SHARING CONSENT ====================

/**
 * POST /api/patient/consent
 * Grant data sharing consent
 * Body: { providerId, dataTypes: ['medical_history', 'allergies', 'medications', etc.] }
 */
router.post('/consent', PatientController.grantDataSharingConsent);

/**
 * DELETE /api/patient/consent/:consentId
 * Revoke data sharing consent
 */
router.delete('/consent/:consentId', PatientController.revokeDataSharingConsent);

/**
 * GET /api/patient/consent
 * Get all data sharing consents
 */
router.get('/consent', PatientController.getDataSharingConsents);

export default router;
