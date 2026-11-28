import rateLimit from 'express-rate-limit';

const base = { standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests - please slow down and try again shortly.' } };
const isTest = () => process.env.NODE_ENV === 'test';
/**
 * Signed-in requests are counted per account, others per IP. Nigerian mobile networks put many phones behind one
 * shared IP (carrier NAT), so counting signed-in users by IP would let one busy user block everyone on that network.
 */
const perUser = { keyGenerator: (req: any) => (req.user?.userId ? 'u:' + req.user.userId : 'ip:' + (req.ip || '')) };

/** Global API ceiling per IP. */
export const apiLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 300, skip: isTest });
/** Login / register / Google sign-in. */
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 30, skip: isTest });
/** OTP sending and checking (password reset, email/phone verification). */
export const otpLimiter = rateLimit({ ...base, ...perUser, windowMs: 15 * 60_000, limit: 10, skip: isTest });
/** Uploads and money-moving endpoints. */
export const sensitiveLimiter = rateLimit({ ...base, ...perUser, windowMs: 60_000, limit: 30, skip: isTest });
/** Public marketing endpoints (page opens, lead form). */
export const marketingLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 40, skip: isTest });
