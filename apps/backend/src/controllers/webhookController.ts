import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { purchaseCredits } from '../services/creditsService';

// Fincra
export async function fincraWebhook(req: Request, res: Response) {
  try {
    const { event, data } = req.body;
    console.log('Fincra webhook:', event, data && data.reference);
    if (event === 'charge.successful' || event === 'collection.successful') {
      const internalRef = (data && data.merchantReference) || (data && data.reference);
      const log = await prisma.paymentGatewayLog.findFirst({
        where: { internalRef, gateway: 'fincra', status: 'pending' },
      });
      if (log && log.userId) {
        await purchaseCredits(log.userId, Number(log.amount), internalRef, 'Credit purchase via Fincra', { gateway: 'fincra', gatewayRef: data && data.reference });
        await prisma.paymentGatewayLog.update({ where: { id: log.id }, data: { status: 'success', gatewayRef: (data && data.reference) || log.gatewayRef, webhookPayload: req.body } });
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Fincra webhook error:', err);
    res.status(200).json({ received: true });
  }
}

// Monnify
export async function monnifyWebhook(req: Request, res: Response) {
  try {
    const { eventType, eventData } = req.body;
    console.log('Monnify webhook:', eventType, eventData && eventData.paymentReference);
    if (eventType === 'SUCCESSFUL_TRANSACTION') {
      const internalRef = eventData && eventData.paymentReference;
      const log = await prisma.paymentGatewayLog.findFirst({
        where: { internalRef, gateway: 'monnify', status: 'pending' },
      });
      if (log && log.userId) {
        await purchaseCredits(log.userId, Number(log.amount), internalRef, 'Credit purchase via Monnify', { gateway: 'monnify', gatewayRef: eventData && eventData.transactionReference });
        await prisma.paymentGatewayLog.update({ where: { id: log.id }, data: { status: 'success', gatewayRef: (eventData && eventData.transactionReference) || log.gatewayRef, webhookPayload: req.body } });
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Monnify webhook error:', err);
    res.status(200).json({ received: true });
  }
}

// Flutterwave
export async function flutterwaveWebhook(req: Request, res: Response) {
  try {
    const hash = req.headers['verif-hash'];
    const expectedHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    if (expectedHash && hash !== expectedHash) {
      console.warn('Flutterwave webhook: invalid hash');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const { event, data } = req.body;
    console.log('Flutterwave webhook:', event, data && data.tx_ref);
    if (event === 'charge.completed' && data && data.status === 'successful') {
      const internalRef = data && data.tx_ref;
      const log = await prisma.paymentGatewayLog.findFirst({
        where: { internalRef, gateway: 'flutterwave', status: 'pending' },
      });
      if (log && log.userId) {
        await purchaseCredits(log.userId, Number(log.amount), internalRef, 'Credit purchase via Flutterwave', { gateway: 'flutterwave', gatewayRef: String(data && data.id) });
        await prisma.paymentGatewayLog.update({ where: { id: log.id }, data: { status: 'success', gatewayRef: String((data && data.id) || log.gatewayRef), webhookPayload: req.body } });
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Flutterwave webhook error:', err);
    res.status(200).json({ received: true });
  }
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
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('PayScrow webhook error:', err);
    res.status(200).json({ received: true });
  }
}
