import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Zod validation errors
  if (err && typeof err === 'object' && 'issues' in (err as any)) {
    return res.status(400).json({ error: 'Validation failed', details: (err as any).issues });
  }

  // Prisma unique-constraint violations (e.g. a duplicate email/phone/license
  // number) - without this, any such collision anywhere in the app would
  // otherwise fall through to a bare 500 instead of a clear message.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const fields = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'value';
    return res.status(409).json({ error: `That ${fields} is already in use` });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
}
