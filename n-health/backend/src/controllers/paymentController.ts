import { Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { startDocument, drawField, drawTotal, drawFooterNote, finishDocument, formatNaira } from '../utils/pdf';

const PAYMENT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes to complete USSD/Transfer/Card payment
const NURSE_FALLBACK_FEE = 5000; // used when a nurse request has no assigned nurse's rate yet

function generateReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `NH-${stamp}-${random}`;
}

/** Deterministic-looking demo account number so the same reference always displays the same digits. */
function demoAccountNumber(reference: string): string {
  const hash = crypto.createHash('sha256').update(reference).digest('hex');
  return (BigInt('0x' + hash.slice(0, 12)) % 10000000000n).toString().padStart(10, '0');
}

interface ResolvedPayable {
  amount: number;
  providerUserId: string | null;
}

/**
 * Looks up the authoritative amount and the provider-side user who should
 * confirm the payment, for a given payableType + payableId - and checks that
 * the requesting patient actually owns that record. The amount always comes
 * from the database, never from the client, so nobody can pay less than
 * what's actually owed by tampering with the request body.
 */
async function resolvePayable(
  payableType: string,
  payableId: string,
  patientId: string
): Promise<ResolvedPayable> {
  switch (payableType) {
    case 'APPOINTMENT': {
      const appt = await prisma.appointment.findUnique({
        where: { id: payableId },
        include: { doctor: { include: { user: { select: { id: true } } } } },
      });
      if (!appt || appt.patientId !== patientId) throw ApiError.notFound('Appointment not found');
      return { amount: Number(appt.doctor.consultationFee), providerUserId: appt.doctor.user.id };
    }
    case 'PHARMACY_ORDER': {
      const order = await prisma.pharmacyOrder.findUnique({
        where: { id: payableId },
        include: { pharmacy: { include: { user: { select: { id: true } } } } },
      });
      if (!order || order.patientId !== patientId) throw ApiError.notFound('Order not found');
      return { amount: Number(order.total), providerUserId: order.pharmacy.user.id };
    }
    case 'LAB_TEST': {
      const test = await prisma.labTest.findUnique({
        where: { id: payableId },
        include: { lab: { include: { user: { select: { id: true } } } } },
      });
      if (!test || test.patientId !== patientId) throw ApiError.notFound('Lab test not found');
      return { amount: Number(test.fee), providerUserId: test.lab.user.id };
    }
    case 'NURSE_REQUEST': {
      const request = await prisma.nurseRequest.findUnique({
        where: { id: payableId },
        include: { nurse: { include: { user: { select: { id: true } } } } },
      });
      if (!request || request.patientId !== patientId) throw ApiError.notFound('Nurse request not found');
      if (!request.nurse) {
        throw ApiError.conflict('A nurse needs to accept this request before you can pay');
      }
      return { amount: Number(request.nurse.hourlyRate) || NURSE_FALLBACK_FEE, providerUserId: request.nurse.user.id };
    }
    case 'DONATION': {
      const donation = await prisma.donation.findUnique({ where: { id: payableId } });
      if (!donation || donation.patientId !== patientId) throw ApiError.notFound('Donation not found');
      // No in-app counterparty to confirm a donation - it auto-confirms below.
      return { amount: Number(donation.amount), providerUserId: null };
    }
    case 'INSURANCE_POLICY': {
      const policy = await prisma.insurancePolicy.findUnique({ where: { id: payableId } });
      if (!policy || policy.patientId !== patientId) throw ApiError.notFound('Insurance policy not found');
      if (policy.premiumAmount == null) throw ApiError.badRequest('This policy has no premium amount set');
      // No in-app insurer to confirm a premium payment - it auto-confirms below.
      return { amount: Number(policy.premiumAmount), providerUserId: null };
    }
    default:
      throw ApiError.badRequest('Unknown payable type');
  }
}

/** Flips an overdue PENDING payment to EXPIRED on read, so nothing needs a background job. */
async function withLazyExpiry<T extends { status: string; expiresAt: Date; id: string }>(payment: T): Promise<T> {
  if (payment.status === 'PENDING' && payment.expiresAt.getTime() < Date.now()) {
    const updated = await prisma.payment.update({ where: { id: payment.id }, data: { status: 'EXPIRED' } });
    return updated as unknown as T;
  }
  return payment;
}

const createPaymentSchema = z.object({
  payableType: z.enum(['APPOINTMENT', 'PHARMACY_ORDER', 'LAB_TEST', 'NURSE_REQUEST', 'DONATION', 'INSURANCE_POLICY']),
  payableId: z.string(),
  method: z.enum(['USSD', 'TRANSFER', 'CARD', 'WALLET']),
});

export async function createPayment(req: Request, res: Response) {
  const data = createPaymentSchema.parse(req.body);

  if (data.method === 'WALLET') {
    throw ApiError.forbidden('Wallet payments are not available yet - this feature is pending licensing approval.');
  }

  const patient = await prisma.patientProfile.findUnique({ where: { userId: req.user!.userId } });
  if (!patient) throw ApiError.notFound('Patient profile not found');

  const { amount, providerUserId } = await resolvePayable(data.payableType, data.payableId, patient.id);
  if (amount <= 0) throw ApiError.badRequest('Nothing to pay for this item');

  const reference = generateReference();
  const now = new Date();
  const noProvider = providerUserId === null;

  const payment = await prisma.payment.create({
    data: {
      payerId: req.user!.userId,
      payableType: data.payableType,
      payableId: data.payableId,
      amount,
      method: data.method,
      providerUserId,
      reference,
      expiresAt: new Date(now.getTime() + PAYMENT_WINDOW_MS),
      // Donations and insurance premiums have no in-app party to confirm receipt,
      // so they're treated as settled immediately (simulating an instant charge).
      status: noProvider ? 'CONFIRMED' : 'PENDING',
      confirmedAt: noProvider ? now : null,
      ussdCode: data.method === 'USSD' ? `*901*000*${Math.round(amount)}*${reference}#` : null,
      transferBankName: data.method === 'TRANSFER' ? 'N-Health Demo Bank' : null,
      transferAccountName: data.method === 'TRANSFER' ? 'N-Health Ltd' : null,
      transferAccountNumber: data.method === 'TRANSFER' ? demoAccountNumber(reference) : null,
    },
  });

  if (providerUserId) {
    req.app.get('io')?.to(`user:${providerUserId}`).emit('payment:new', payment);
  } else if (data.payableType === 'DONATION') {
    // Auto-confirmed above (no in-app party to confirm it) - reflect that on the donation itself.
    await prisma.donation.update({ where: { id: data.payableId }, data: { status: 'COMPLETED' } });
  }

  res.status(201).json(payment);
}

export async function getPayment(req: Request, res: Response) {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.payerId !== req.user!.userId && payment.providerUserId !== req.user!.userId) {
    throw ApiError.forbidden();
  }
  res.json(await withLazyExpiry(payment));
}

export async function listMyPayments(req: Request, res: Response) {
  const payments = await prisma.payment.findMany({
    where: { payerId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(await Promise.all(payments.map(withLazyExpiry)));
}

/** A provider's queue of payments awaiting their confirmation. */
export async function listIncomingPayments(req: Request, res: Response) {
  const payments = await prisma.payment.findMany({
    where: { providerUserId: req.user!.userId, status: 'PENDING' },
    include: { payer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(await Promise.all(payments.map(withLazyExpiry)));
}

export async function confirmPayment(req: Request, res: Response) {
  const existing = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Payment not found');
  const payment = await withLazyExpiry(existing);

  if (payment.providerUserId !== req.user!.userId) throw ApiError.forbidden('You are not the recipient of this payment');
  if (payment.status !== 'PENDING') throw ApiError.conflict(`Payment is already ${payment.status.toLowerCase()}`);

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedById: req.user!.userId },
  });

  // Nudge the underlying record forward now that money has changed hands.
  if (payment.payableType === 'PHARMACY_ORDER') {
    await prisma.pharmacyOrder.updateMany({
      where: { id: payment.payableId, status: 'PENDING' },
      data: { status: 'PROCESSING', paymentStatus: 'PAID' },
    });
  }

  req.app.get('io')?.to(`user:${payment.payerId}`).emit('payment:confirmed', updated);
  res.json(updated);
}

export async function cancelPayment(req: Request, res: Response) {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment || payment.payerId !== req.user!.userId) throw ApiError.notFound('Payment not found');
  if (payment.status !== 'PENDING') throw ApiError.conflict(`Payment is already ${payment.status.toLowerCase()}`);

  const updated = await prisma.payment.update({ where: { id: payment.id }, data: { status: 'CANCELLED' } });
  res.json(updated);
}

const PAYABLE_LABEL: Record<string, string> = {
  APPOINTMENT: 'Consultation fee',
  PHARMACY_ORDER: 'Pharmacy order',
  LAB_TEST: 'Lab test fee',
  NURSE_REQUEST: 'Nurse visit fee',
  DONATION: 'Donation',
  INSURANCE_POLICY: 'Insurance premium',
};

export async function getReceiptPdf(req: Request, res: Response) {
  const payment = await prisma.payment.findUnique({
    where: { id: req.params.id },
    include: { payer: { select: { name: true } } },
  });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.payerId !== req.user!.userId && payment.providerUserId !== req.user!.userId) {
    throw ApiError.forbidden();
  }
  if (payment.status !== 'CONFIRMED') {
    throw ApiError.badRequest('A receipt is only available once a payment is confirmed');
  }

  const h = await startDocument('Payment Receipt', `Ref: ${payment.reference}`);
  drawField(h, 'Paid by', payment.payer.name);
  drawField(h, 'For', PAYABLE_LABEL[payment.payableType] ?? payment.payableType);
  drawField(h, 'Method', payment.method);
  drawField(h, 'Confirmed on', (payment.confirmedAt ?? payment.createdAt).toLocaleString());
  drawTotal(h, 'Amount Paid', formatNaira(Number(payment.amount)));
  drawFooterNote(h, 'This receipt confirms a payment recorded on the N-Health platform.');

  const pdf = await finishDocument(h);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="receipt-${payment.reference}.pdf"`);
  res.send(pdf);
}
