import crypto from 'crypto';
import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import * as didit from '../services/didit';
import { onKycDecision } from '../services/kyc';

/** GET /api/kyc/status */
export async function kycStatus(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { kycStatus: true, verificationStatus: true, verificationNote: true } });
  const sessions = await prisma.kycVerification.findMany({
    where: { userId: req.user!.userId }, orderBy: { createdAt: 'desc' }, take: 5,
    select: { id: true, provider: true, purpose: true, status: true, sessionUrl: true, documentType: true, documentCountry: true, documentLast4: true, fullName: true, createdAt: true, decision: true },
  });
  const reviewNote = (sessions.find((x) => x.provider === 'manual')?.decision as any)?.review?.note || null;
  res.json({ ...user, configured: didit.DIDIT_CONFIGURED(), reviewNote, sessions: sessions.map((x) => ({ ...x, decision: undefined })) });
}

/** POST /api/kyc/session - starts (or resumes) a Didit hosted verification. */
export async function startKyc(req: Request, res: Response) {
  if (!didit.DIDIT_CONFIGURED()) throw ApiError.badRequest('Identity verification is not configured yet. Please try again later.');
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  if (user.kycStatus === 'APPROVED') return res.json({ status: 'APPROVED' });

  const purpose = req.user!.role === 'PATIENT' ? 'identity' : req.user!.role === 'INSTITUTION' ? 'institution' : 'provider';
  const open = await prisma.kycVerification.findFirst({ where: { userId, status: { in: ['Not Started', 'In Progress'] }, createdAt: { gt: new Date(Date.now() - 23 * 3600_000) } }, orderBy: { createdAt: 'desc' } });
  if (open?.sessionUrl) return res.json({ url: open.sessionUrl, sessionId: open.sessionId, status: open.status });

  const returnUrl = typeof req.body?.returnUrl === 'string' && /^https?:\/\//.test(req.body.returnUrl) ? req.body.returnUrl : env.appUrl + '/?kyc=done';
  const workflowId = purpose === 'identity' ? env.raw.DIDIT_WORKFLOW_ID : env.raw.DIDIT_PROVIDER_WORKFLOW_ID || env.raw.DIDIT_WORKFLOW_ID;
  const s = await didit.createSession({ userId, purpose, callback: returnUrl, workflowId, metadata: { role: req.user!.role } });
  await prisma.kycVerification.create({ data: { userId, purpose, sessionId: s.session_id, sessionUrl: s.url, status: s.status || 'Not Started' } });
  await prisma.user.update({ where: { id: userId }, data: { kycStatus: 'PENDING' } });
  res.status(201).json({ url: s.url, sessionId: s.session_id, status: s.status });
}

/** POST /api/kyc/refresh - polls Didit for the latest decision (fallback if a webhook was missed). */
export async function refreshKyc(req: Request, res: Response) {
  const rec = await prisma.kycVerification.findFirst({ where: { userId: req.user!.userId }, orderBy: { createdAt: 'desc' } });
  if (!rec) throw ApiError.notFound('No verification started');
  if (!didit.DIDIT_CONFIGURED()) return res.json({ status: rec.status });
  const d = await didit.getDecision(rec.sessionId);
  const mapped = await onKycDecision(rec.sessionId, d.status, d, d.vendor_data);
  res.json({ status: d.status, kycStatus: mapped });
}

// ------------------------------------------------------------------ in-app KYC form (reviewed by an N-Health admin)
const ID_TYPES: Record<string, string> = { NIN: 'National ID (NIN slip / card)', PASSPORT: 'International passport', DRIVERS_LICENCE: "Driver's licence", VOTERS_CARD: "Voter's card" };
const strv = (v: any, n = 200) => (v === undefined || v === null || String(v).trim() === '' ? undefined : String(v).trim().slice(0, n));

/**
 * POST /api/kyc/manual - the person fills in their details and uploads their ID (front/back), a selfie
 * and proof of address (all as private uploads). Status becomes IN_REVIEW until an admin decides.
 */
export async function submitManualKyc(req: Request, res: Response) {
  const userId = req.user!.userId;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  if (user.kycStatus === 'APPROVED') throw ApiError.conflict('Your identity is already verified');
  const b = req.body || {};
  const required: [string, string][] = [['fullName', 'Full name as on your ID'], ['dateOfBirth', 'Date of birth'], ['address', 'Home address'], ['state', 'State'], ['idType', 'ID type'], ['idNumber', 'ID number'], ['idFront', 'Photo of the front of your ID'], ['selfie', 'Selfie holding your ID'], ['proofOfAddress', 'Proof of address']];
  const missing = required.filter(([k]) => !strv(b[k], 600)).map(([, l]) => l);
  if (missing.length) throw ApiError.badRequest('Please add: ' + missing.join(', '));
  if (!ID_TYPES[String(b.idType)]) throw ApiError.badRequest('Choose your ID type');
  const idNumber = String(b.idNumber).replace(/\s+/g, '');
  if (b.idType === 'NIN' && !/^\d{11}$/.test(idNumber)) throw ApiError.badRequest('A NIN has 11 digits');
  const dob = new Date(String(b.dateOfBirth));
  if (isNaN(dob.getTime()) || dob > new Date()) throw ApiError.badRequest('Enter a valid date of birth');
  const files = ['idFront', 'idBack', 'selfie', 'proofOfAddress'].reduce((o: any, k) => { const u = strv(b[k], 600); if (u) { if (!/^https?:\/\//.test(u)) throw ApiError.badRequest('Upload the documents again'); o[k] = u; } return o; }, {});
  const form = {
    fullName: strv(b.fullName, 120), dateOfBirth: dob.toISOString().slice(0, 10), gender: strv(b.gender, 20), phone: strv(b.phone, 30) || user.phone,
    address: strv(b.address, 300), city: strv(b.city, 80), state: strv(b.state, 40), lga: strv(b.lga, 80),
    idType: b.idType, idNumber, idExpiry: strv(b.idExpiry, 20), files,
  };
  // Replace an earlier manual submission that is still waiting.
  await prisma.kycVerification.updateMany({ where: { userId, provider: 'manual', status: 'In Review' }, data: { status: 'Abandoned' } });
  const rec = await prisma.kycVerification.create({ data: {
    userId, provider: 'manual', purpose: 'identity', sessionId: 'manual-' + crypto.randomUUID(), status: 'In Review',
    documentType: ID_TYPES[b.idType], documentCountry: 'NG', documentLast4: idNumber.slice(-4), fullName: form.fullName, dateOfBirth: form.dateOfBirth, decision: { form } as any,
  } });
  await prisma.user.update({ where: { id: userId }, data: { kycStatus: 'IN_REVIEW' } });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true }, take: 20 });
  const { notify } = await import('../services/notify');
  await Promise.all(admins.map((a) => notify(a.id, 'kyc', '🪪 Identity to review', `${form.fullName} submitted ${ID_TYPES[b.idType]} for verification.`, { data: { kycId: rec.id } }).catch(() => null)));
  res.status(201).json({ id: rec.id, status: 'IN_REVIEW' });
}
