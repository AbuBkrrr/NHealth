// Complete Module Services - All 13 modules
// Used by backend routes and frontend pages

import axios from 'axios';

// ==================== PATIENT SERVICE ====================
export class PatientService {
  private static instance: PatientService;

  static getInstance() {
    if (!PatientService.instance) {
      PatientService.instance = new PatientService();
    }
    return PatientService.instance;
  }

  async getMedicalHistory(patientId: string) {
    return axios.get(`/api/patients/${patientId}/medical-history`);
  }

  async updateMedicalHistory(patientId: string, data: any) {
    return axios.put(`/api/patients/${patientId}/medical-history`, data);
  }

  async getAllergies(patientId: string) {
    return axios.get(`/api/patients/${patientId}/allergies`);
  }

  async addAllergy(patientId: string, allergy: string) {
    return axios.post(`/api/patients/${patientId}/allergies`, { allergy });
  }

  async getCurrentMedications(patientId: string) {
    return axios.get(`/api/patients/${patientId}/medications`);
  }

  async addMedication(patientId: string, medication: any) {
    return axios.post(`/api/patients/${patientId}/medications`, medication);
  }

  async getEmergencyContact(patientId: string) {
    return axios.get(`/api/patients/${patientId}/emergency-contact`);
  }

  async updateEmergencyContact(patientId: string, contact: any) {
    return axios.put(`/api/patients/${patientId}/emergency-contact`, contact);
  }

  async addDependent(patientId: string, dependent: any) {
    return axios.post(`/api/patients/${patientId}/dependents`, dependent);
  }

  async getDependents(patientId: string) {
    return axios.get(`/api/patients/${patientId}/dependents`);
  }

  async uploadHealthRecord(patientId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`/api/patients/${patientId}/records`, formData);
  }

  async getHealthRecords(patientId: string) {
    return axios.get(`/api/patients/${patientId}/records`);
  }

  async trackVitals(patientId: string, vitals: any) {
    return axios.post(`/api/patients/${patientId}/vitals`, vitals);
  }

  async getVitalsTrend(patientId: string, days: number = 30) {
    return axios.get(`/api/patients/${patientId}/vitals?days=${days}`);
  }

  async getFavoriteProviders(patientId: string) {
    return axios.get(`/api/patients/${patientId}/favorites`);
  }

  async addFavoriteProvider(patientId: string, providerId: string) {
    return axios.post(`/api/patients/${patientId}/favorites`, { providerId });
  }
}

// ==================== DOCTOR SERVICE ====================
export class DoctorService {
  private static instance: DoctorService;

  static getInstance() {
    if (!DoctorService.instance) {
      DoctorService.instance = new DoctorService();
    }
    return DoctorService.instance;
  }

  async getPatientNotes(doctorId: string, patientId: string) {
    return axios.get(`/api/doctors/${doctorId}/patients/${patientId}/notes`);
  }

  async createPatientNote(doctorId: string, patientId: string, note: any) {
    return axios.post(`/api/doctors/${doctorId}/patients/${patientId}/notes`, note);
  }

  async getPatientHistory(doctorId: string, patientId: string) {
    return axios.get(`/api/doctors/${doctorId}/patients/${patientId}/history`);
  }

  async createDiagnosis(doctorId: string, patientId: string, diagnosis: any) {
    return axios.post(`/api/doctors/${doctorId}/patients/${patientId}/diagnosis`, diagnosis);
  }

  async orderLabTest(doctorId: string, patientId: string, test: any) {
    return axios.post(`/api/doctors/${doctorId}/patients/${patientId}/lab-tests`, test);
  }

  async createReferral(doctorId: string, patientId: string, referral: any) {
    return axios.post(`/api/doctors/${doctorId}/patients/${patientId}/referrals`, referral);
  }

  async createPrescription(doctorId: string, patientId: string, prescription: any) {
    return axios.post(`/api/doctors/${doctorId}/patients/${patientId}/prescriptions`, prescription);
  }

  async getPrescriptionTemplates(doctorId: string) {
    return axios.get(`/api/doctors/${doctorId}/prescription-templates`);
  }

  async recordVitals(doctorId: string, patientId: string, vitals: any) {
    return axios.post(`/api/doctors/${doctorId}/patients/${patientId}/vitals`, vitals);
  }

  async checkDrugInteractions(drugs: string[]) {
    return axios.post(`/api/drugs/interactions`, { drugs });
  }

  async scheduleFollowUp(doctorId: string, patientId: string, followUp: any) {
    return axios.post(`/api/doctors/${doctorId}/patients/${patientId}/follow-up`, followUp);
  }

  async getEarningsBreakdown(doctorId: string, startDate: string, endDate: string) {
    return axios.get(
      `/api/doctors/${doctorId}/earnings?start=${startDate}&end=${endDate}`
    );
  }

  async getTaxReport(doctorId: string, year: number) {
    return axios.get(`/api/doctors/${doctorId}/tax-report?year=${year}`);
  }

  async trackCPD(doctorId: string, course: any) {
    return axios.post(`/api/doctors/${doctorId}/cpd`, course);
  }

  async getConsultationStats(doctorId: string) {
    return axios.get(`/api/doctors/${doctorId}/stats`);
  }
}

// ==================== PHARMACY SERVICE ====================
export class PharmacyService {
  private static instance: PharmacyService;

  static getInstance() {
    if (!PharmacyService.instance) {
      PharmacyService.instance = new PharmacyService();
    }
    return PharmacyService.instance;
  }

  async checkDrugExpiry(drugId: string) {
    return axios.get(`/api/pharmacy/drugs/${drugId}/expiry`);
  }

  async getAllExpiringDrugs(pharmacyId: string) {
    return axios.get(`/api/pharmacy/${pharmacyId}/expiring-drugs`);
  }

  async trackBatchNumber(batchNumber: string) {
    return axios.get(`/api/pharmacy/batch/${batchNumber}`);
  }

  async verifyPrescription(prescriptionId: string) {
    return axios.post(`/api/pharmacy/prescriptions/${prescriptionId}/verify`);
  }

  async checkNAFDACNumber(drugId: string) {
    return axios.get(`/api/pharmacy/drugs/${drugId}/nafdac-verify`);
  }

  async generatePurchaseOrder(pharmacyId: string, items: any[]) {
    return axios.post(`/api/pharmacy/${pharmacyId}/purchase-orders`, { items });
  }

  async setupReorderAutomation(pharmacyId: string, rules: any) {
    return axios.post(`/api/pharmacy/${pharmacyId}/reorder-rules`, rules);
  }

  async trackDelivery(orderId: string) {
    return axios.get(`/api/pharmacy/deliveries/${orderId}`);
  }

  async processPartialFulfillment(orderId: string, items: any[]) {
    return axios.post(`/api/pharmacy/orders/${orderId}/partial-fulfillment`, { items });
  }

  async processReturn(orderId: string, items: any[]) {
    return axios.post(`/api/pharmacy/orders/${orderId}/return`, { items });
  }

  async getLoyaltyProgram(pharmacyId: string) {
    return axios.get(`/api/pharmacy/${pharmacyId}/loyalty`);
  }

  async manageBranch(pharmacyId: string, branchData: any) {
    return axios.post(`/api/pharmacy/${pharmacyId}/branches`, branchData);
  }

  async transferStockBetweenBranches(fromBranch: string, toBranch: string, items: any[]) {
    return axios.post(`/api/pharmacy/stock-transfer`, {
      from: fromBranch,
      to: toBranch,
      items,
    });
  }

  async getInventoryAlerts(pharmacyId: string) {
    return axios.get(`/api/pharmacy/${pharmacyId}/inventory-alerts`);
  }
}

// ==================== LAB SERVICE ====================
export class LabService {
  private static instance: LabService;

  static getInstance() {
    if (!LabService.instance) {
      LabService.instance = new LabService();
    }
    return LabService.instance;
  }

  async getTestCatalog(labId: string) {
    return axios.get(`/api/lab/${labId}/tests`);
  }

  async addTestToCatalog(labId: string, test: any) {
    return axios.post(`/api/lab/${labId}/tests`, test);
  }

  async getReferenceRanges(testId: string) {
    return axios.get(`/api/lab/tests/${testId}/reference-ranges`);
  }

  async uploadLabResult(labId: string, result: any) {
    return axios.post(`/api/lab/${labId}/results`, result);
  }

  async flagResultAsAbnormal(resultId: string, flag: 'H' | 'L') {
    return axios.post(`/api/lab/results/${resultId}/flag`, { flag });
  }

  async getResultHistory(patientId: string, testId: string) {
    return axios.get(`/api/lab/patients/${patientId}/tests/${testId}/history`);
  }

  async scheduleCollectionAtHome(labId: string, booking: any) {
    return axios.post(`/api/lab/${labId}/home-collection`, booking);
  }

  async trackSampleByBarcode(barcodeNumber: string) {
    return axios.get(`/api/lab/samples/${barcodeNumber}`);
  }

  async verifyResultByPathologist(resultId: string, verified: boolean) {
    return axios.post(`/api/lab/results/${resultId}/verify`, { verified });
  }

  async setCriticalValueAlert(resultId: string) {
    return axios.post(`/api/lab/results/${resultId}/critical-alert`);
  }

  async attachImageToResult(resultId: string, file: File) {
    const formData = new FormData();
    formData.append('image', file);
    return axios.post(`/api/lab/results/${resultId}/attach-image`, formData);
  }

  async getLabAccreditation(labId: string) {
    return axios.get(`/api/lab/${labId}/accreditation`);
  }

  async compareResultsOverTime(patientId: string, testId: string) {
    return axios.get(`/api/lab/patients/${patientId}/tests/${testId}/comparison`);
  }
}

// ==================== AMBULANCE SERVICE ====================
export class AmbulanceService {
  private static instance: AmbulanceService;

  static getInstance() {
    if (!AmbulanceService.instance) {
      AmbulanceService.instance = new AmbulanceService();
    }
    return AmbulanceService.instance;
  }

  async requestAmbulance(location: any, emergencyType: string) {
    return axios.post('/api/ambulance/request', { location, emergencyType });
  }

  async trackAmbulanceRealtime(requestId: string) {
    return axios.get(`/api/ambulance/requests/${requestId}/tracking`);
  }

  async getNearestAmbulance(lat: number, lng: number) {
    return axios.get(`/api/ambulance/nearest?lat=${lat}&lng=${lng}`);
  }

  async checkHospitalCapacity(hospitalId: string) {
    return axios.get(`/api/hospitals/${hospitalId}/capacity`);
  }

  async trackMedicalEquipment(ambulanceId: string) {
    return axios.get(`/api/ambulance/${ambulanceId}/equipment`);
  }

  async getDriverInfo(ambulanceId: string) {
    return axios.get(`/api/ambulance/${ambulanceId}/driver`);
  }

  async getEmergencyHistory(patientId: string) {
    return axios.get(`/api/patients/${patientId}/emergencies`);
  }

  async checkInsuranceCoverage(patientId: string, hospitalId: string) {
    return axios.get(
      `/api/insurance/coverage?patient=${patientId}&hospital=${hospitalId}`
    );
  }

  async divertToNearestHospital(requestId: string) {
    return axios.post(`/api/ambulance/requests/${requestId}/divert`);
  }

  async submitHandoverDocumentation(requestId: string, docs: any) {
    return axios.post(`/api/ambulance/requests/${requestId}/handover`, docs);
  }

  async setEmergencyType(requestId: string, type: string) {
    return axios.post(`/api/ambulance/requests/${requestId}/type`, { type });
  }
}

// ==================== NURSE SERVICE ====================
export class NurseService {
  private static instance: NurseService;

  static getInstance() {
    if (!NurseService.instance) {
      NurseService.instance = new NurseService();
    }
    return NurseService.instance;
  }

  async createCarePlan(nurseId: string, patientId: string, plan: any) {
    return axios.post(`/api/nurses/${nurseId}/patients/${patientId}/care-plan`, plan);
  }

  async recordVitals(nurseId: string, patientId: string, vitals: any) {
    return axios.post(`/api/nurses/${nurseId}/patients/${patientId}/vitals`, vitals);
  }

  async logMedicationAdministration(nurseId: string, patientId: string, medication: any) {
    return axios.post(
      `/api/nurses/${nurseId}/patients/${patientId}/medication-log`,
      medication
    );
  }

  async documentWoundCare(nurseId: string, patientId: string, documentation: any) {
    return axios.post(
      `/api/nurses/${nurseId}/patients/${patientId}/wound-care`,
      documentation
    );
  }

  async uploadWoundPhoto(nurseId: string, patientId: string, file: File) {
    const formData = new FormData();
    formData.append('photo', file);
    return axios.post(
      `/api/nurses/${nurseId}/patients/${patientId}/wound-photo`,
      formData
    );
  }

  async scheduleShift(nurseId: string, shift: any) {
    return axios.post(`/api/nurses/${nurseId}/schedule`, shift);
  }

  async assignPatient(nurseId: string, patientId: string) {
    return axios.post(`/api/nurses/${nurseId}/assign-patient`, { patientId });
  }

  async createNursingNote(nurseId: string, patientId: string, note: any) {
    return axios.post(`/api/nurses/${nurseId}/patients/${patientId}/notes`, note);
  }

  async trackIVDrip(nurseId: string, patientId: string, infusion: any) {
    return axios.post(`/api/nurses/${nurseId}/patients/${patientId}/iv-drip`, infusion);
  }

  async getShiftRota(nurseId: string) {
    return axios.get(`/api/nurses/${nurseId}/rota`);
  }

  async swapShift(nurseId: string, shiftId: string, targetNurse: string) {
    return axios.post(`/api/nurses/${nurseId}/shift/${shiftId}/swap`, {
      targetNurse,
    });
  }
}

// ==================== PAYMENT SERVICE ====================
export class PaymentService {
  private static instance: PaymentService;

  static getInstance() {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  async processPayment(userId: string, amount: number, method: string) {
    return axios.post('/api/payments/process', { userId, amount, method });
  }

  async processPartialPayment(userId: string, amount: number, method: string) {
    return axios.post('/api/payments/partial', { userId, amount, method });
  }

  async setupInstallmentPlan(userId: string, amount: number, months: number) {
    return axios.post('/api/payments/installment-plan', {
      userId,
      amount,
      months,
    });
  }

  async processRefund(transactionId: string) {
    return axios.post(`/api/payments/${transactionId}/refund`);
  }

  async getPaymentReceipt(transactionId: string) {
    return axios.get(`/api/payments/${transactionId}/receipt`);
  }

  async emailReceipt(transactionId: string, email: string) {
    return axios.post(`/api/payments/${transactionId}/email-receipt`, { email });
  }

  async sendPaymentReminder(userId: string) {
    return axios.post(`/api/payments/reminders/${userId}`);
  }

  async handlePaymentDispute(transactionId: string, reason: string) {
    return axios.post(`/api/payments/${transactionId}/dispute`, { reason });
  }

  async splitPayment(userId: string, amount: number, splits: any[]) {
    return axios.post('/api/payments/split', { userId, amount, splits });
  }

  async billLabSeperately(labTestId: string, labId: string) {
    return axios.post('/api/payments/bill-lab', { labTestId, labId });
  }

  async getPaymentHistory(userId: string) {
    return axios.get(`/api/payments/history/${userId}`);
  }

  async getWalletBalance(userId: string) {
    return axios.get(`/api/wallet/${userId}/balance`);
  }

  async topUpWallet(userId: string, amount: number) {
    return axios.post(`/api/wallet/${userId}/topup`, { amount });
  }

  async getMultiCurrencyRates() {
    return axios.get('/api/payments/currency-rates');
  }
}

// ==================== INSURANCE SERVICE ====================
export class InsuranceService {
  private static instance: InsuranceService;

  static getInstance() {
    if (!InsuranceService.instance) {
      InsuranceService.instance = new InsuranceService();
    }
    return InsuranceService.instance;
  }

  async verifyNHISLive(nhisNumber: string) {
    return axios.post('/api/insurance/nhis/verify', { nhisNumber });
  }

  async submitClaim(userId: string, claimData: any) {
    return axios.post(`/api/insurance/claims/${userId}/submit`, claimData);
  }

  async checkEligibility(userId: string, serviceType: string) {
    return axios.get(
      `/api/insurance/eligibility?user=${userId}&service=${serviceType}`
    );
  }

  async getCoverageLimits(userId: string) {
    return axios.get(`/api/insurance/coverage/${userId}`);
  }

  async requestPreAuthorization(userId: string, serviceId: string) {
    return axios.post(`/api/insurance/pre-auth/${userId}`, { serviceId });
  }

  async trackClaimStatus(claimId: string) {
    return axios.get(`/api/insurance/claims/${claimId}/status`);
  }

  async selectHMO(userId: string, hmoId: string) {
    return axios.post(`/api/insurance/hmo/${userId}`, { hmoId });
  }

  async getHMODirectory() {
    return axios.get('/api/insurance/hmo-directory');
  }

  async calculateCopay(userId: string, serviceId: string) {
    return axios.get(
      `/api/insurance/copay?user=${userId}&service=${serviceId}`
    );
  }

  async getInsuranceCard(userId: string) {
    return axios.get(`/api/insurance/card/${userId}`);
  }

  async generateQRCodeForCard(userId: string) {
    return axios.get(`/api/insurance/card/${userId}/qr`);
  }

  async getNetworkHospitals(insuranceId: string) {
    return axios.get(`/api/insurance/${insuranceId}/hospitals`);
  }

  async comparePlans() {
    return axios.get('/api/insurance/plans/compare');
  }

  async getClaimHistory(userId: string) {
    return axios.get(`/api/insurance/claims/history/${userId}`);
  }
}

// ==================== DONATIONS SERVICE ====================
export class DonationsService {
  private static instance: DonationsService;

  static getInstance() {
    if (!DonationsService.instance) {
      DonationsService.instance = new DonationsService();
    }
    return DonationsService.instance;
  }

  async matchBloodType(bloodType: string) {
    return axios.get(`/api/donations/blood/${bloodType}/matches`);
  }

  async registerDonor(donorData: any) {
    return axios.post('/api/donations/register', donorData);
  }

  async getOrganDonationRegistry(patientId: string) {
    return axios.get(`/api/donations/organs/${patientId}`);
  }

  async getDonationHistory(donorId: string) {
    return axios.get(`/api/donations/history/${donorId}`);
  }

  async getTaxReceipt(donationId: string) {
    return axios.get(`/api/donations/${donationId}/tax-receipt`);
  }

  async setupRecurringDonation(donorId: string, amount: number, frequency: string) {
    return axios.post(`/api/donations/${donorId}/recurring`, {
      amount,
      frequency,
    });
  }

  async createFundraiser(fundraiserData: any) {
    return axios.post('/api/donations/fundraiser', fundraiserData);
  }

  async generateShareLink(fundraiserId: string) {
    return axios.get(`/api/donations/fundraiser/${fundraiserId}/share-link`);
  }

  async shareToSocialMedia(fundraiserId: string, platform: string) {
    return axios.post(`/api/donations/fundraiser/${fundraiserId}/share`, {
      platform,
    });
  }

  async setDonorAnonymity(donationId: string, isAnonymous: boolean) {
    return axios.post(`/api/donations/${donationId}/anonymity`, {
      isAnonymous,
    });
  }

  async getMilestoneNotification(fundraiserId: string) {
    return axios.get(`/api/donations/fundraiser/${fundraiserId}/milestone`);
  }

  async getDonorLeaderboard() {
    return axios.get('/api/donations/leaderboard');
  }

  async viewPatientStory(fundraiserId: string) {
    return axios.get(`/api/donations/fundraiser/${fundraiserId}/story`);
  }

  async trackImpact(donationId: string) {
    return axios.get(`/api/donations/${donationId}/impact`);
  }
}

// ==================== APPOINTMENTS SERVICE ====================
export class AppointmentsService {
  private static instance: AppointmentsService;

  static getInstance() {
    if (!AppointmentsService.instance) {
      AppointmentsService.instance = new AppointmentsService();
    }
    return AppointmentsService.instance;
  }

  async getProviderAvailability(providerId: string, date: string) {
    return axios.get(
      `/api/appointments/availability?provider=${providerId}&date=${date}`
    );
  }

  async bookAppointment(appointmentData: any) {
    return axios.post('/api/appointments/book', appointmentData);
  }

  async rescheduleAppointment(appointmentId: string, newDate: string, newTime: string) {
    return axios.put(`/api/appointments/${appointmentId}/reschedule`, {
      newDate,
      newTime,
    });
  }

  async cancelAppointment(appointmentId: string) {
    return axios.delete(`/api/appointments/${appointmentId}`);
  }

  async getNextAvailableSlot(providerId: string) {
    return axios.get(`/api/appointments/next-slot?provider=${providerId}`);
  }

  async joinWaitlist(providerId: string) {
    return axios.post(`/api/appointments/waitlist/${providerId}`);
  }

  async compareProviders(providerIds: string[]) {
    return axios.post('/api/appointments/compare', { providerIds });
  }

  async getAppointmentReminder(appointmentId: string) {
    return axios.get(`/api/appointments/${appointmentId}/reminder`);
  }

  async setAppointmentType(appointmentId: string, type: 'in-person' | 'telehealth') {
    return axios.post(`/api/appointments/${appointmentId}/type`, { type });
  }

  async submitPreVisitQuestionnaire(appointmentId: string, answers: any) {
    return axios.post(
      `/api/appointments/${appointmentId}/questionnaire`,
      answers
    );
  }

  async getVideoCallLink(appointmentId: string) {
    return axios.get(`/api/appointments/${appointmentId}/video-link`);
  }

  async syncToCalendar(appointmentId: string) {
    return axios.post(`/api/appointments/${appointmentId}/sync-calendar`);
  }

  async bookForDependent(dependentId: string, appointmentData: any) {
    return axios.post(`/api/appointments/dependent/${dependentId}/book`, appointmentData);
  }

  async getPrepInstructions(appointmentId: string) {
    return axios.get(`/api/appointments/${appointmentId}/prep`);
  }

  async getProviderLocation(providerId: string) {
    return axios.get(`/api/providers/${providerId}/location`);
  }

  async getRecurringAppointmentOptions(appointmentId: string) {
    return axios.get(`/api/appointments/${appointmentId}/recurring-options`);
  }

  async bookGroupAppointment(groupData: any) {
    return axios.post('/api/appointments/group-book', groupData);
  }
}

// ==================== MESSAGING SERVICE ====================
export class MessagingService {
  private static instance: MessagingService;

  static getInstance() {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService();
    }
    return MessagingService.instance;
  }

  async sendMessage(conversationId: string, message: string) {
    return axios.post(`/api/messaging/${conversationId}/send`, { message });
  }

  async uploadFile(conversationId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post(`/api/messaging/${conversationId}/file`, formData);
  }

  async sendVoiceMessage(conversationId: string, audioBlob: Blob) {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    return axios.post(`/api/messaging/${conversationId}/voice`, formData);
  }

  async markMessageAsRead(messageId: string) {
    return axios.post(`/api/messages/${messageId}/read`);
  }

  async searchMessages(conversationId: string, query: string) {
    return axios.get(`/api/messaging/${conversationId}/search?q=${query}`);
  }

  async createGroupChat(participants: string[]) {
    return axios.post('/api/messaging/group-chat', { participants });
  }

  async translateMessage(messageId: string, language: string) {
    return axios.post(`/api/messages/${messageId}/translate`, { language });
  }

  async setAutoReply(message: string) {
    return axios.post('/api/messaging/auto-reply', { message });
  }

  async getConversationHistory(conversationId: string) {
    return axios.get(`/api/messaging/${conversationId}/history`);
  }

  async encryptMessage(message: string) {
    return axios.post('/api/messaging/encrypt', { message });
  }
}

// ==================== NOTIFICATIONS SERVICE ====================
export class NotificationsService {
  private static instance: NotificationsService;

  static getInstance() {
    if (!NotificationsService.instance) {
      NotificationsService.instance = new NotificationsService();
    }
    return NotificationsService.instance;
  }

  async sendPushNotification(userId: string, notification: any) {
    return axios.post(`/api/notifications/${userId}/push`, notification);
  }

  async sendSMSNotification(userId: string, message: string) {
    return axios.post(`/api/notifications/${userId}/sms`, { message });
  }

  async sendEmailNotification(userId: string, subject: string, body: string) {
    return axios.post(`/api/notifications/${userId}/email`, { subject, body });
  }

  async setNotificationPreferences(userId: string, preferences: any) {
    return axios.put(`/api/notifications/${userId}/preferences`, preferences);
  }

  async getNotificationHistory(userId: string) {
    return axios.get(`/api/notifications/${userId}/history`);
  }

  async markNotificationAsRead(notificationId: string) {
    return axios.post(`/api/notifications/${notificationId}/read`);
  }

  async scheduleNotification(userId: string, notification: any, scheduledTime: string) {
    return axios.post(`/api/notifications/${userId}/schedule`, {
      notification,
      scheduledTime,
    });
  }
}

// ==================== ADMIN SERVICE ====================
export class AdminService {
  private static instance: AdminService;

  static getInstance() {
    if (!AdminService.instance) {
      AdminService.instance = new AdminService();
    }
    return AdminService.instance;
  }

  async verifyProvider(providerId: string, verified: boolean) {
    return axios.post(`/api/admin/providers/${providerId}/verify`, { verified });
  }

  async verifyLicense(licenseNumber: string) {
    return axios.post('/api/admin/licenses/verify', { licenseNumber });
  }

  async uploadProviderDocument(providerId: string, file: File) {
    const formData = new FormData();
    formData.append('document', file);
    return axios.post(`/api/admin/providers/${providerId}/documents`, formData);
  }

  async getAuditLog(filters?: any) {
    return axios.get('/api/admin/audit-log', { params: filters });
  }

  async bulkImportUsers(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return axios.post('/api/admin/bulk-import', formData);
  }

  async getUserActivityLog(userId: string) {
    return axios.get(`/api/admin/users/${userId}/activity`);
  }

  async exportData(reportType: string, format: 'csv' | 'pdf') {
    return axios.post('/api/admin/export', { reportType, format });
  }

  async generateRegulatoryReport(reportType: string) {
    return axios.get(`/api/admin/regulatory/${reportType}`);
  }

  async suspendUser(userId: string) {
    return axios.post(`/api/admin/users/${userId}/suspend`);
  }

  async getSystemStats() {
    return axios.get('/api/admin/system-stats');
  }

  async getDashboardMetrics() {
    return axios.get('/api/admin/metrics');
  }
}

// Export all services
export const services = {
  patient: PatientService.getInstance(),
  doctor: DoctorService.getInstance(),
  pharmacy: PharmacyService.getInstance(),
  lab: LabService.getInstance(),
  ambulance: AmbulanceService.getInstance(),
  nurse: NurseService.getInstance(),
  payment: PaymentService.getInstance(),
  insurance: InsuranceService.getInstance(),
  donations: DonationsService.getInstance(),
  appointments: AppointmentsService.getInstance(),
  messaging: MessagingService.getInstance(),
  notifications: NotificationsService.getInstance(),
  admin: AdminService.getInstance(),
};

export default services;
