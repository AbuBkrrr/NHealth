import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractBearerToken } from '@nhealth/shared-utils';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import type { Role } from '@nhealth/shared-types';

/**
 * Extend Express's Request type with the authenticated user's identity.
 */
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: Role; isSuperAdmin: boolean };
      rawBody?: string;
    }
  }
}

// Short-lived cache of account state so revocation (logout-all, password reset, suspension)
// takes effect within seconds without a DB hit on every request.
const stateCache = new Map<string, { tv: number; active: boolean; at: number }>();
const TTL = 15_000;
export function invalidateUserState(userId: string) { stateCache.delete(userId); }

async function accountState(userId: string) {
  const c = stateCache.get(userId);
  if (c && Date.now() - c.at < TTL) return c;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true, isActive: true, deletedAt: true } });
  const s = { tv: u?.tokenVersion ?? -1, active: !!u && u.isActive && !u.deletedAt, at: Date.now() };
  stateCache.set(userId, s);
  if (stateCache.size > 50_000) stateCache.clear();
  return s;
}

/**
 * Requires a valid JWT in the Authorization header. Attaches req.user.
 * Rejects tokens of deactivated/deleted accounts and tokens older than the user's tokenVersion.
 * @throws ApiError with status 401 if token is missing or invalid
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  let payload: any;
  try {
    payload = verifyToken(token, env.jwtSecret);
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
  accountState(payload.userId).then((s) => {
    if (!s.active) return next(ApiError.unauthorized('Account is not active'));
    if ((payload.tv ?? 0) !== s.tv) return next(ApiError.unauthorized('Session expired - please sign in again'));
    req.user = { userId: payload.userId, role: payload.role as Role, isSuperAdmin: !!payload.isSuperAdmin };
    next();
  }).catch(next);
}

/**
 * Restricts a route to one or more roles. Use after requireAuth.
 * @param roles - Allowed role strings
 * @throws ApiError with status 403 if user role is not allowed
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
    next();
  };
}

/**
 * Restricts a route to super admins only. Use after requireAuth + requireRole('ADMIN').
 * @throws ApiError with status 403 if user is not a super admin
 */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(ApiError.unauthorized());
  if (!req.user.isSuperAdmin) return next(ApiError.forbidden('Requires super admin access'));
  next();
}

/** Blocks provider actions until an admin has verified the provider's licence documents. */
export function requireVerifiedProvider(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) return next(ApiError.unauthorized());
  const enforce = process.env.REQUIRE_PROVIDER_VERIFICATION ? process.env.REQUIRE_PROVIDER_VERIFICATION === '1' : env.nodeEnv === 'production';
  if (!enforce) return next();
  prisma.user.findUnique({ where: { id: req.user.userId }, select: { verificationStatus: true } }).then((u) => {
    if (u?.verificationStatus !== 'VERIFIED') return next(ApiError.forbidden('Your provider account is awaiting verification. Upload your licence in Profile → Verification.'));
    next();
  }).catch(next);
}
