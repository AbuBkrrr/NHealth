// Sentry error tracking for backend
// File: backend/src/middleware/sentryMiddleware.ts

import * as Sentry from "@sentry/node";
import { Express, Request, Response, NextFunction } from "express";

/**
 * Initialize Sentry for backend error tracking
 */
export function initializeSentry(app: Express) {
  // Initialize Sentry with DSN
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
    ],
  });

  // Attach Sentry to Express
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());

  console.log('✅ Sentry initialized for backend monitoring');
}

/**
 * Attach Sentry error handler to Express
 */
export function attachSentryErrorHandler(app: Express) {
  app.use(Sentry.Handlers.errorHandler());
}

/**
 * Capture error with context
 */
export function captureBackendError(error: Error | string, context?: Record<string, any>) {
  if (typeof error === 'string') {
    Sentry.captureMessage(error, 'error');
  } else {
    Sentry.captureException(error, { extra: context });
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
  console.error('🔴 Error caught:', err);

  // Capture error with request context
  Sentry.captureException(err, {
    extra: {
      method: req.method,
      url: req.url,
      body: req.body,
      headers: req.headers,
      statusCode: err.statusCode || 500,
    },
  });

  // Set user context if available
  if ((req as any).userId) {
    Sentry.setUser({
      id: (req as any).userId,
      email: (req as any).userEmail,
    });
  }

  // Send error response
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
      console.error('🔴 Async handler error:', error);
      Sentry.captureException(error, {
        extra: {
          method: req.method,
          url: req.url,
        },
      });
      next(error);
    });
  };
}
