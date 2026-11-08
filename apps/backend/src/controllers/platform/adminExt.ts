import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { notify } from '../../services/notify';
import { invalidateUserState } from '../../middleware/auth';
import { str, num, uid } from './util';

const audit = (req: Request, action: string, targetType: string, targetId: string, detail?: string) =>
  prisma.adminAuditLog.create({ data: { actorId: uid(req), action, targetType, targetId, detail } }).catch(() => null);

/** GET /api/admin/verifications?status=PENDING - providers awaiting verification with their documents and KYC. */
export async function verificationQueue(req: Request, res: Response) {
  const status = String(req.query.status || 'PENDING').toUpperCase();
  res.json(await prisma.user.findMany({
    where: { verificationStatus: status as any, role: { in: ['DOCTOR', 'PHARMACY', 'LAB', 'AMBULANCE', 'NURSE', 'INSTITUTION'] }, deletedAt: null },
    orderBy: { createdAt: 'asc' }, take: 200,
    select: { id: true, name: true, email: true, phone: true, role: true, kycStatus: true, verificationStatus: true, verificationNote: true, createdAt: true, country: true,
      providerDocuments: true, kycVerifications: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, documentType: true, documentCountry: true, fullName: true, dateOfBirth: true } },
      doctorProfile: { select: { licenseNumber: true, specialty: true, hospital: true } }, nurseProfile: { select: { licenseNumber: true, specialty: true } },
      pharmacyProfile: { select: { licenseNumber: true, pharmacyName: true, address: true } }, labProfile: { select: { licenseNumber: true, labName: true, address: true } },
      ambulanceProfile: { select: { licenseNumber: true, vehicleNumber: true } }, institutionProfile: { select: { licenseNumber: true, name: true, type: true, address: true } } },
  }));
}
/** POST /api/admin/verifications/:userId { decision: VERIFIED|REJECTED|SUSPENDED, note } */
export async function decideVerification(req: Request, res: Response) {
  const decision = String(req.body.decision || '').toUpperCase();
  if (!['VERIFIED', 'REJECTED', 'SUSPENDED', 'PENDING'].includes(decision)) throw ApiError.badRequest('Invalid decision');
  const u = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (!u) throw ApiError.notFound('User not found');
  if (decision === 'VERIFIED' && u.kycStatus !== 'APPROVED' && !req.body.overrideKyc) throw ApiError.badRequest('Identity (KYC) must be approved first, or tick override after manual checks');
  await prisma.user.update({ where: { id: u.id }, data: { verificationStatus: decision as any, verificationNote: str(req.body.note, 1000) ?? null, verifiedAt: decision === 'VERIFIED' ? new Date() : null } });
  await prisma.providerDocument.updateMany({ where: { userId: u.id, status: 'PENDING' }, data: { status: decision === 'VERIFIED' ? 'APPROVED' : decision === 'REJECTED' ? 'REJECTED' : 'PENDING', reviewedById: uid(req), reviewedAt: new Date(), reviewNote: str(req.body.note, 1000) } });
  invalidateUserState(u.id);
  await audit(req, 'VERIFY_' + decision, 'User', u.id, str(req.body.note, 500));
  const msg: Record<string, string> = { VERIFIED: 'Your provider account is verified ✅. Patients can now book you.', REJECTED: 'Your verification was not approved. ' + (str(req.body.note) || 'Please re-upload valid documents.'), SUSPENDED: 'Your provider account was suspended. Contact support.', PENDING: 'Your verification is back under review.' };
  await notify(u.id, 'kyc', 'Verification update', msg[decision], { email: true });
  res.json({ ok: true });
}
export async function campaignQueue(req: Request, res: Response) {
  res.json(await prisma.donationCampaign.findMany({ where: { status: String(req.query.status || 'PENDING_REVIEW') }, orderBy: { createdAt: 'asc' }, include: { organizer: { select: { name: true, email: true, phone: true, kycStatus: true } } } }));
}
export async function decideCampaign(req: Request, res: Response) {
  const status = String(req.body.status || '').toUpperCase();
  if (!['ACTIVE', 'REJECTED', 'CLOSED', 'COMPLETED'].includes(status)) throw ApiError.badRequest('Invalid status');
  const c = await prisma.donationCampaign.update({ where: { id: req.params.id }, data: { status } });
  await audit(req, 'CAMPAIGN_' + status, 'DonationCampaign', c.id);
  await notify(c.organizerId, 'donation', 'Campaign ' + status.toLowerCase(), `"${c.title}" is now ${status.toLowerCase()}.`, { email: true });
  res.json(c);
}
export async function kycList(req: Request, res: Response) {
  res.json(await prisma.kycVerification.findMany({ orderBy: { createdAt: 'desc' }, take: 200, where: req.query.status ? { status: String(req.query.status) } : {},
    select: { id: true, status: true, purpose: true, documentType: true, documentCountry: true, fullName: true, createdAt: true, user: { select: { id: true, name: true, email: true, role: true } } } }));
}
export async function platformStats(_req: Request, res: Response) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [users, byRole, appts, orders, emerg, topups, coinsOut, pendingVerif, pendingCampaigns, openTickets] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.groupBy({ by: ['role'], _count: true, where: { deletedAt: null } }),
    prisma.appointment.count({ where: { createdAt: { gte: since } } }),
    prisma.pharmacyOrder.count({ where: { createdAt: { gte: since } } }),
    prisma.emergencyRequest.count({ where: { requestedAt: { gte: since } } }),
    prisma.paymentGatewayLog.aggregate({ where: { status: 'success', createdAt: { gte: since } }, _sum: { amount: true }, _count: true }),
    prisma.creditLedger.aggregate({ _sum: { balance: true } }),
    prisma.user.count({ where: { verificationStatus: 'PENDING' } }),
    prisma.donationCampaign.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.supportTicket.count({ where: { status: 'open' } }),
  ]);
  res.json({ users, byRole: Object.fromEntries(byRole.map((r) => [r.role, r._count])), last30: { appointments: appts, orders, emergencies: emerg, topups: Number(topups._sum.amount || 0), topupCount: topups._count },
    outstandingCoins: Number(coinsOut._sum.balance || 0), pendingVerifications: pendingVerif, pendingCampaigns, openTickets });
}
/** Provider payouts owed: confirmed coin payments to providers (settled to their bank account off-platform). */
export async function payoutsOwed(_req: Request, res: Response) {
  const rows = await prisma.payment.groupBy({ by: ['providerUserId'], where: { status: 'CONFIRMED', method: 'WALLET', providerUserId: { not: null } }, _sum: { amount: true }, _count: true });
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.providerUserId!) } }, select: { id: true, name: true, role: true, bankAccounts: { where: { isPrimary: true } } } });
  const m = Object.fromEntries(users.map((u) => [u.id, u]));
  res.json(rows.map((r) => ({ provider: m[r.providerUserId!], amount: Number(r._sum.amount || 0), payments: r._count })));
}
// Generic catalog CRUD for admin-managed reference data.
const CATALOGS: Record<string, any> = { 'insurance-plans': 'insurancePlan', 'donation-centers': 'donationCenter', articles: 'healthArticle' };
export async function catalogList(req: Request, res: Response) {
  const m = CATALOGS[req.params.kind]; if (!m) throw ApiError.notFound('Unknown catalog');
  res.json(await (prisma as any)[m].findMany({ take: 500 }));
}
export async function catalogUpsert(req: Request, res: Response) {
  const m = CATALOGS[req.params.kind]; if (!m) throw ApiError.notFound('Unknown catalog');
  const { id, ...data } = req.body || {};
  if (data.monthlyPremium !== undefined) data.monthlyPremium = num(data.monthlyPremium);
  const row = id ? await (prisma as any)[m].update({ where: { id }, data }) : await (prisma as any)[m].create({ data });
  await audit(req, 'CATALOG_UPSERT', m, row.id);
  res.json(row);
}
export async function catalogDelete(req: Request, res: Response) {
  const m = CATALOGS[req.params.kind]; if (!m) throw ApiError.notFound('Unknown catalog');
  await (prisma as any)[m].delete({ where: { id: req.params.id } });
  await audit(req, 'CATALOG_DELETE', m, req.params.id);
  res.json({ ok: true });
}
export async function setRate(req: Request, res: Response) {
  const code = String(req.body.code || '').toUpperCase(); const perNgn = num(req.body.perNgn);
  if (code.length !== 3 || !perNgn || perNgn <= 0) throw ApiError.badRequest('Provide code and perNgn');
  res.json(await prisma.currencyRate.upsert({ where: { code }, create: { code, perNgn }, update: { perNgn } }));
}
export async function listTickets(req: Request, res: Response) {
  res.json(await prisma.supportTicket.findMany({ where: req.query.status ? { status: String(req.query.status) } : {}, orderBy: { createdAt: 'desc' }, take: 200 }));
}
export async function replyTicket(req: Request, res: Response) {
  const t = await prisma.supportTicket.update({ where: { id: req.params.id }, data: { adminReply: str(req.body.reply, 5000), repliedById: uid(req), repliedAt: new Date(), status: req.body.close ? 'closed' : 'answered', closedAt: req.body.close ? new Date() : undefined } });
  if (t.userId) await notify(t.userId, 'system', 'Support replied', (t.adminReply || '').slice(0, 140), { email: true, data: { ticketId: t.id } });
  res.json(t);
}
