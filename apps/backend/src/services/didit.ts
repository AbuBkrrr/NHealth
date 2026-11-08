import crypto from 'crypto';
import { env } from '../config/env';
import { http } from './http';

/**
 * Didit identity verification (government ID document + liveness + face match).
 * Flow: create a hosted session -> user completes it at `url` -> Didit calls our webhook
 * (and we can also poll the decision endpoint) -> we store the outcome on the user.
 */
export const DIDIT_CONFIGURED = () => !!(env.raw.DIDIT_API_KEY && env.raw.DIDIT_WORKFLOW_ID);

export async function createSession(opts: { userId: string; purpose: string; callback: string; workflowId?: string; metadata?: any }) {
  const res = await http.post(`${env.raw.DIDIT_BASE_URL}/v2/session/`, {
    workflow_id: opts.workflowId || env.raw.DIDIT_WORKFLOW_ID,
    vendor_data: opts.userId,
    callback: opts.callback,
    metadata: { purpose: opts.purpose, ...(opts.metadata || {}) },
  }, { headers: { 'x-api-key': env.raw.DIDIT_API_KEY!, 'Content-Type': 'application/json' } });
  return res.data as { session_id: string; session_number?: number; session_token?: string; url: string; status: string };
}

export async function getDecision(sessionId: string) {
  const res = await http.get(`${env.raw.DIDIT_BASE_URL}/v2/session/${sessionId}/decision/`, {
    headers: { 'x-api-key': env.raw.DIDIT_API_KEY! },
  });
  return res.data as any;
}

/** Recursively sorts keys and normalises integer-valued floats, matching Didit's X-Signature-V2 canonical form. */
function canonical(v: any): any {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o: any, k) => { o[k] = canonical(v[k]); return o; }, {});
  if (typeof v === 'number' && Number.isInteger(v)) return Math.trunc(v);
  return v;
}

const safeEq = (a: string, b: string) => { try { return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; } };

/** Verifies a Didit webhook. Accepts X-Signature (HMAC-SHA256 of raw body) or X-Signature-V2 (of canonical JSON). */
export function verifyWebhook(rawBody: string, headers: Record<string, any>): boolean {
  const secret = env.raw.DIDIT_WEBHOOK_SECRET;
  if (!secret) return env.nodeEnv !== 'production';
  const ts = Number(headers['x-timestamp']);
  if (ts && Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const h = (s: string) => crypto.createHmac('sha256', secret).update(s, 'utf8').digest('hex');
  const v1 = String(headers['x-signature'] || '');
  const v2 = String(headers['x-signature-v2'] || '');
  if (v1 && safeEq(v1, h(rawBody))) return true;
  if (v2) {
    try { if (safeEq(v2, h(JSON.stringify(canonical(JSON.parse(rawBody)))))) return true; } catch { /* fallthrough */ }
  }
  return false;
}

/** Maps Didit status strings to our KycStatus enum. */
export function mapStatus(s: string): 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'DECLINED' | 'EXPIRED' {
  const x = (s || '').toLowerCase();
  if (x === 'approved') return 'APPROVED';
  if (x === 'declined') return 'DECLINED';
  if (x === 'in review') return 'IN_REVIEW';
  if (x === 'expired' || x === 'abandoned') return 'EXPIRED';
  return 'PENDING';
}
