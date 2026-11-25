import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err && typeof err === 'object' && 'issues' in err) {
    res.status(400).json({
      error: 'Validation failed',
      details: (err as { issues: unknown }).issues,
    });
    return;
  }

  // Check for Prisma unique constraint error
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    err.code === 'P2002' &&
    'meta' in err
  ) {
    const meta = err.meta as { target?: string[] } | undefined;
    const target = meta?.target;
    const fields = Array.isArray(target) ? target.join(', ') : 'value';
    res.status(409).json({ error: 'That ' + fields + ' is already in use' });
    return;
  }

  if (err && typeof err === 'object' && 'status' in err && typeof (err as any).status === 'number' && (err as any).status < 500) {
    res.status((err as any).status).json({ error: (err as any).message });
    return;
  }
  if (err && typeof err === 'object' && (err as any).type === 'entity.too.large') {
    res.status(413).json({ error: 'Upload too large' });
    return;
  }
  if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'P2025') {
    res.status(404).json({ error: 'Record not found' });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
