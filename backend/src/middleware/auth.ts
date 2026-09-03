import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { Role } from '@prisma/client';

// Extend Express's Request type with the authenticated user's identity.
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: Role; isSuperAdmin: boolean };
    }
  }
}

/** Requires a valid JWT in the Authorization header. Attaches req.user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyToken(token);
    req.user = { userId: payload.userId, role: payload.role as Role, isSuperAdmin: !!payload.isSuperAdmin };
    next();
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

/** Restricts a route to one or more roles. Use after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden(`Requires role: ${roles.join(' or ')}`);
    }
    next();
  };
}

/** Restricts a route to super admins only. Use after requireAuth + requireRole('ADMIN'). */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw ApiError.unauthorized();
  if (!req.user.isSuperAdmin) throw ApiError.forbidden('Requires super admin access');
  next();
}
