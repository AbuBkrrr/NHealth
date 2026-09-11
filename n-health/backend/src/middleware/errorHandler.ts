import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/ApiError';

/**
 * Map Prisma error codes to HTTP status codes and user-friendly messages
 */
const PRISMA_ERROR_MAP: Record<string, { status: number; message: (meta?: any) => string }> = {
  // Constraint violations (e.g., duplicate email, phone, license number)
  P2002: {
    status: 409,
    message: (meta) =>
      `That ${(meta?.target as string[])?.join(', ') ?? 'value'} is already in use`,
  },
  // Foreign key constraint violation (referenced record doesn't exist)
  P2003: {
    status: 400,
    message: (meta) =>
      `Referenced record does not exist: ${(meta?.field_name as string) ?? 'foreign key'}`,
  },
  // Record not found
  P2025: {
    status: 404,
    message: () => 'The requested record does not exist',
  },
  // Query error
  P2015: {
    status: 500,
    message: () => 'Query failed due to server error',
  },
  // Invalid relation
  P2018: {
    status: 500,
    message: () => 'Invalid relation configuration',
  },
  // Unsupported field value
  P2009: {
    status: 400,
    message: () => 'Unsupported field value provided',
  },
};

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Custom API errors (throw new ApiError(statusCode, message))
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Zod validation errors
  if (err && typeof err === 'object' && 'issues' in (err as any)) {
    return res.status(400).json({
      error: 'Validation failed',
      details: (err as any).issues,
    });
  }

  // Prisma known errors (network, database logic errors)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = PRISMA_ERROR_MAP[err.code];
    if (prismaError) {
      return res.status(prismaError.status).json({
        error: prismaError.message(err.meta),
      });
    }
    // Unmapped Prisma error
    console.error('[PrismaError]', err.code, err.message);
    return res.status(500).json({
      error: 'Database error',
      message: 'A database error occurred. Please try again later.',
    });
  }

  // Prisma validation errors (schema mismatches)
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: 'Invalid data provided',
      message: 'Please check your input format and try again',
    });
  }

  // Prisma runtime panic (critical)
  if (err instanceof Prisma.PrismaClientRustPanicError) {
    console.error('[CRITICAL-PANIC]', err);
    return res.status(500).json({
      error: 'Database system error',
      message: 'A critical database error occurred. Our team has been notified.',
    });
  }

  // Prisma initialization error
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error('[INIT-ERROR]', err);
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Database connection is unavailable. Please try again shortly.',
    });
  }

  // Generic error - log for debugging
  console.error('[Unhandled Error]', {
    name: err instanceof Error ? err.name : typeof err,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  return res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred. Please try again later.',
  });
}
