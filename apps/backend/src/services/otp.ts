import crypto from 'crypto';
import { prisma } from '../config/prisma';

const hash = (code: string) => crypto.createHash('sha256').update(code).digest('hex');
const MAX_ATTEMPTS = 5;

/** Issues a 6-digit one-time code (stored hashed, 10 min TTL). Invalidates older codes for the same target/purpose. */
export async function issueOtp(target: string, purpose: string, userId?: string) {
  const code = String(crypto.randomInt(100000, 1000000));
  await prisma.otpCode.updateMany({ where: { target, purpose, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.otpCode.create({ data: { target, purpose, userId, codeHash: hash(code), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
  return code;
}

/** Checks a code; locks after 5 wrong attempts. `consume` marks it used. */
export async function checkOtp(target: string, purpose: string, code: string, consume: boolean): Promise<boolean> {
  const rec = await prisma.otpCode.findFirst({ where: { target, purpose, usedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!rec || rec.expiresAt < new Date() || rec.attempts >= MAX_ATTEMPTS) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(rec.codeHash), Buffer.from(hash(String(code || ''))));
  if (!ok) { await prisma.otpCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } }); return false; }
  if (consume) await prisma.otpCode.update({ where: { id: rec.id }, data: { usedAt: new Date() } });
  return true;
}
