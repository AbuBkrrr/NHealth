import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { verifyWebhookSignature as verifyGatewaySignature, Gateway } from '../services/gateways';
import { settleCreditPurchase } from '../services/creditSettlement';
import { notify } from '../services/notify';
import * as didit from '../services/didit';
import { onKycDecision } from '../services/kyc';

/** Common handler: authenticate webhook, then settle the referenced top-up if the gateway says it succeeded. */
async function gatewayWebhook(gateway: Gateway, req: Request, res: Response, extract: (b: any) => { ref?: string; ok: boolean; amount?: number; currency?: string; gatewayRef?: string }) {
  if (!verifyGatewaySignature(gateway, req.rawBody || '', req.headers)) {
    console.warn(`[webhook:${gateway}] invalid signature`);
    return res.status(401).json({ error: 'Invalid signature' });
  }
  try {
    // Payout transfer outcomes (Paystack transfer.*, Flutterwave transfer.completed)
    const b: any = req.body || {};
    if (typeof b.event === 'string' && b.event.startsWith('transfer.')) {
      const { markPayout } = await import('../services/earnings');
      const ref = b.data?.reference;
      if (ref) {
        if (gateway === 'paystack') {
          if (b.event === 'transfer.success') await markPayout(ref, 'PAID');
          else if (b.event === 'transfer.failed') await markPayout(ref, 'FAILED', b.data?.reason || b.data?.gateway_response || 'Transfer failed');
          else if (b.event === 'transfer.reversed') await markPayout(ref, 'REVERSED', 'Transfer reversed by the bank');
        } else if (gateway === 'flutterwave') {
          const st = String(b.data?.status || '').toUpperCase();
          if (st === 'SUCCESSFUL') await markPayout(ref, 'PAID');
          else if (st === 'FAILED') await markPayout(ref, 'FAILED', b.data?.complete_message || 'Transfer failed');
        }
      }
      return res.status(200).json({ received: true });
    }
    const e = extract(req.body || {});
    if (e.ok && e.ref) {
      await prisma.paymentGatewayLog.updateMany({ where: { internalRef: e.ref }, data: { webhookPayload: req.body } });
      // Webhook body is authenticated; still require amount/currency to match the pending log.
      const verified = e.amount !== undefined && e.currency ? { amount: e.amount, currency: e.currency, gatewayRef: e.gatewayRef || '', raw: req.body } : undefined;
      await settleCreditPurchase(e.ref, verified);
    }
  } catch (err) {
    console.error(`[webhook:${gateway}] error`, err);
  }
  res.status(200).json({ received: true });
}

export const paystackWebhook = (req: Request, res: Response) => gatewayWebhook('paystack', req, res, (b) => ({
  ok: b.event === 'charge.success' && b.data?.status === 'success', ref: b.data?.reference,
  amount: b.data ? Number(b.data.amount) / 100 : undefined, currency: b.data?.currency, gatewayRef: String(b.data?.id ?? ''),
}));

export const flutterwaveWebhook = (req: Request, res: Response) => gatewayWebhook('flutterwave', req, res, (b) => ({
  // Flutterwave's verif-hash is a shared secret, not a body signature -> re-verify via API (verified undefined).
  ok: (b.event === 'charge.completed' || b['event.type'] === 'CARD_TRANSACTION') && (b.data?.status === 'successful'), ref: b.data?.tx_ref,
}));

export const fincraWebhook = (req: Request, res: Response) => gatewayWebhook('fincra', req, res, (b) => ({
  ok: b.event === 'charge.successful' || b.event === 'collection.successful', ref: b.data?.merchantReference || b.data?.reference,
  amount: b.data?.amount !== undefined ? Number(b.data.amount) : undefined, currency: b.data?.currency, gatewayRef: b.data?.reference,
}));

export const monnifyWebhook = (req: Request, res: Response) => gatewayWebhook('monnify', req, res, (b) => ({
  ok: b.eventType === 'SUCCESSFUL_TRANSACTION', ref: b.eventData?.paymentReference,
  amount: b.eventData?.amountPaid !== undefined ? Number(b.eventData.amountPaid) : undefined, currency: b.eventData?.currency || 'NGN',
  gatewayRef: b.eventData?.transactionReference,
}));

// Didit identity verification
export async function diditWebhook(req: Request, res: Response) {
  if (!didit.verifyWebhook(req.rawBody || '', req.headers)) return res.status(401).json({ error: 'Invalid signature' });
  try {
    const b = req.body || {};
    if (b.session_id) {
      // Some v3 deliveries carry only the status; fetch the full decision for final outcomes.
      let decision = b.decision;
      if (!decision && ['Approved', 'Declined', 'In Review'].includes(b.status) && didit.DIDIT_CONFIGURED()) decision = await didit.getDecision(b.session_id).catch(() => undefined);
      await onKycDecision(b.session_id, b.status, decision, b.vendor_data);
    }
  } catch (e) {
    console.error('[webhook:didit]', e);
  }
  res.status(200).json({ received: true });
}

// PayScrow
import { verifyWebhookSignature } from '../services/payscrowService';

export async function payscrowWebhook(req: Request, res: Response) {
  try {
    // Raw body needed for signature verification
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const signature = req.headers['x-payscrow-signature'] as string;
    const timestamp = req.headers['x-payscrow-timestamp'] as string;

    if (!verifyWebhookSignature(rawBody, timestamp, signature)) {
      console.warn('PayScrow webhook: invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event, transactionId, transactionNumber, externalReference, paymentStatus, escrowStatus, escrowCode, amountPaid, status } = req.body;

    console.log('PayScrow webhook:', event || 'transaction.paid', transactionNumber);

    if (event === 'dispute.status_changed') {
      const escrow = await prisma.escrowTransaction.findFirst({ where: { payscrowRef: transactionNumber } });
      if (escrow) {
        const newStatus = req.body.disputeStatus === 'Resolved' ? 'released' : 'disputed';
        await prisma.escrowTransaction.update({
          where: { id: escrow.id },
          data: { status: newStatus, metadata: req.body },
        });
      }
      return res.status(200).json({ received: true });
    }

    // Transaction paid
    const escrow = await prisma.escrowTransaction.findFirst({
      where: { OR: [{ externalReference }, { payscrowRef: transactionNumber }] },
    });

    if (escrow && paymentStatus === 'Paid') {
      await prisma.escrowTransaction.update({
        where: { id: escrow.id },
        data: {
          status: 'in_escrow',
          fundedAt: new Date(),
          payscrowTransactionId: transactionId || escrow.payscrowTransactionId,
          escrowCode: escrowCode && !escrowCode.includes('payee') ? escrowCode : escrow.escrowCode,
          totalPayable: Number(amountPaid) || escrow.totalPayable,
        },
      });
      console.log(`Escrow funded: ${escrow.id} (${transactionNumber})`);
      if (escrow.purpose === 'appointment') {
        await prisma.appointment.updateMany({ where: { id: escrow.purposeId }, data: { paymentStatus: 'PAID_ESCROW' } });
      } else if (escrow.purpose === 'pharmacy') {
        await prisma.pharmacyOrder.updateMany({ where: { id: escrow.purposeId }, data: { paymentStatus: 'PAID', status: 'PROCESSING' } });
      } else if (escrow.purpose === 'lab') {
        await prisma.labTest.updateMany({ where: { id: escrow.purposeId }, data: { paymentStatus: 'PAID_ESCROW' } });
      }
      await notify(escrow.userId, 'payment', 'Payment secured in escrow 🔒', 'Your payment is held safely and released to the provider once you confirm the service.', { data: { escrowId: escrow.id } });
      if (escrow.providerUserId) await notify(escrow.providerUserId, 'payment', 'New paid booking', 'A patient has paid into escrow for your service.', { data: { escrowId: escrow.id } });
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('PayScrow webhook error:', err);
    res.status(200).json({ received: true });
  }
}
