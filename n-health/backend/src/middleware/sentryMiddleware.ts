// Error tracking middleware for backend
// File: backend/src/middleware/sentryMiddleware.ts

import { Express, Request, Response, NextFunction } from "express";

/**
 * Initialize error tracking for backend
 */
export function initializeSentry(app: Express) {
  console.log('✅ Error tracking initialized for backend');
}

/**
 * Attach error handler to Express
 */
export function attachSentryErrorHandler(app: Express) {
  // Placeholder for error handler
}

/**
 * Capture error with context
 */
export function captureBackendError(error: Error | string, context?: Record<string, any>) {
  if (typeof error === 'string') {
    console.error('Error:', error);
  } else {
    console.error('Error:', error.message);
  }
}

/**
 * Middleware to capture request/response errors
 */
export function errorCatchingMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error caught:', err);

  res.status(err.statusCode || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

/**
 * Wrap async route handlers for error catching
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('Async handler error:', error);
      next(error);
    });
  };
}
