import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { ApiError } from '../../utils/ApiError';
import { invalidateUserState } from '../../middleware/auth';
import { notify } from '../../services/notify';
import { storeFile, parseDataUri } from '../../services/storage';
import { uid, str } from './util';

/** GET /api/privacy/export - full machine-readable copy of the user's data (NDPR / GDPR right of access & portability). */
export async function exportData(req: Request, res: Response) {
  const id = uid(req);
  const user = await prisma.user.findUnique({ where: { id }, include: {
    patientProfile: { include: { appointments: true, prescriptions: true, orders: true, labTests: { include: { result: true } }, emergencyRequests: true, donations: true, insurancePolicies: true, nurseRequests: true } },
    doctorProfile: true, pharmacyProfile: true, labProfile: true, ambulanceProfile: true, nurseProfile: true, institutionProfile: true,
    creditTransactions: true, notifications: true, reminders: true, familyMembers: true, vaccinations: true, healthDocuments: true, donorPledges: true,
    organRegistration: true, reviewsGiven: true, kycVerifications: { select: { status: true, documentType: true, documentCountry: true, createdAt: true } }, supportTickets: true,
  } });
  const messages = await prisma.message.findMany({ where: { OR: [{ senderId: id }, { receiverId: id }] }, orderBy: { createdAt: 'asc' } });
  const accessLog = await prisma.accessLog.findMany({ where: { subjectId: id }, include: { actor: { select: { name: true, role: true } } } });
  await prisma.dataRequest.create({ data: { userId: id, type: 'EXPORT', status: 'COMPLETED', completedAt: new Date() } });
  const { passwordHash, tokenVersion, failedLogins, lockedUntil, ...safe } = user as any;
  res.setHeader('Content-Disposition', 'attachment; filename="nhealth-my-data.json"');
  res.json({ exportedAt: new Date().toISOString(), user: safe, messages, accessLog });
}

/** POST /api/privacy/delete { confirm: "DELETE" } - erases personal data; financial/medical records are anonymised, not destroyed, to meet retention law. */
export async function deleteAccount(req: Request, res: Response) {
  if (req.body?.confirm !== 'DELETE') throw ApiError.badRequest('Type DELETE to confirm');
  const id = uid(req);
  const anon = `deleted-${id.slice(0, 8)}@deleted.nhealth`;
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { email: anon, name: 'Deleted user', phone: null, avatarUrl: null, isActive: false, deletedAt: new Date(), passwordHash: 'DELETED', tokenVersion: { increment: 1 }, referralCode: null, notificationPrefs: undefined } }),
    prisma.patientProfile.updateMany({ where: { userId: id }, data: { address: null, emergencyContact: null, emergencyPhone: null, nhisNumber: null, nationalIdLast4: null, emergencyCardToken: null, occupation: null } }),
    prisma.pushSubscription.deleteMany({ where: { userId: id } }),
    prisma.familyMember.deleteMany({ where: { ownerId: id } }),
    prisma.healthDocument.deleteMany({ where: { userId: id } }),
    prisma.medicationReminder.deleteMany({ where: { userId: id } }),
    prisma.notification.deleteMany({ where: { userId: id } }),
    prisma.organDonorRegistration.updateMany({ where: { userId: id }, data: { status: 'WITHDRAWN', nextOfKinName: null, nextOfKinPhone: null } }),
    prisma.dataRequest.create({ data: { userId: id, type: 'DELETE', status: 'COMPLETED', completedAt: new Date() } }),
  ]);
  invalidateUserState(id);
  res.json({ message: 'Your account has been deleted.' });
}

/** GET /api/privacy/access-log - who viewed my medical records. */
export async function myAccessLog(req: Request, res: Response) {
  res.json(await prisma.accessLog.findMany({ where: { subjectId: uid(req) }, orderBy: { createdAt: 'desc' }, take: 100, include: { actor: { select: { name: true, role: true } } } }));
}

// ---------- Provider verification documents ----------
export async function listMyDocuments(req: Request, res: Response) {
  res.json(await prisma.providerDocument.findMany({ where: { userId: uid(req) }, orderBy: { createdAt: 'desc' } }));
}
/** POST /api/verification/documents { type, title, dataUri | fileUrl, expiresAt } */
export async function uploadProviderDocument(req: Request, res: Response) {
  const type = ['LICENSE', 'CERTIFICATE', 'CAC', 'PRACTICE_PERMIT', 'INSURANCE', 'VEHICLE', 'OTHER'].includes(req.body.type) ? req.body.type : 'OTHER';
  let fileUrl = str(req.body.fileUrl, 2000), fileId: string | undefined;
  if (req.body.dataUri) { const { buf, mime } = parseDataUri(req.body.dataUri); const f = await storeFile(buf, mime, `kyc/${uid(req)}`, true); fileUrl = f.url; fileId = f.fileId; }
  if (!fileUrl) throw ApiError.badRequest('Attach the document');
  const d = await prisma.providerDocument.create({ data: { userId: uid(req), type, title: str(req.body.title, 160) || type, fileUrl, fileId, expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined } });
  await prisma.user.updateMany({ where: { id: uid(req), verificationStatus: { in: ['UNVERIFIED', 'REJECTED'] } }, data: { verificationStatus: 'PENDING' } });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, 'kyc', 'Provider document to review', `${type} uploaded for verification.`, { push: false, data: { userId: uid(req) } })));
  res.status(201).json(d);
}
