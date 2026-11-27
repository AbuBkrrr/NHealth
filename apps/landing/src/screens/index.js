// Route table: every screen of the app, guarded by role.
import { route } from '../lib/router.js';
import { authScreen } from './auth.js';
import { pitchScreen } from './pitch.js';

// Screens load in separate files per area, so a phone on 2G downloads only what it needs first.
// After the first visit the service worker keeps every file, so later screens open instantly.
function lazyModule(load) {
  let p = null;
  const get = () => (p = p || load().catch((e) => {
    p = null;
    // A new version was deployed while this page was open: reload once to pick it up.
    if (navigator.onLine && !sessionStorage.getItem('nh_chunk_reload')) { sessionStorage.setItem('nh_chunk_reload', '1'); location.reload(); }
    throw new Error(navigator.onLine ? 'Could not load this screen. Please try again.' : 'This screen has not been saved for offline use yet. Open it once while online.');
  }));
  return new Proxy({}, { get: (_t, name) => (name === 'preload' ? get : async (...args) => (await get())[name](...args)) });
}
export const S = lazyModule(() => import('./shared.js'));
export const P = lazyModule(() => import('./patient.js'));
export const V = lazyModule(() => import('./providers.js'));
const C = lazyModule(() => import('./common.js'));
/** Provider home pages end with the invite card (patients have it inside their home). */
const withInvite = (screen) => async (el, ...a) => {
  const r = await screen(el, ...a);
  const html = await C.inviteCard();
  if (html && el.isConnected && !el.querySelector('.invite-card')) el.insertAdjacentHTML('beforeend', html);
  if (html) C.loadInviteStats(el);
  return r;
};

const PATIENT = ['PATIENT'];
const PROVIDERS = ['DOCTOR', 'NURSE', 'LAB', 'PHARMACY', 'AMBULANCE', 'INSTITUTION'];

// Public
route('/auth', authScreen, { public: true, nav: false });
route('/go', pitchScreen, { public: true, nav: false });
route('/go/:slug', pitchScreen, { public: true, nav: false });
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
route('/doctor/home', withInvite(V.doctorHome), { roles: ['DOCTOR'] });
route('/doctor/requests', V.doctorRequests, { roles: ['DOCTOR'] });
route('/doctor/patients', V.doctorPatients, { roles: ['DOCTOR'] });
route('/doctor/patient/:id', V.doctorPatientDetail, { roles: ['DOCTOR'] });
route('/doctor/schedule', S.scheduleScreen, { roles: ['DOCTOR'] });
route('/doctor/lab-results', V.doctorLabResults, { roles: ['DOCTOR'] });
route('/doctor/emergencies', V.doctorEmergencies, { roles: ['DOCTOR'] });

// Pharmacy
route('/pharmacy/home', withInvite(V.pharmacyHome), { roles: ['PHARMACY'] });
route('/pharmacy/inventory', V.pharmacyInventory, { roles: ['PHARMACY'] });
route('/pharmacy/intake', V.pharmacyIntake, { roles: ['PHARMACY'] });
route('/pharmacy/audit', V.pharmacyAudit, { roles: ['PHARMACY'] });
route('/pharmacy/pos', V.pharmacyPos, { roles: ['PHARMACY'] });
route('/pharmacy/orders', V.pharmacyOrders, { roles: ['PHARMACY'] });
route('/pharmacy/customers', V.pharmacyCustomers, { roles: ['PHARMACY'] });

// Lab
route('/lab/home', withInvite(V.labHome), { roles: ['LAB'] });
route('/lab/tests', V.labTests, { roles: ['LAB'] });
route('/lab/catalog', V.labCatalog, { roles: ['LAB'] });

// Nurse
route('/nurse/home', withInvite(V.nurseHome), { roles: ['NURSE'] });
route('/nurse/requests', V.nurseRequests, { roles: ['NURSE'] });

// Ambulance
route('/ambulance/home', withInvite(V.ambulanceHome), { roles: ['AMBULANCE'] });
route('/ambulance/requests', V.ambulanceRequests, { roles: ['AMBULANCE'] });

// Institution
route('/institution/home', withInvite(V.institutionHome), { roles: ['INSTITUTION'] });
route('/institution/profile', V.institutionProfile, { roles: ['INSTITUTION'] });
route('/institution/departments', V.institutionDepartments, { roles: ['INSTITUTION'] });
route('/institution/staff', V.institutionStaff, { roles: ['INSTITUTION'] });
route('/institution/patients', V.institutionPatients, { roles: ['INSTITUTION'] });
route('/institution/reports', V.institutionReports, { roles: ['INSTITUTION'] });
route('/institution/er', V.institutionEr, { roles: ['INSTITUTION'] });

// Admin
route('/admin', V.adminHome, { roles: ['ADMIN'] });
