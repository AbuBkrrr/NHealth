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
  const res = await http.post(`${env.raw.DIDIT_BASE_URL}/v3/session/`, {
    workflow_id: opts.workflowId || env.raw.DIDIT_WORKFLOW_ID,
    vendor_data: opts.userId,
    callback: opts.callback,
    metadata: { purpose: opts.purpose, ...(opts.metadata || {}) },
  }, { headers: { 'x-api-key': env.raw.DIDIT_API_KEY!, 'Content-Type': 'application/json' } });
  return res.data as { session_id: string; session_number?: number; session_token?: string; url: string; status: string };
}

export async function getDecision(sessionId: string) {
  const res = await http.get(`${env.raw.DIDIT_BASE_URL}/v3/session/${sessionId}/decision/`, {
    headers: { 'x-api-key': env.raw.DIDIT_API_KEY! },
  });
  return res.data as any;
}

/** Recursively sorts keys and turns integer-valued floats into integers (Didit's canonical form for X-Signature-V2). */
function canonical(v: any): any {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o: any, k) => { o[k] = canonical(v[k]); return o; }, {});
  if (typeof v === 'number' && Number.isInteger(v)) return Math.trunc(v);
  return v;
}

/** JSON with Python's default separators (", " and ": ") - the form produced by json.dumps(sort_keys=True, ensure_ascii=False). */
function pyJson(v: any): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '[' + v.map(pyJson).join(', ') + ']';
  if (typeof v === 'object') return '{' + Object.keys(v).map((k) => JSON.stringify(k) + ': ' + pyJson(v[k])).join(', ') + '}';
  return JSON.stringify(v);
}

const safeEq = (a: string, b: string) => { try { return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; } };

/**
 * Verifies a Didit webhook (API v3). Per Didit's docs: try X-Signature-V2 first (HMAC-SHA256 over the
 * re-serialised body with sorted keys, Unicode preserved), then fall back to X-Signature (HMAC over the raw
 * bytes). Deliveries whose X-Timestamp is older than 5 minutes are rejected.
 */
export function verifyWebhook(rawBody: string, headers: Record<string, any>): boolean {
  const secret = env.raw.DIDIT_WEBHOOK_SECRET;
  if (!secret) return env.nodeEnv !== 'production';
  const ts = Number(headers['x-timestamp']);
  if (ts && Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const h = (s: string) => crypto.createHmac('sha256', secret).update(s, 'utf8').digest('hex');
  const v2 = String(headers['x-signature-v2'] || '');
  const v1 = String(headers['x-signature'] || '');
  if (v2) {
    try {
      const c = canonical(JSON.parse(rawBody));
      if ([JSON.stringify(c), pyJson(c)].some((form) => safeEq(v2, h(form)))) return true;
    } catch { /* fall through to raw-body check */ }
  }
  if (v1 && safeEq(v1, h(rawBody))) return true;
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
