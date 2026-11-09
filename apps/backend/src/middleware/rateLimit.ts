import rateLimit from 'express-rate-limit';

const base = { standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests - please slow down and try again shortly.' } };
const isTest = () => process.env.NODE_ENV === 'test';

/** Global API ceiling per IP. */
export const apiLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 300, skip: isTest });
/** Login / register / Google sign-in. */
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 30, skip: isTest });
/** OTP sending and checking (password reset, email/phone verification). */
export const otpLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 10, skip: isTest });
/** Uploads and money-moving endpoints. */
export const sensitiveLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 30, skip: isTest });
