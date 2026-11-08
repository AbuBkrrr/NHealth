import { Router } from 'express';
import { requireAuth, requireRole, requireVerifiedProvider } from '../middleware/auth';
import { asyncHandler as h } from '../utils/asyncHandler';
import { sensitiveLimiter } from '../middleware/rateLimit';
import * as core from '../controllers/platform/core';
import * as sched from '../controllers/platform/schedule';
import * as health from '../controllers/platform/health';
import * as don from '../controllers/platform/donations';
import * as inst from '../controllers/platform/institution';
import * as ph from '../controllers/platform/pharmacyExt';
import * as lab from '../controllers/platform/labExt';
import * as priv from '../controllers/platform/privacy';
import * as adm from '../controllers/platform/adminExt';
import * as kyc from '../controllers/kycController';
import * as labCore from '../controllers/labController';
import * as fin from '../controllers/platform/finance';
import * as integ from '../controllers/platform/integrations';
import { requireSuperAdmin } from '../middleware/auth';

/**
 * Platform-wide features added for global launch. Mounted at /api.
 * Every route below is authenticated except /config, /public/* and /articles.
 */
const r = Router();
const auth = requireAuth;
const PROVIDERS = ['DOCTOR', 'NURSE', 'LAB', 'PHARMACY', 'AMBULANCE', 'INSTITUTION'];

// Public
r.get('/config', h(core.config));
r.get('/public/emergency-card/:token', h(health.publicEmergencyCard));
r.get('/articles', h(core.listArticles));
r.get('/articles/:slug', h(core.getArticle));

// Unified provider profile
r.get('/provider-profile', auth, h(core.getProviderProfile));
r.patch('/provider-profile', auth, h(core.updateProviderProfile));

// Files
r.post('/uploads', auth, sensitiveLimiter, h(core.upload));

// Identity verification (Didit) & provider documents
r.get('/kyc/status', auth, h(kyc.kycStatus));
r.post('/kyc/session', auth, sensitiveLimiter, h(kyc.startKyc));
r.post('/kyc/refresh', auth, h(kyc.refreshKyc));
r.get('/verification/documents', auth, h(priv.listMyDocuments));
r.post('/verification/documents', auth, requireRole(...PROVIDERS), sensitiveLimiter, h(priv.uploadProviderDocument));

// Notifications & web push
r.get('/notifications', auth, h(core.listNotifications));
r.post('/notifications/read-all', auth, h(core.readAllNotifications));
r.post('/notifications/:id/read', auth, h(core.readNotification));
r.post('/push/subscribe', auth, h(core.pushSubscribe));
r.post('/push/unsubscribe', auth, h(core.pushUnsubscribe));

// Directory, reviews, referrals
r.get('/directory', auth, h(core.directory));
r.get('/directory/:userId', auth, h(core.directoryDetail));
r.get('/reviews/:userId', auth, h(core.listReviews));
r.post('/reviews', auth, h(core.createReview));
r.get('/referrals', auth, h(core.listReferrals));
r.post('/referrals', auth, requireRole(...PROVIDERS), requireVerifiedProvider, h(core.createReferral));
r.post('/referrals/:id/respond', auth, requireRole(...PROVIDERS), h(core.respondReferral));

// Support
r.get('/support/tickets', auth, h(core.myTickets));
r.post('/support/tickets', auth, sensitiveLimiter, h(core.createTicket));

// Availability (doctor / nurse / lab calendars)
r.get('/availability/me', auth, requireRole(...PROVIDERS), h(sched.myAvailability));
r.put('/availability/me', auth, requireRole(...PROVIDERS), h(sched.setAvailability));
r.post('/availability/me/blocks', auth, requireRole(...PROVIDERS), h(sched.addBlock));
r.delete('/availability/me/blocks/:id', auth, requireRole(...PROVIDERS), h(sched.removeBlock));
r.get('/availability/:userId/slots', auth, h(sched.providerSlots));
r.get('/availability/:userId/days', auth, h(sched.providerDays));

// Personal health record
r.get('/health/timeline', auth, requireRole('PATIENT'), h(health.timeline));
r.get('/health/reminders', auth, h(health.listReminders));
r.post('/health/reminders', auth, h(health.createReminder));
r.put('/health/reminders/:id', auth, h(health.updateReminder));
r.post('/health/reminders/:id/log', auth, h(health.logDose));
r.delete('/health/reminders/:id', auth, h(health.deleteReminder));
r.get('/health/family', auth, h(health.listFamily));
r.post('/health/family', auth, h(health.addFamily));
r.put('/health/family/:id', auth, h(health.updateFamily));
r.delete('/health/family/:id', auth, h(health.deleteFamily));
r.get('/health/vaccinations', auth, h(health.listVaccinations));
r.post('/health/vaccinations', auth, h(health.addVaccination));
r.delete('/health/vaccinations/:id', auth, h(health.deleteVaccination));
r.get('/health/documents', auth, h(health.listDocuments));
r.post('/health/documents', auth, h(health.addDocument));
r.delete('/health/documents/:id', auth, h(health.deleteDocument));
r.get('/health/emergency-card', auth, requireRole('PATIENT'), h(health.myEmergencyCard));
r.post('/health/emergency-card/rotate', auth, requireRole('PATIENT'), h(health.rotateEmergencyCard));

// Donations: funds, patient cases, blood & organ
r.get('/donations/campaigns', auth, h(don.listCampaigns));
r.post('/donations/campaigns', auth, sensitiveLimiter, h(don.createCampaign));
r.get('/donations/campaigns/:id', auth, h(don.getCampaign));
r.post('/donations/campaigns/:id/donate', auth, requireRole('PATIENT'), sensitiveLimiter, h(don.donate));
r.get('/donations/campaigns/:id/pledges', auth, h(don.campaignPledges));
r.post('/donations/eligibility', auth, h(don.bloodEligibility));
r.get('/donations/pledges', auth, h(don.myPledges));
r.post('/donations/pledges', auth, h(don.createPledge));
r.patch('/donations/pledges/:id', auth, h(don.updatePledge));
r.get('/donations/organ-registry', auth, h(don.getOrganRegistration));
r.post('/donations/organ-registry', auth, h(don.registerOrganDonor));
r.delete('/donations/organ-registry', auth, h(don.withdrawOrganDonor));
r.get('/donations/centers', auth, h(don.listCenters));

// Insurance catalogue
r.get('/insurance/plans', auth, h(don.listInsurancePlans));
r.post('/insurance/policies/:id/pay', auth, requireRole('PATIENT'), sensitiveLimiter, h(don.payPremium));

// Institution management
const I = [auth, requireRole('INSTITUTION')];
r.get('/institution/affiliations', auth, h(inst.myAffiliations));
r.post('/institution/affiliations/:id', auth, h(inst.respondAffiliation));
r.get('/institution/profile', ...I, h(inst.getInstitution));
r.patch('/institution/profile', ...I, h(inst.updateInstitution));
r.get('/institution/stats', ...I, h(inst.institutionStats));
r.get('/institution/reports', ...I, h(inst.institutionReports));
r.get('/institution/departments', ...I, h(inst.listDepartments));
r.post('/institution/departments', ...I, h(inst.createDepartment));
r.patch('/institution/departments/:id', ...I, h(inst.updateDepartment));
r.delete('/institution/departments/:id', ...I, h(inst.deleteDepartment));
r.get('/institution/staff', ...I, h(inst.listStaff));
r.post('/institution/staff', ...I, requireVerifiedProvider, h(inst.inviteStaff));
r.patch('/institution/staff/:id', ...I, h(inst.updateStaff));
r.get('/institution/patients', ...I, h(inst.listInstPatients));
r.post('/institution/patients', ...I, requireVerifiedProvider, h(inst.enrolPatient));
r.patch('/institution/patients/:id', ...I, h(inst.updateInstPatient));

// Pharmacy operations: stock intake, audits, POS, customers
const P = [auth, requireRole('PHARMACY')];
r.get('/pharmacy-ops/alerts', ...P, h(ph.stockAlerts));
r.get('/pharmacy-ops/intake', ...P, h(ph.listIntakes));
r.post('/pharmacy-ops/intake', ...P, requireVerifiedProvider, h(ph.stockIntake));
r.get('/pharmacy-ops/audit', ...P, h(ph.listAudits));
r.post('/pharmacy-ops/audit', ...P, h(ph.stockAudit));
r.post('/pharmacy-ops/pos/checkout', ...P, requireVerifiedProvider, h(ph.posCheckout));
r.get('/pharmacy-ops/pos/sales', ...P, h(ph.listSales));
r.get('/pharmacy-ops/customers', ...P, h(ph.customers));
r.get('/pharmacy-ops/prescriptions', ...P, h(ph.routedPrescriptions));

// Labs
r.get('/lab-results/:id/pdf', auth, h(labCore.getResultPdf));
r.get('/labs/catalog', auth, h(lab.searchCatalog));
r.get('/lab-ops/catalog', auth, requireRole('LAB'), h(lab.myCatalog));
r.post('/lab-ops/catalog', auth, requireRole('LAB'), h(lab.addCatalog));
r.patch('/lab-ops/catalog/:id', auth, requireRole('LAB'), h(lab.updateCatalog));
r.delete('/lab-ops/catalog/:id', auth, requireRole('LAB'), h(lab.deleteCatalog));

// Doctor extras
r.get('/doctor-ops/stats', auth, requireRole('DOCTOR'), h(lab.doctorStats));
r.get('/doctor-ops/lab-requests', auth, requireRole('DOCTOR'), h(lab.doctorLabResults));
r.post('/doctor-ops/lab-requests', auth, requireRole('DOCTOR'), requireVerifiedProvider, h(lab.doctorLabRequest));

// Provider earnings & payouts (Bolt-style)
r.get('/earnings', auth, requireRole(...PROVIDERS), h(fin.myEarnings));
r.get('/earnings/banks', auth, requireRole(...PROVIDERS), h(fin.payoutBanks));
r.post('/earnings/bank', auth, requireRole(...PROVIDERS), sensitiveLimiter, h(fin.setPayoutBank));
r.post('/earnings/cash-out', auth, requireRole(...PROVIDERS), requireVerifiedProvider, sensitiveLimiter, h(fin.cashOut));
r.post('/earnings/settle', auth, requireRole(...PROVIDERS), sensitiveLimiter, h(fin.settleDebt));

// Privacy (NDPR / GDPR)
r.get('/privacy/export', auth, sensitiveLimiter, h(priv.exportData));
r.post('/privacy/delete', auth, sensitiveLimiter, h(priv.deleteAccount));
r.get('/privacy/access-log', auth, h(priv.myAccessLog));

// Admin extensions
const A = [auth, requireRole('ADMIN')];
r.get('/admin-ops/stats', ...A, h(adm.platformStats));
r.get('/admin-ops/verifications', ...A, h(adm.verificationQueue));
r.post('/admin-ops/verifications/:userId', ...A, h(adm.decideVerification));
r.get('/admin-ops/campaigns', ...A, h(adm.campaignQueue));
r.post('/admin-ops/campaigns/:id', ...A, h(adm.decideCampaign));
r.get('/admin-ops/kyc', ...A, h(adm.kycList));
r.get('/admin-ops/payouts', ...A, h(adm.payoutsOwed));
r.get('/admin-ops/catalog/:kind', ...A, h(adm.catalogList));
r.post('/admin-ops/catalog/:kind', ...A, h(adm.catalogUpsert));
r.delete('/admin-ops/catalog/:kind/:id', ...A, h(adm.catalogDelete));
r.post('/admin-ops/rates', ...A, h(adm.setRate));
r.get('/admin-ops/tickets', ...A, h(adm.listTickets));
r.post('/admin-ops/tickets/:id/reply', ...A, h(adm.replyTicket));

// Finance (fees are super-admin only)
r.get('/admin-ops/finance', ...A, h(fin.getFinanceSettings));
r.put('/admin-ops/finance', ...A, requireSuperAdmin, h(fin.updateFinanceSettings));
r.get('/admin-ops/balances', ...A, h(fin.providerBalances));
r.get('/admin-ops/ledger/:userId', ...A, h(fin.providerLedger));
r.post('/admin-ops/ledger/adjust', ...A, requireSuperAdmin, h(fin.adjustBalance));
r.get('/admin-ops/payout-runs', ...A, h(fin.listPayouts));
r.post('/admin-ops/payout-runs', ...A, requireSuperAdmin, h(fin.runPayoutsNow));
r.post('/admin-ops/payout-runs/:id/status', ...A, requireSuperAdmin, h(fin.setPayoutStatus));
r.get('/admin-ops/revenue', ...A, h(fin.revenue));

// Integration health (live checks against each provider)
r.get('/admin-ops/integrations', ...A, requireSuperAdmin, h(integ.integrationStatus));
r.post('/admin-ops/integrations/test-email', ...A, requireSuperAdmin, h(integ.testEmail));
r.post('/admin-ops/integrations/test-sms', ...A, requireSuperAdmin, h(integ.testSms));

export default r;
