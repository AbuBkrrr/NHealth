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
  const { purpose, purposeId, amount, providerUserId, description } = req.body;

  if (!purpose || !purposeId || !amount || amount < 100) {
    throw ApiError.badRequest('Missing or invalid fields');
  }
  if (!providerUserId) {
    throw ApiError.badRequest('Provider user ID required');
  }

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
    returnUrl: `https://www.nhealth.com.ng/?escrow=success&ref=${externalRef}`,
    items: [{
      name: description || `N-Health ${purpose}`,
      quantity: 1,
      price: Number(amount),
    }],
    settlementAccounts: [{
      bankCode: bankAccount.bankCode,
      accountNumber: bankAccount.accountNumber,
      accountName: bankAccount.accountName,
      amount: chargeData.totalSettlementAmount,
    }],
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