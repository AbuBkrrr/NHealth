// Sentry error tracking setup for frontend
// File: admin-web/src/utils/sentry.ts

/**
 * Initialize Sentry for error tracking and monitoring
 * Optional - only used if Sentry is installed separately
 * 
 * To enable:
 * 1. npm install @sentry/react @sentry/tracing
 * 2. Uncomment imports below
 * 3. Set VITE_SENTRY_DSN environment variable
 */

// import * as Sentry from "@sentry/react";
// import { BrowserTracing } from "@sentry/tracing";

export function initializeSentry() {
  // Sentry initialization is optional
  // Install and uncomment above imports to enable
  console.log('ℹ️ Sentry error tracking can be enabled with: npm install @sentry/react @sentry/tracing');
}

/**
 * Capture custom error
 */
export function captureError(error: Error | string, context?: Record<string, any>) {
  console.error('Error captured:', error, context);
  // In production with Sentry:
  // Sentry.captureException(error);
}

/**
 * Capture custom message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  console.log(`[${level.toUpperCase()}] ${message}`);
  // In production with Sentry:
  // Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, email: string, role: string) {
  console.log(`User context set: ${userId} (${role})`);
  // In production with Sentry:
  // Sentry.setUser({ id: userId, email, username: email.split('@')[0], role });
}

/**
 * Clear user context on logout
 */
export function clearUserContext() {
  console.log('User context cleared');
  // In production with Sentry:
  // Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category: string = 'user-action') {
  console.log(`[Breadcrumb] ${category}: ${message}`);
  // In production with Sentry:
  // Sentry.addBreadcrumb({ message, category, level: 'info' });
}
