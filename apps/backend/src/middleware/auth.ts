import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractBearerToken } from '@nhealth/shared-utils';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import type { Role } from '@nhealth/shared-types';

/**
 * Extend Express's Request type with the authenticated user's identity.
 */
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: Role; isSuperAdmin: boolean };
    }
  }
}

/**
 * Requires a valid JWT in the Authorization header. Attaches req.user.
 * @throws ApiError with status 401 if token is missing or invalid
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  try {
    const payload = verifyToken(token, env.jwtSecret);
    req.user = {
      userId: payload.userId,
      role: payload.role as Role,
      isSuperAdmin: !!payload.isSuperAdmin,
    };
    next();
  } catch (error) {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

/**
 * Restricts a route to one or more roles. Use after requireAuth.
 * @param roles - Allowed role strings
 * @throws ApiError with status 403 if user role is not allowed
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(`Requires role: ${roles.join(' or ')}`);
    }
    next();
  };
}

/**
 * Restricts a route to super admins only. Use after requireAuth + requireRole('ADMIN').
 * @throws ApiError with status 403 if user is not a super admin
 */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  if (!req.user.isSuperAdmin) {
    throw ApiError.forbidden('Requires super admin access');
  }
  next();
}
