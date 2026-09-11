// Complete API Routes for All 13 Modules
// Express router configuration - ready to integrate into main server

import { Router, Request, Response } from 'express';
import {
  services,
  PatientService,
  DoctorService,
  PharmacyService,
  LabService,
  AmbulanceService,
  NurseService,
  PaymentService,
  InsuranceService,
  DonationsService,
  AppointmentsService,
  MessagingService,
  NotificationsService,
  AdminService,
} from '../services/ModuleServices';

const router = Router();

// Middleware for error handling
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: Function) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==================== PATIENT ROUTES ====================
router.get('/patients/:id/medical-history', asyncHandler(async (req, res) => {
  const data = await services.patient.getMedicalHistory(req.params.id);
  res.json(data);
}));

router.put('/patients/:id/medical-history', asyncHandler(async (req, res) => {
  const data = await services.patient.updateMedicalHistory(req.params.id, req.body);
  res.json(data);
}));

router.get('/patients/:id/allergies', asyncHandler(async (req, res) => {
  const data = await services.patient.getAllergies(req.params.id);
  res.json(data);
}));

router.post('/patients/:id/allergies', asyncHandler(async (req, res) => {
  const data = await services.patient.addAllergy(req.params.id, req.body.allergy);
  res.json(data);
}));

router.get('/patients/:id/medications', asyncHandler(async (req, res) => {
  const data = await services.patient.getCurrentMedications(req.params.id);
  res.json(data);
}));

router.post('/patients/:id/medications', asyncHandler(async (req, res) => {
  const data = await services.patient.addMedication(req.params.id, req.body);
  res.json(data);
}));

router.get('/patients/:id/emergency-contact', asyncHandler(async (req, res) => {
  const data = await services.patient.getEmergencyContact(req.params.id);
  res.json(data);
}));

router.put('/patients/:id/emergency-contact', asyncHandler(async (req, res) => {
  const data = await services.patient.updateEmergencyContact(req.params.id, req.body);
  res.json(data);
}));

router.post('/patients/:id/dependents', asyncHandler(async (req, res) => {
  const data = await services.patient.addDependent(req.params.id, req.body);
  res.json(data);
}));

router.get('/patients/:id/dependents', asyncHandler(async (req, res) => {
  const data = await services.patient.getDependents(req.params.id);
  res.json(data);
}));

router.post('/patients/:id/records', asyncHandler(async (req, res) => {
  const data = await services.patient.uploadHealthRecord(req.params.id, req.file);
  res.json(data);
}));

router.get('/patients/:id/records', asyncHandler(async (req, res) => {
  const data = await services.patient.getHealthRecords(req.params.id);
  res.json(data);
}));

router.post('/patients/:id/vitals', asyncHandler(async (req, res) => {
  const data = await services.patient.trackVitals(req.params.id, req.body);
  res.json(data);
}));

router.get('/patients/:id/vitals', asyncHandler(async (req, res) => {
  const days = req.query.days ? parseInt(req.query.days as string) : 30;
  const data = await services.patient.getVitalsTrend(req.params.id, days);
  res.json(data);
}));

router.get('/patients/:id/favorites', asyncHandler(async (req, res) => {
  const data = await services.patient.getFavoriteProviders(req.params.id);
  res.json(data);
}));

router.post('/patients/:id/favorites', asyncHandler(async (req, res) => {
  const data = await services.patient.addFavoriteProvider(req.params.id, req.body.providerId);
  res.json(data);
}));

// ==================== DOCTOR ROUTES ====================
router.get('/doctors/:doctorId/patients/:patientId/notes', asyncHandler(async (req, res) => {
  const data = await services.doctor.getPatientNotes(req.params.doctorId, req.params.patientId);
  res.json(data);
}));

router.post('/doctors/:doctorId/patients/:patientId/notes', asyncHandler(async (req, res) => {
  const data = await services.doctor.createPatientNote(req.params.doctorId, req.params.patientId, req.body);
  res.json(data);
}));

router.get('/doctors/:doctorId/patients/:patientId/history', asyncHandler(async (req, res) => {
  const data = await services.doctor.getPatientHistory(req.params.doctorId, req.params.patientId);
  res.json(data);
}));

router.post('/doctors/:doctorId/patients/:patientId/diagnosis', asyncHandler(async (req, res) => {
  const data = await services.doctor.createDiagnosis(req.params.doctorId, req.params.patientId, req.body);
  res.json(data);
}));

router.post('/doctors/:doctorId/patients/:patientId/lab-tests', asyncHandler(async (req, res) => {
  const data = await services.doctor.orderLabTest(req.params.doctorId, req.params.patientId, req.body);
  res.json(data);
}));

router.post('/doctors/:doctorId/patients/:patientId/referrals', asyncHandler(async (req, res) => {
  const data = await services.doctor.createReferral(req.params.doctorId, req.params.patientId, req.body);
  res.json(data);
}));

router.post('/doctors/:doctorId/patients/:patientId/prescriptions', asyncHandler(async (req, res) => {
  const data = await services.doctor.createPrescription(req.params.doctorId, req.params.patientId, req.body);
  res.json(data);
}));

router.get('/doctors/:doctorId/prescription-templates', asyncHandler(async (req, res) => {
  const data = await services.doctor.getPrescriptionTemplates(req.params.doctorId);
  res.json(data);
}));

router.post('/doctors/:doctorId/patients/:patientId/vitals', asyncHandler(async (req, res) => {
  const data = await services.doctor.recordVitals(req.params.doctorId, req.params.patientId, req.body);
  res.json(data);
}));

router.post('/drugs/interactions', asyncHandler(async (req, res) => {
  const data = await services.doctor.checkDrugInteractions(req.body.drugs);
  res.json(data);
}));

router.post('/doctors/:doctorId/patients/:patientId/follow-up', asyncHandler(async (req, res) => {
  const data = await services.doctor.scheduleFollowUp(req.params.doctorId, req.params.patientId, req.body);
  res.json(data);
}));

router.get('/doctors/:doctorId/earnings', asyncHandler(async (req, res) => {
  const data = await services.doctor.getEarningsBreakdown(
    req.params.doctorId,
    req.query.start as string,
    req.query.end as string
  );
  res.json(data);
}));

router.get('/doctors/:doctorId/tax-report', asyncHandler(async (req, res) => {
  const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
  const data = await services.doctor.getTaxReport(req.params.doctorId, year);
  res.json(data);
}));

router.post('/doctors/:doctorId/cpd', asyncHandler(async (req, res) => {
  const data = await services.doctor.trackCPD(req.params.doctorId, req.body);
  res.json(data);
}));

router.get('/doctors/:doctorId/stats', asyncHandler(async (req, res) => {
  const data = await services.doctor.getConsultationStats(req.params.doctorId);
  res.json(data);
}));

// ==================== PHARMACY ROUTES ====================
router.get('/pharmacy/drugs/:drugId/expiry', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.checkDrugExpiry(req.params.drugId);
  res.json(data);
}));

router.get('/pharmacy/:pharmacyId/expiring-drugs', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.getAllExpiringDrugs(req.params.pharmacyId);
  res.json(data);
}));

router.get('/pharmacy/batch/:batchNumber', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.trackBatchNumber(req.params.batchNumber);
  res.json(data);
}));

router.post('/pharmacy/prescriptions/:prescriptionId/verify', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.verifyPrescription(req.params.prescriptionId);
  res.json(data);
}));

router.get('/pharmacy/drugs/:drugId/nafdac-verify', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.checkNAFDACNumber(req.params.drugId);
  res.json(data);
}));

router.post('/pharmacy/:pharmacyId/purchase-orders', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.generatePurchaseOrder(req.params.pharmacyId, req.body.items);
  res.json(data);
}));

router.post('/pharmacy/:pharmacyId/reorder-rules', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.setupReorderAutomation(req.params.pharmacyId, req.body);
  res.json(data);
}));

router.get('/pharmacy/deliveries/:orderId', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.trackDelivery(req.params.orderId);
  res.json(data);
}));

router.post('/pharmacy/orders/:orderId/partial-fulfillment', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.processPartialFulfillment(req.params.orderId, req.body.items);
  res.json(data);
}));

router.post('/pharmacy/orders/:orderId/return', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.processReturn(req.params.orderId, req.body.items);
  res.json(data);
}));

router.get('/pharmacy/:pharmacyId/loyalty', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.getLoyaltyProgram(req.params.pharmacyId);
  res.json(data);
}));

router.post('/pharmacy/:pharmacyId/branches', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.manageBranch(req.params.pharmacyId, req.body);
  res.json(data);
}));

router.post('/pharmacy/stock-transfer', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.transferStockBetweenBranches(
    req.body.from,
    req.body.to,
    req.body.items
  );
  res.json(data);
}));

router.get('/pharmacy/:pharmacyId/inventory-alerts', asyncHandler(async (req, res) => {
  const data = await services.pharmacy.getInventoryAlerts(req.params.pharmacyId);
  res.json(data);
}));

// ==================== LAB ROUTES ====================
router.get('/lab/:labId/tests', asyncHandler(async (req, res) => {
  const data = await services.lab.getTestCatalog(req.params.labId);
  res.json(data);
}));

router.post('/lab/:labId/tests', asyncHandler(async (req, res) => {
  const data = await services.lab.addTestToCatalog(req.params.labId, req.body);
  res.json(data);
}));

router.get('/lab/tests/:testId/reference-ranges', asyncHandler(async (req, res) => {
  const data = await services.lab.getReferenceRanges(req.params.testId);
  res.json(data);
}));

router.post('/lab/:labId/results', asyncHandler(async (req, res) => {
  const data = await services.lab.uploadLabResult(req.params.labId, req.body);
  res.json(data);
}));

router.post('/lab/results/:resultId/flag', asyncHandler(async (req, res) => {
  const data = await services.lab.flagResultAsAbnormal(req.params.resultId, req.body.flag);
  res.json(data);
}));

router.get('/lab/patients/:patientId/tests/:testId/history', asyncHandler(async (req, res) => {
  const data = await services.lab.getResultHistory(req.params.patientId, req.params.testId);
  res.json(data);
}));

router.post('/lab/:labId/home-collection', asyncHandler(async (req, res) => {
  const data = await services.lab.scheduleCollectionAtHome(req.params.labId, req.body);
  res.json(data);
}));

router.get('/lab/samples/:barcodeNumber', asyncHandler(async (req, res) => {
  const data = await services.lab.trackSampleByBarcode(req.params.barcodeNumber);
  res.json(data);
}));

router.post('/lab/results/:resultId/verify', asyncHandler(async (req, res) => {
  const data = await services.lab.verifyResultByPathologist(req.params.resultId, req.body.verified);
  res.json(data);
}));

router.post('/lab/results/:resultId/critical-alert', asyncHandler(async (req, res) => {
  const data = await services.lab.setCriticalValueAlert(req.params.resultId);
  res.json(data);
}));

router.post('/lab/results/:resultId/attach-image', asyncHandler(async (req, res) => {
  const data = await services.lab.attachImageToResult(req.params.resultId, req.file);
  res.json(data);
}));

router.get('/lab/:labId/accreditation', asyncHandler(async (req, res) => {
  const data = await services.lab.getLabAccreditation(req.params.labId);
  res.json(data);
}));

router.get('/lab/patients/:patientId/tests/:testId/comparison', asyncHandler(async (req, res) => {
  const data = await services.lab.compareResultsOverTime(req.params.patientId, req.params.testId);
  res.json(data);
}));

// ==================== AMBULANCE ROUTES ====================
router.post('/ambulance/request', asyncHandler(async (req, res) => {
  const data = await services.ambulance.requestAmbulance(req.body.location, req.body.emergencyType);
  res.json(data);
}));

router.get('/ambulance/requests/:requestId/tracking', asyncHandler(async (req, res) => {
  const data = await services.ambulance.trackAmbulanceRealtime(req.params.requestId);
  res.json(data);
}));

router.get('/ambulance/nearest', asyncHandler(async (req, res) => {
  const data = await services.ambulance.getNearestAmbulance(
    parseFloat(req.query.lat as string),
    parseFloat(req.query.lng as string)
  );
  res.json(data);
}));

router.get('/hospitals/:hospitalId/capacity', asyncHandler(async (req, res) => {
  const data = await services.ambulance.checkHospitalCapacity(req.params.hospitalId);
  res.json(data);
}));

router.get('/ambulance/:ambulanceId/equipment', asyncHandler(async (req, res) => {
  const data = await services.ambulance.trackMedicalEquipment(req.params.ambulanceId);
  res.json(data);
}));

router.get('/ambulance/:ambulanceId/driver', asyncHandler(async (req, res) => {
  const data = await services.ambulance.getDriverInfo(req.params.ambulanceId);
  res.json(data);
}));

router.get('/patients/:patientId/emergencies', asyncHandler(async (req, res) => {
  const data = await services.ambulance.getEmergencyHistory(req.params.patientId);
  res.json(data);
}));

router.get('/insurance/coverage', asyncHandler(async (req, res) => {
  const data = await services.ambulance.checkInsuranceCoverage(
    req.query.patient as string,
    req.query.hospital as string
  );
  res.json(data);
}));

router.post('/ambulance/requests/:requestId/divert', asyncHandler(async (req, res) => {
  const data = await services.ambulance.divertToNearestHospital(req.params.requestId);
  res.json(data);
}));

router.post('/ambulance/requests/:requestId/handover', asyncHandler(async (req, res) => {
  const data = await services.ambulance.submitHandoverDocumentation(req.params.requestId, req.body);
  res.json(data);
}));

router.post('/ambulance/requests/:requestId/type', asyncHandler(async (req, res) => {
  const data = await services.ambulance.setEmergencyType(req.params.requestId, req.body.type);
  res.json(data);
}));

// ==================== NURSE ROUTES ====================
router.post('/nurses/:nurseId/patients/:patientId/care-plan', asyncHandler(async (req, res) => {
  const data = await services.nurse.createCarePlan(req.params.nurseId, req.params.patientId, req.body);
  res.json(data);
}));

router.post('/nurses/:nurseId/patients/:patientId/vitals', asyncHandler(async (req, res) => {
  const data = await services.nurse.recordVitals(req.params.nurseId, req.params.patientId, req.body);
  res.json(data);
}));

router.post('/nurses/:nurseId/patients/:patientId/medication-log', asyncHandler(async (req, res) => {
  const data = await services.nurse.logMedicationAdministration(
    req.params.nurseId,
    req.params.patientId,
    req.body
  );
  res.json(data);
}));

router.post('/nurses/:nurseId/patients/:patientId/wound-care', asyncHandler(async (req, res) => {
  const data = await services.nurse.documentWoundCare(
    req.params.nurseId,
    req.params.patientId,
    req.body
  );
  res.json(data);
}));

router.post('/nurses/:nurseId/patients/:patientId/wound-photo', asyncHandler(async (req, res) => {
  const data = await services.nurse.uploadWoundPhoto(req.params.nurseId, req.params.patientId, req.file);
  res.json(data);
}));

router.post('/nurses/:nurseId/schedule', asyncHandler(async (req, res) => {
  const data = await services.nurse.scheduleShift(req.params.nurseId, req.body);
  res.json(data);
}));

router.post('/nurses/:nurseId/assign-patient', asyncHandler(async (req, res) => {
  const data = await services.nurse.assignPatient(req.params.nurseId, req.body.patientId);
  res.json(data);
}));

router.post('/nurses/:nurseId/patients/:patientId/notes', asyncHandler(async (req, res) => {
  const data = await services.nurse.createNursingNote(req.params.nurseId, req.params.patientId, req.body);
  res.json(data);
}));

router.post('/nurses/:nurseId/patients/:patientId/iv-drip', asyncHandler(async (req, res) => {
  const data = await services.nurse.trackIVDrip(req.params.nurseId, req.params.patientId, req.body);
  res.json(data);
}));

router.get('/nurses/:nurseId/rota', asyncHandler(async (req, res) => {
  const data = await services.nurse.getShiftRota(req.params.nurseId);
  res.json(data);
}));

router.post('/nurses/:nurseId/shift/:shiftId/swap', asyncHandler(async (req, res) => {
  const data = await services.nurse.swapShift(
    req.params.nurseId,
    req.params.shiftId,
    req.body.targetNurse
  );
  res.json(data);
}));

// ==================== PAYMENT ROUTES ====================
router.post('/payments/process', asyncHandler(async (req, res) => {
  const data = await services.payment.processPayment(req.body.userId, req.body.amount, req.body.method);
  res.json(data);
}));

router.post('/payments/partial', asyncHandler(async (req, res) => {
  const data = await services.payment.processPartialPayment(
    req.body.userId,
    req.body.amount,
    req.body.method
  );
  res.json(data);
}));

router.post('/payments/installment-plan', asyncHandler(async (req, res) => {
  const data = await services.payment.setupInstallmentPlan(
    req.body.userId,
    req.body.amount,
    req.body.months
  );
  res.json(data);
}));

router.post('/payments/:transactionId/refund', asyncHandler(async (req, res) => {
  const data = await services.payment.processRefund(req.params.transactionId);
  res.json(data);
}));

router.get('/payments/:transactionId/receipt', asyncHandler(async (req, res) => {
  const data = await services.payment.getPaymentReceipt(req.params.transactionId);
  res.json(data);
}));

router.post('/payments/:transactionId/email-receipt', asyncHandler(async (req, res) => {
  const data = await services.payment.emailReceipt(req.params.transactionId, req.body.email);
  res.json(data);
}));

router.post('/payments/reminders/:userId', asyncHandler(async (req, res) => {
  const data = await services.payment.sendPaymentReminder(req.params.userId);
  res.json(data);
}));

router.post('/payments/:transactionId/dispute', asyncHandler(async (req, res) => {
  const data = await services.payment.handlePaymentDispute(req.params.transactionId, req.body.reason);
  res.json(data);
}));

router.post('/payments/split', asyncHandler(async (req, res) => {
  const data = await services.payment.splitPayment(req.body.userId, req.body.amount, req.body.splits);
  res.json(data);
}));

router.post('/payments/bill-lab', asyncHandler(async (req, res) => {
  const data = await services.payment.billLabSeperately(req.body.labTestId, req.body.labId);
  res.json(data);
}));

router.get('/payments/history/:userId', asyncHandler(async (req, res) => {
  const data = await services.payment.getPaymentHistory(req.params.userId);
  res.json(data);
}));

router.get('/wallet/:userId/balance', asyncHandler(async (req, res) => {
  const data = await services.payment.getWalletBalance(req.params.userId);
  res.json(data);
}));

router.post('/wallet/:userId/topup', asyncHandler(async (req, res) => {
  const data = await services.payment.topUpWallet(req.params.userId, req.body.amount);
  res.json(data);
}));

router.get('/payments/currency-rates', asyncHandler(async (req, res) => {
  const data = await services.payment.getMultiCurrencyRates();
  res.json(data);
}));

// ==================== INSURANCE ROUTES ====================
router.post('/insurance/nhis/verify', asyncHandler(async (req, res) => {
  const data = await services.insurance.verifyNHISLive(req.body.nhisNumber);
  res.json(data);
}));

router.post('/insurance/claims/:userId/submit', asyncHandler(async (req, res) => {
  const data = await services.insurance.submitClaim(req.params.userId, req.body);
  res.json(data);
}));

router.get('/insurance/eligibility', asyncHandler(async (req, res) => {
  const data = await services.insurance.checkEligibility(
    req.query.user as string,
    req.query.service as string
  );
  res.json(data);
}));

router.get('/insurance/coverage/:userId', asyncHandler(async (req, res) => {
  const data = await services.insurance.getCoverageLimits(req.params.userId);
  res.json(data);
}));

router.post('/insurance/pre-auth/:userId', asyncHandler(async (req, res) => {
  const data = await services.insurance.requestPreAuthorization(req.params.userId, req.body.serviceId);
  res.json(data);
}));

router.get('/insurance/claims/:claimId/status', asyncHandler(async (req, res) => {
  const data = await services.insurance.trackClaimStatus(req.params.claimId);
  res.json(data);
}));

router.post('/insurance/hmo/:userId', asyncHandler(async (req, res) => {
  const data = await services.insurance.selectHMO(req.params.userId, req.body.hmoId);
  res.json(data);
}));

router.get('/insurance/hmo-directory', asyncHandler(async (req, res) => {
  const data = await services.insurance.getHMODirectory();
  res.json(data);
}));

router.get('/insurance/copay', asyncHandler(async (req, res) => {
  const data = await services.insurance.calculateCopay(
    req.query.user as string,
    req.query.service as string
  );
  res.json(data);
}));

router.get('/insurance/card/:userId', asyncHandler(async (req, res) => {
  const data = await services.insurance.getInsuranceCard(req.params.userId);
  res.json(data);
}));

router.get('/insurance/card/:userId/qr', asyncHandler(async (req, res) => {
  const data = await services.insurance.generateQRCodeForCard(req.params.userId);
  res.json(data);
}));

router.get('/insurance/:insuranceId/hospitals', asyncHandler(async (req, res) => {
  const data = await services.insurance.getNetworkHospitals(req.params.insuranceId);
  res.json(data);
}));

router.get('/insurance/plans/compare', asyncHandler(async (req, res) => {
  const data = await services.insurance.comparePlans();
  res.json(data);
}));

router.get('/insurance/claims/history/:userId', asyncHandler(async (req, res) => {
  const data = await services.insurance.getClaimHistory(req.params.userId);
  res.json(data);
}));

// ==================== DONATIONS ROUTES ====================
router.get('/donations/blood/:bloodType/matches', asyncHandler(async (req, res) => {
  const data = await services.donations.matchBloodType(req.params.bloodType);
  res.json(data);
}));

router.post('/donations/register', asyncHandler(async (req, res) => {
  const data = await services.donations.registerDonor(req.body);
  res.json(data);
}));

router.get('/donations/organs/:patientId', asyncHandler(async (req, res) => {
  const data = await services.donations.getOrganDonationRegistry(req.params.patientId);
  res.json(data);
}));

router.get('/donations/history/:donorId', asyncHandler(async (req, res) => {
  const data = await services.donations.getDonationHistory(req.params.donorId);
  res.json(data);
}));

router.get('/donations/:donationId/tax-receipt', asyncHandler(async (req, res) => {
  const data = await services.donations.getTaxReceipt(req.params.donationId);
  res.json(data);
}));

router.post('/donations/:donorId/recurring', asyncHandler(async (req, res) => {
  const data = await services.donations.setupRecurringDonation(
    req.params.donorId,
    req.body.amount,
    req.body.frequency
  );
  res.json(data);
}));

router.post('/donations/fundraiser', asyncHandler(async (req, res) => {
  const data = await services.donations.createFundraiser(req.body);
  res.json(data);
}));

router.get('/donations/fundraiser/:fundraiserId/share-link', asyncHandler(async (req, res) => {
  const data = await services.donations.generateShareLink(req.params.fundraiserId);
  res.json(data);
}));

router.post('/donations/fundraiser/:fundraiserId/share', asyncHandler(async (req, res) => {
  const data = await services.donations.shareToSocialMedia(req.params.fundraiserId, req.body.platform);
  res.json(data);
}));

router.post('/donations/:donationId/anonymity', asyncHandler(async (req, res) => {
  const data = await services.donations.setDonorAnonymity(req.params.donationId, req.body.isAnonymous);
  res.json(data);
}));

router.get('/donations/fundraiser/:fundraiserId/milestone', asyncHandler(async (req, res) => {
  const data = await services.donations.getMilestoneNotification(req.params.fundraiserId);
  res.json(data);
}));

router.get('/donations/leaderboard', asyncHandler(async (req, res) => {
  const data = await services.donations.getDonorLeaderboard();
  res.json(data);
}));

router.get('/donations/fundraiser/:fundraiserId/story', asyncHandler(async (req, res) => {
  const data = await services.donations.viewPatientStory(req.params.fundraiserId);
  res.json(data);
}));

router.get('/donations/:donationId/impact', asyncHandler(async (req, res) => {
  const data = await services.donations.trackImpact(req.params.donationId);
  res.json(data);
}));

// ==================== APPOINTMENTS ROUTES ====================
router.get('/appointments/availability', asyncHandler(async (req, res) => {
  const data = await services.appointments.getProviderAvailability(
    req.query.provider as string,
    req.query.date as string
  );
  res.json(data);
}));

router.post('/appointments/book', asyncHandler(async (req, res) => {
  const data = await services.appointments.bookAppointment(req.body);
  res.json(data);
}));

router.put('/appointments/:appointmentId/reschedule', asyncHandler(async (req, res) => {
  const data = await services.appointments.rescheduleAppointment(
    req.params.appointmentId,
    req.body.newDate,
    req.body.newTime
  );
  res.json(data);
}));

router.delete('/appointments/:appointmentId', asyncHandler(async (req, res) => {
  const data = await services.appointments.cancelAppointment(req.params.appointmentId);
  res.json(data);
}));

router.get('/appointments/next-slot', asyncHandler(async (req, res) => {
  const data = await services.appointments.getNextAvailableSlot(req.query.provider as string);
  res.json(data);
}));

router.post('/appointments/waitlist/:providerId', asyncHandler(async (req, res) => {
  const data = await services.appointments.joinWaitlist(req.params.providerId);
  res.json(data);
}));

router.post('/appointments/compare', asyncHandler(async (req, res) => {
  const data = await services.appointments.compareProviders(req.body.providerIds);
  res.json(data);
}));

router.get('/appointments/:appointmentId/reminder', asyncHandler(async (req, res) => {
  const data = await services.appointments.getAppointmentReminder(req.params.appointmentId);
  res.json(data);
}));

router.post('/appointments/:appointmentId/type', asyncHandler(async (req, res) => {
  const data = await services.appointments.setAppointmentType(req.params.appointmentId, req.body.type);
  res.json(data);
}));

router.post('/appointments/:appointmentId/questionnaire', asyncHandler(async (req, res) => {
  const data = await services.appointments.submitPreVisitQuestionnaire(req.params.appointmentId, req.body);
  res.json(data);
}));

router.get('/appointments/:appointmentId/video-link', asyncHandler(async (req, res) => {
  const data = await services.appointments.getVideoCallLink(req.params.appointmentId);
  res.json(data);
}));

router.post('/appointments/:appointmentId/sync-calendar', asyncHandler(async (req, res) => {
  const data = await services.appointments.syncToCalendar(req.params.appointmentId);
  res.json(data);
}));

router.post('/appointments/dependent/:dependentId/book', asyncHandler(async (req, res) => {
  const data = await services.appointments.bookForDependent(req.params.dependentId, req.body);
  res.json(data);
}));

router.get('/appointments/:appointmentId/prep', asyncHandler(async (req, res) => {
  const data = await services.appointments.getPrepInstructions(req.params.appointmentId);
  res.json(data);
}));

router.get('/providers/:providerId/location', asyncHandler(async (req, res) => {
  const data = await services.appointments.getProviderLocation(req.params.providerId);
  res.json(data);
}));

router.get('/appointments/:appointmentId/recurring-options', asyncHandler(async (req, res) => {
  const data = await services.appointments.getRecurringAppointmentOptions(req.params.appointmentId);
  res.json(data);
}));

router.post('/appointments/group-book', asyncHandler(async (req, res) => {
  const data = await services.appointments.bookGroupAppointment(req.body);
  res.json(data);
}));

// ==================== MESSAGING ROUTES ====================
router.post('/messaging/:conversationId/send', asyncHandler(async (req, res) => {
  const data = await services.messaging.sendMessage(req.params.conversationId, req.body.message);
  res.json(data);
}));

router.post('/messaging/:conversationId/file', asyncHandler(async (req, res) => {
  const data = await services.messaging.uploadFile(req.params.conversationId, req.file);
  res.json(data);
}));

router.post('/messaging/:conversationId/voice', asyncHandler(async (req, res) => {
  const data = await services.messaging.sendVoiceMessage(req.params.conversationId, req.file.buffer);
  res.json(data);
}));

router.post('/messages/:messageId/read', asyncHandler(async (req, res) => {
  const data = await services.messaging.markMessageAsRead(req.params.messageId);
  res.json(data);
}));

router.get('/messaging/:conversationId/search', asyncHandler(async (req, res) => {
  const data = await services.messaging.searchMessages(req.params.conversationId, req.query.q as string);
  res.json(data);
}));

router.post('/messaging/group-chat', asyncHandler(async (req, res) => {
  const data = await services.messaging.createGroupChat(req.body.participants);
  res.json(data);
}));

router.post('/messages/:messageId/translate', asyncHandler(async (req, res) => {
  const data = await services.messaging.translateMessage(req.params.messageId, req.body.language);
  res.json(data);
}));

router.post('/messaging/auto-reply', asyncHandler(async (req, res) => {
  const data = await services.messaging.setAutoReply(req.body.message);
  res.json(data);
}));

router.get('/messaging/:conversationId/history', asyncHandler(async (req, res) => {
  const data = await services.messaging.getConversationHistory(req.params.conversationId);
  res.json(data);
}));

router.post('/messaging/encrypt', asyncHandler(async (req, res) => {
  const data = await services.messaging.encryptMessage(req.body.message);
  res.json(data);
}));

// ==================== NOTIFICATIONS ROUTES ====================
router.post('/notifications/:userId/push', asyncHandler(async (req, res) => {
  const data = await services.notifications.sendPushNotification(req.params.userId, req.body);
  res.json(data);
}));

router.post('/notifications/:userId/sms', asyncHandler(async (req, res) => {
  const data = await services.notifications.sendSMSNotification(req.params.userId, req.body.message);
  res.json(data);
}));

router.post('/notifications/:userId/email', asyncHandler(async (req, res) => {
  const data = await services.notifications.sendEmailNotification(
    req.params.userId,
    req.body.subject,
    req.body.body
  );
  res.json(data);
}));

router.put('/notifications/:userId/preferences', asyncHandler(async (req, res) => {
  const data = await services.notifications.setNotificationPreferences(req.params.userId, req.body);
  res.json(data);
}));

router.get('/notifications/:userId/history', asyncHandler(async (req, res) => {
  const data = await services.notifications.getNotificationHistory(req.params.userId);
  res.json(data);
}));

router.post('/notifications/:notificationId/read', asyncHandler(async (req, res) => {
  const data = await services.notifications.markNotificationAsRead(req.params.notificationId);
  res.json(data);
}));

router.post('/notifications/:userId/schedule', asyncHandler(async (req, res) => {
  const data = await services.notifications.scheduleNotification(
    req.params.userId,
    req.body.notification,
    req.body.scheduledTime
  );
  res.json(data);
}));

// ==================== ADMIN ROUTES ====================
router.post('/admin/providers/:providerId/verify', asyncHandler(async (req, res) => {
  const data = await services.admin.verifyProvider(req.params.providerId, req.body.verified);
  res.json(data);
}));

router.post('/admin/licenses/verify', asyncHandler(async (req, res) => {
  const data = await services.admin.verifyLicense(req.body.licenseNumber);
  res.json(data);
}));

router.post('/admin/providers/:providerId/documents', asyncHandler(async (req, res) => {
  const data = await services.admin.uploadProviderDocument(req.params.providerId, req.file);
  res.json(data);
}));

router.get('/admin/audit-log', asyncHandler(async (req, res) => {
  const data = await services.admin.getAuditLog(req.query);
  res.json(data);
}));

router.post('/admin/bulk-import', asyncHandler(async (req, res) => {
  const data = await services.admin.bulkImportUsers(req.file);
  res.json(data);
}));

router.get('/admin/users/:userId/activity', asyncHandler(async (req, res) => {
  const data = await services.admin.getUserActivityLog(req.params.userId);
  res.json(data);
}));

router.post('/admin/export', asyncHandler(async (req, res) => {
  const data = await services.admin.exportData(req.body.reportType, req.body.format);
  res.json(data);
}));

router.get('/admin/regulatory/:reportType', asyncHandler(async (req, res) => {
  const data = await services.admin.generateRegulatoryReport(req.params.reportType);
  res.json(data);
}));

router.post('/admin/users/:userId/suspend', asyncHandler(async (req, res) => {
  const data = await services.admin.suspendUser(req.params.userId);
  res.json(data);
}));

router.get('/admin/system-stats', asyncHandler(async (req, res) => {
  const data = await services.admin.getSystemStats();
  res.json(data);
}));

router.get('/admin/metrics', asyncHandler(async (req, res) => {
  const data = await services.admin.getDashboardMetrics();
  res.json(data);
}));

export default router;
