import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';

// ============================================================
// GET /api/provider/bank
// ============================================================
export async function getBankAccount(req: Request, res: Response) {
  const userId = req.user!.userId;
  const account = await prisma.bankAccount.findFirst({
    where: { userId, isPrimary: true },
  });
  res.json(account || null);
}

// ============================================================
// POST /api/provider/bank
// Body: { bankCode, bankName, accountNumber, accountName }
// ============================================================

export async function upsertBankAccount(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { bankCode, bankName, accountNumber, accountName } = req.body;

  if (!bankCode || !bankName || !accountNumber || !accountName) {
    throw ApiError.badRequest('All bank fields are required');
  }
  if (!/^\d{10}$/.test(accountNumber)) {
    throw ApiError.badRequest('Account number must be exactly 10 digits');
  }

  try {
    const account = await prisma.bankAccount.upsert({
      where: {
        userId_accountNumber: { userId, accountNumber },
      },
      update: {
        bankCode,
        bankName,
        accountName,
        isPrimary: true,
      },
      create: {
        userId,
        bankCode,
        bankName,
        accountNumber,
        accountName,
        isPrimary: true,
      },
    });

    console.log(`Bank account upserted for ${userId}: ${bankName} ${accountNumber}`);
    res.json(account);
  } catch (err) {
    console.error('Failed to upsert bank account:', err);
    throw new ApiError(500, 'Failed to save bank account');
  }
}


// ============================================================
// DELETE /api/provider/bank
// ============================================================
export async function deleteBankAccount(req: Request, res: Response) {
  const userId = req.user!.userId;
  await prisma.bankAccount.deleteMany({ where: { userId } });
  res.json({ success: true });
}