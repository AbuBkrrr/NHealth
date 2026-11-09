import { planFor, platformAccount } from '../services/splits';
import { resolvePayable } from './paymentController';
import { env } from '../config/env';
import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import {
  calculateCharges,
  startTransaction,
  getTransactionStatus,
  applyEscrowCode,
  raiseDispute,
} from '../services/payscrowService';

// ============================================================
// POST /api/escrow/initiate
// Body: { purpose, purposeId, amount, providerUserId, description }
// ============================================================
export async function initiateEscrow(req: Request, res: Response) {
  const patientUserId = req.user!.userId;
  const { purpose, purposeId, description } = req.body;
  const PURPOSE_TO_PAYABLE: Record<string, string> = { appointment: 'APPOINTMENT', pharmacy: 'PHARMACY_ORDER', lab: 'LAB_TEST', nurse: 'NURSE_REQUEST' };
  if (!purpose || !purposeId || !PURPOSE_TO_PAYABLE[purpose]) {
    throw ApiError.badRequest('Missing or invalid fields');
  }
  // Amount and payee always come from the booked record - never from the client.
  const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: patientUserId } });
  if (!patientProfile) throw ApiError.notFound('Patient profile not found');
  const resolved = await resolvePayable(PURPOSE_TO_PAYABLE[purpose], purposeId, patientProfile.id);
  const amount = resolved.amount;
  const providerUserId = resolved.providerUserId;
  if (!providerUserId || amount < 100) throw ApiError.badRequest('This item cannot be paid through escrow');
  const already = await prisma.escrowTransaction.findFirst({ where: { purposeId, userId: patientUserId, status: { in: ['pending', 'in_escrow'] } } });
  if (already?.paymentLink) return res.json({ escrowId: already.id, paymentLink: already.paymentLink, status: already.status, reused: true });

  // Fetch patient and provider
  const [patient, provider] = await Promise.all([
    prisma.user.findUnique({ where: { id: patientUserId } }),
    prisma.user.findUnique({ where: { id: providerUserId } }),
  ]);
  if (!patient) throw ApiError.notFound('Patient not found');
  if (!provider) throw ApiError.notFound('Provider not found');

  // Fetch provider's primary bank account
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { userId: providerUserId, isPrimary: true },
  });
  if (!bankAccount) {
    throw ApiError.badRequest('Provider has no bank account set up. Please ask them to add one.');
  }

  // Calculate charges
  const charges = await calculateCharges(Number(amount), 50, 'NGN');
  if (!charges?.success && !charges?.data) {
    throw ApiError.badRequest('Failed to calculate PayScrow charges');
  }

  const chargeData = charges.data;
  const externalRef = `NH-${purpose.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  // Split the settlement: provider (and their institution, if affiliated staff) + N-Health's commission & booking fee.
  const plan = await planFor(PURPOSE_TO_PAYABLE[purpose] as any, purposeId, patientUserId);
  const T = Number(chargeData.totalSettlementAmount);
  const platform = platformAccount();
  const split: { payees: { userId: string; amount: number; direct: boolean }[]; platformAmount: number; platformDirect: boolean; commission: number } = { payees: [], platformAmount: 0, platformDirect: !!platform, commission: plan.commission };
  const settlementAccounts: { bankCode: string; accountNumber: string; accountName: string; amount: number }[] = [];
  let allocated = 0;
  for (const p of plan.payees) {
    const share = Math.floor((T * p.amount / plan.total) * 100) / 100;
    if (share <= 0) continue;
    if (p.bank) { settlementAccounts.push({ bankCode: p.bank.bankCode, accountNumber: p.bank.accountNumber, accountName: p.bank.accountName, amount: share }); allocated += share; split.payees.push({ userId: p.userId, amount: share, direct: true }); }
    else split.payees.push({ userId: p.userId, amount: share, direct: false });
  }
  const rest = Math.round((T - allocated) * 100) / 100;
  split.platformAmount = Math.round((rest - split.payees.filter((x) => !x.direct).reduce((a, x) => a + x.amount, 0)) * 100) / 100;
  if (platform && rest > 0) settlementAccounts.push({ ...platform, amount: rest });
  else if (rest > 0) {
    // No platform account configured: the provider receives everything; the platform's share is recorded as a balance debt.
    const main = settlementAccounts.find((a) => a.accountNumber === bankAccount.accountNumber) || settlementAccounts[0];
    if (main) main.amount = Math.round((main.amount + rest) * 100) / 100;
    else settlementAccounts.push({ bankCode: bankAccount.bankCode, accountNumber: bankAccount.accountNumber, accountName: bankAccount.accountName, amount: T });
  }

  // Start escrow transaction
  const txn = await startTransaction({
    transactionReference: externalRef,
    merchantEmailAddress: provider.email,
    merchantPhoneNo: provider.phone || undefined,
    merchantName: provider.name,
    customerEmailAddress: patient.email,
    customerPhoneNo: patient.phone || '08000000000',
    customerName: patient.name,
    currencyCode: 'NGN',
    merchantChargePercentage: 50,
    returnUrl: `${env.appUrl}/?escrow=success&ref=${externalRef}`,
    items: [{
      name: description || `N-Health ${purpose}`,
      quantity: 1,
      price: Number(amount),
    }],
    settlementAccounts,
  });

  if (!txn?.success || !txn?.data?.transactionNumber) {
    console.error('PayScrow start failed:', txn);
    throw ApiError.badRequest(txn?.message || 'Failed to create escrow transaction');
  }

  // Save escrow record
  const escrow = await prisma.escrowTransaction.create({
    data: {
      userId: patientUserId,
      providerUserId,
      purpose,
      purposeId,
      externalReference: externalRef,
      payscrowRef: txn.data.transactionNumber,
      payscrowTransactionId: txn.data.transactionId || null,
      paymentLink: txn.data.paymentLink,
      currency: 'NGN',
      amount: Number(amount),
      merchantCharge: chargeData.merchantCharge,
      customerCharge: chargeData.customerCharge,
      totalPayable: chargeData.grandTotalPayable,
      netSettlement: chargeData.totalSettlementAmount,
      status: 'pending',
      metadata: { split } as any,
    },
  });

  res.json({
    success: true,
    escrowId: escrow.id,
    transactionNumber: txn.data.transactionNumber,
    paymentLink: txn.data.paymentLink,
    totalPayable: chargeData.grandTotalPayable,
    merchantCharge: chargeData.merchantCharge,
    customerCharge: chargeData.customerCharge,
  });
}

// ============================================================
// GET /api/escrow/:id
// ============================================================
export async function getEscrow(req: Request, res: Response) {
  const userId = req.user!.userId;
  const escrow = await prisma.escrowTransaction.findFirst({
    where: {
      id: req.params.id,
      OR: [{ userId }, { providerUserId: userId }],
    },
  });
  if (!escrow) throw ApiError.notFound('Escrow not found');
  res.json(escrow);
}

// ============================================================
// POST /api/escrow/:id/release
// Body: { code }
// Patient provides the escrow code to release funds to provider
// ============================================================
export async function releaseEscrow(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { code } = req.body;

  if (!code || code.length > 10) throw ApiError.badRequest('Invalid escrow code');

  const escrow = await prisma.escrowTransaction.findFirst({
    where: { id: req.params.id, userId }, // Only the payer can release
  });
  if (!escrow) throw ApiError.notFound('Escrow not found');
  if (escrow.status === 'released') return res.json({ success: true, message: 'Already released' });
  if (!escrow.payscrowTransactionId) throw ApiError.badRequest('PayScrow transaction ID missing');

  const result = await applyEscrowCode(escrow.payscrowTransactionId, code);
  if (!result?.isSuccessful && !result?.success) {
    throw ApiError.badRequest(result?.message || 'Failed to apply escrow code');
  }

  await prisma.escrowTransaction.update({
    where: { id: escrow.id },
    data: { status: 'released', releasedAt: new Date(), escrowCode: code },
  });

  res.json({ success: true, message: 'Funds released to provider' });
}

// ============================================================
// POST /api/escrow/:id/dispute
// ============================================================
export async function disputeEscrow(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { complaint, requestedBy } = req.body;

  if (!complaint || complaint.length < 10) throw ApiError.badRequest('Complaint must be at least 10 characters');
  if (!['merchant', 'customer'].includes(requestedBy)) throw ApiError.badRequest('Invalid requestedBy');

  const escrow = await prisma.escrowTransaction.findFirst({
    where: { id: req.params.id, OR: [{ userId }, { providerUserId: userId }] },
  });
  if (!escrow) throw ApiError.notFound('Escrow not found');
  if (escrow.status === 'disputed') return res.json({ success: true, message: 'Already disputed' });

  const result = await raiseDispute(escrow.payscrowRef, requestedBy, complaint);
  if (!result?.isSuccessful && !result?.success) {
    throw ApiError.badRequest(result?.message || 'Failed to raise dispute');
  }

  await prisma.escrowTransaction.update({
    where: { id: escrow.id },
    data: { status: 'disputed', disputedAt: new Date() },
  });

  res.json({ success: true, message: 'Dispute raised' });
}

// ============================================================
// GET /api/escrow/my/list
// ============================================================
export async function listMyEscrows(req: Request, res: Response) {
  const userId = req.user!.userId;
  const escrows = await prisma.escrowTransaction.findMany({
    where: { OR: [{ userId }, { providerUserId: userId }] },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(escrows);
}

// ============================================================
// GET /api/escrow/banks
// ============================================================
import { getSupportedBanks } from '../services/payscrowService';
export async function listBanks(req: Request, res: Response) {
  const banks = await getSupportedBanks();
  res.json({ banks });
}