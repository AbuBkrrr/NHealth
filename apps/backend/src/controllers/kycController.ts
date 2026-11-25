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
    select: { id: true, purpose: true, status: true, sessionUrl: true, documentType: true, documentCountry: true, documentLast4: true, fullName: true, createdAt: true },
  });
  res.json({ ...user, configured: didit.DIDIT_CONFIGURED(), sessions });
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
