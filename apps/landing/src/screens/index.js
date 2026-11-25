// Route table: every screen of the app, guarded by role.
import { route } from '../lib/router.js';
import { authScreen } from './auth.js';
import * as S from './shared.js';
import * as P from './patient.js';
import * as V from './providers.js';

const PATIENT = ['PATIENT'];
const PROVIDERS = ['DOCTOR', 'NURSE', 'LAB', 'PHARMACY', 'AMBULANCE', 'INSTITUTION'];

// Public
route('/auth', authScreen, { public: true, nav: false });
route('/e/:token', P.publicCardScreen, { public: true, nav: false });

// Shared (all roles)
route('/notifications', S.notificationsScreen);
route('/messages', S.messagesScreen);
route('/chat/:id', S.chatScreen, { nav: false });
route('/profile', S.profileScreen);
route('/settings', S.settingsScreen);
route('/kyc', S.kycScreen);
route('/support', S.supportScreen);
route('/articles', S.articlesScreen);
route('/articles/:slug', S.articleScreen);
route('/affiliations', S.affiliationsScreen);
route('/referrals', V.referralsScreen, { roles: PROVIDERS });
route('/provider/schedule', S.scheduleScreen, { roles: ['DOCTOR', 'NURSE', 'LAB'] });
route('/provider/earnings', S.earningsScreen, { roles: PROVIDERS });
route('/provider/:userId', P.providerDetailScreen);
route('/donations/campaign/:id', P.campaignScreen);

// Patient
route('/patient/home', P.homeScreen, { roles: PATIENT });
route('/patient/wallet', P.walletScreen, { roles: PATIENT });
route('/patient/emergency', P.emergencyScreen, { roles: PATIENT });
route('/patient/appointments', P.appointmentsScreen, { roles: PATIENT });
route('/book/:userId', P.bookScreen, { roles: PATIENT });
route('/patient/pharmacy', P.pharmacyScreen, { roles: PATIENT });
route('/patient/pharmacy/:id', P.storeScreen, { roles: PATIENT });
route('/patient/orders', P.ordersScreen, { roles: PATIENT });
route('/patient/labs', P.labsScreen, { roles: PATIENT });
route('/patient/providers', P.providersScreen, { roles: PATIENT });
route('/patient/institutions', P.institutionsScreen, { roles: PATIENT });
route('/patient/donations', P.donationsScreen);
route('/patient/insurance', P.insuranceScreen, { roles: PATIENT });
route('/patient/records', P.recordsScreen, { roles: PATIENT });

// Doctor
route('/doctor/home', V.doctorHome, { roles: ['DOCTOR'] });
route('/doctor/requests', V.doctorRequests, { roles: ['DOCTOR'] });
route('/doctor/patients', V.doctorPatients, { roles: ['DOCTOR'] });
route('/doctor/patient/:id', V.doctorPatientDetail, { roles: ['DOCTOR'] });
route('/doctor/schedule', S.scheduleScreen, { roles: ['DOCTOR'] });
route('/doctor/lab-results', V.doctorLabResults, { roles: ['DOCTOR'] });
route('/doctor/emergencies', V.doctorEmergencies, { roles: ['DOCTOR'] });

// Pharmacy
route('/pharmacy/home', V.pharmacyHome, { roles: ['PHARMACY'] });
route('/pharmacy/inventory', V.pharmacyInventory, { roles: ['PHARMACY'] });
route('/pharmacy/intake', V.pharmacyIntake, { roles: ['PHARMACY'] });
route('/pharmacy/audit', V.pharmacyAudit, { roles: ['PHARMACY'] });
route('/pharmacy/pos', V.pharmacyPos, { roles: ['PHARMACY'] });
route('/pharmacy/orders', V.pharmacyOrders, { roles: ['PHARMACY'] });
route('/pharmacy/customers', V.pharmacyCustomers, { roles: ['PHARMACY'] });

// Lab
route('/lab/home', V.labHome, { roles: ['LAB'] });
route('/lab/tests', V.labTests, { roles: ['LAB'] });
route('/lab/catalog', V.labCatalog, { roles: ['LAB'] });

// Nurse
route('/nurse/home', V.nurseHome, { roles: ['NURSE'] });
route('/nurse/requests', V.nurseRequests, { roles: ['NURSE'] });

// Ambulance
route('/ambulance/home', V.ambulanceHome, { roles: ['AMBULANCE'] });
route('/ambulance/requests', V.ambulanceRequests, { roles: ['AMBULANCE'] });

// Institution
route('/institution/home', V.institutionHome, { roles: ['INSTITUTION'] });
route('/institution/profile', V.institutionProfile, { roles: ['INSTITUTION'] });
route('/institution/departments', V.institutionDepartments, { roles: ['INSTITUTION'] });
route('/institution/staff', V.institutionStaff, { roles: ['INSTITUTION'] });
route('/institution/patients', V.institutionPatients, { roles: ['INSTITUTION'] });
route('/institution/reports', V.institutionReports, { roles: ['INSTITUTION'] });

// Admin
route('/admin', V.adminHome, { roles: ['ADMIN'] });
