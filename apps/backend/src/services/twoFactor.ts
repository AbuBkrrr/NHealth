// Two-step verification (2FA) for every account, including admins.
//  - "totp": a code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…), RFC 6238
//  - "email": a 6-digit code emailed at each sign-in (for people without an authenticator app)
// Plus 10 one-time backup codes. The authenticator secret is stored encrypted (AES-256-GCM).
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { signToken, verifyToken } from '../utils/jwt';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(buf: Buffer) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(s: string) {
  const clean = s.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out: number[] = [];
  for (const c of clean) { value = (value << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
/** The 6-digit code for a base32 secret at a moment (30-second steps). */
export function totp(secret: string, at = Date.now(), step = 30) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / step)));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, '0');
}
/** Accepts the current code and one step either side (phone clocks drift). */
export function verifyTotp(secret: string, code: string) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  return [-1, 0, 1].some((w) => crypto.timingSafeEqual(Buffer.from(totp(secret, Date.now() + w * 30_000)), Buffer.from(c)));
}

const key = () => crypto.createHash('sha256').update(env.jwtSecret + ':2fa-secret').digest();
export function seal(plain: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}
export function unseal(sealed: string) {
  const [iv, tag, enc] = sealed.split('.').map((x) => Buffer.from(x, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

const hashCode = (c: string) => crypto.createHash('sha256').update('bk:' + c.replace(/[^a-z0-9]/gi, '').toLowerCase()).digest('hex');
/** 10 new backup codes (shown once) and their hashes (stored). */
export function newBackupCodes() {
  const codes = Array.from({ length: 10 }, () => { const r = crypto.randomBytes(5).toString('hex'); return r.slice(0, 5) + '-' + r.slice(5); });
  return { codes, hashes: codes.map(hashCode) };
}
/** Uses a backup code once. */
export async function useBackupCode(userId: string, code: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { twoFactorBackupCodes: true } });
  const list = (u?.twoFactorBackupCodes as string[] | null) || [];
  const h = hashCode(code);
  if (!list.includes(h)) return false;
  await prisma.user.update({ where: { id: userId }, data: { twoFactorBackupCodes: list.filter((x) => x !== h) } });
  return true;
}

/** A short-lived ticket proving the password step passed; only good for /auth/2fa/verify (never an access token). */
const challengeSecret = () => env.jwtSecret + ':2fa-challenge';
export const makeChallenge = (userId: string, role: string) => signToken({ userId, role, purpose: '2fa' } as any, challengeSecret(), '10m');
export function readChallenge(token: string): { userId: string; role: string } | null {
  try { const p: any = verifyToken(String(token || ''), challengeSecret()); return p?.purpose === '2fa' ? { userId: p.userId, role: p.role } : null; } catch { return null; }
}

/** Security policy (Admin → Account security): whether every admin must use 2FA. */
export async function getSecurityPolicy(): Promise<{ requireAdmin2fa: boolean }> {
  const row = await prisma.platformSetting.findUnique({ where: { key: 'security' } }).catch(() => null);
  return { requireAdmin2fa: false, ...((row?.value as any) || {}) };
}
export async function saveSecurityPolicy(patch: any, adminId: string) {
  const next = { ...(await getSecurityPolicy()), ...(typeof patch?.requireAdmin2fa === 'boolean' ? { requireAdmin2fa: patch.requireAdmin2fa } : {}) };
  await prisma.platformSetting.upsert({ where: { key: 'security' }, create: { key: 'security', value: next as any, updatedById: adminId }, update: { value: next as any, updatedById: adminId } });
  return next;
}
