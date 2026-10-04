import axios from 'axios';
import { env } from '../config/env';

// ============================================================
// PAYSCROW API CLIENT
// Spec: https://api.payscrow.net/api/v3/...
// Auth: BrokerApiKey header
// ============================================================

const PAYSCROW_BASE = process.env.PAYSCROW_BASE_URL || 'https://api.payscrow.net';
const BROKER_KEY = process.env.PAYSCROW_API_KEY || '';
const WEBHOOK_SECRET = process.env.PAYSCROW_WEBHOOK_SECRET || '';

const client = axios.create({
  baseURL: PAYSCROW_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'BrokerApiKey': BROKER_KEY,
  },
});

function log(...args: any[]) { console.log('[PayScrow]', ...args); }

// ============================================================
// CALCULATE CHARGES
// GET /api/v3/marketplace/charges/calculate
// ============================================================
export async function calculateCharges(amount: number, merchantChargePercentage = 50, currencyCode = 'NGN') {
  const url = '/api/v3/marketplace/charges/calculate';
  log('Calculating charges', { amount, merchantChargePercentage, currencyCode });
  const res = await client.get(url, {
    params: { currencyCode, amount, merchantChargePercentage },
  });
  return res.data;
}

// ============================================================
// START TRANSACTION
// POST /api/v3/marketplace/transactions/start
// ============================================================
export interface StartTransactionInput {
  transactionReference: string;
  merchantEmailAddress: string;
  merchantPhoneNo?: string;
  merchantName: string;
  customerEmailAddress: string;
  customerPhoneNo: string;
  customerName: string;
  currencyCode?: string;
  merchantChargePercentage?: number;
  returnUrl?: string;
  webhookNotificationUrl?: string;
  items: Array<{ name: string; description?: string; quantity: number; price: number }>;
  settlementAccounts?: Array<{ bankCode: string; accountNumber: string; accountName: string; amount: number }>;
}

export async function startTransaction(input: StartTransactionInput) {
  log('Starting transaction', input.transactionReference);

  const payload = {
    currencyCode: 'NGN',
    merchantChargePercentage: 50,
    webhookNotificationUrl: `${process.env.PUBLIC_API_URL || 'https://n-health-backend-production.up.railway.app'}/api/webhooks/payscrow`,
    ...input,
  };

  const res = await client.post('/api/v3/marketplace/transactions/start', payload);
  log('Transaction created:', res.data?.data?.transactionNumber);
  return res.data;
}

// ============================================================
// GET STATUS
// GET /api/v3/marketplace/transactions/{transactionNumber}/status
// ============================================================
export async function getTransactionStatus(transactionNumber: string) {
  const res = await client.get(`/api/v3/marketplace/transactions/${transactionNumber}/status`);
  return res.data;
}

// ============================================================
// APPLY ESCROW CODE (release funds)
// POST /api/v3/escrow/escrowtransactions/applycode
// ============================================================
export async function applyEscrowCode(transactionId: string, code: string) {
  log('Applying escrow code for', transactionId);
  const res = await client.post('/api/v3/escrow/escrowtransactions/applycode', {
    transactionId,
    code,
  });
  return res.data;
}

// ============================================================
// RAISE DISPUTE
// POST /api/v3/marketplace/transactions/{transactionNumber}/broker/raise-dispute
// ============================================================
export async function raiseDispute(transactionNumber: string, requestedBy: 'merchant' | 'customer', complaint: string) {
  const res = await client.post(
    `/api/v3/marketplace/transactions/${transactionNumber}/broker/raise-dispute`,
    { requestedBy, complaint }
  );
  return res.data;
}

// ============================================================
// SUPPORTED BANKS
// GET /api/v3/payments/banks/broker/supported-banks
// ============================================================
export async function getSupportedBanks() {
  const res = await client.get('/api/v3/payments/banks/broker/supported-banks');
  return res.data?.data?.banks || [];
}

// ============================================================
// WEBHOOK SIGNATURE VERIFICATION
// X-PayScrow-Signature: sha256=<hex>
// HMAC-SHA256(secret, "{timestamp}.{rawBody}")
// ============================================================
import crypto from 'crypto';

export function verifyWebhookSignature(rawBody: string, timestamp: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('[PayScrow] No webhook secret configured — skipping verification');
    return true;
  }
  if (!timestamp || !signature) return false;

  // Reject if older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
    console.warn('[PayScrow] Stale webhook timestamp:', timestamp);
    return false;
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (e) {
    return false;
  }
}

export const PAYSCROW_CONFIGURED = !!BROKER_KEY;