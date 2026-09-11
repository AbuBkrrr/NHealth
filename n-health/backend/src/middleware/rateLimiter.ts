import { Request, Response, NextFunction } from 'express';

/**
 * In-memory rate limiter store
 * Production: replace with Redis for distributed systems
 */
const requestLog = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Function to extract key from request
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Skip counting successful requests (2xx, 3xx)
  skipFailedRequests?: boolean; // Skip counting failed requests (4xx, 5xx)
}

/**
 * Create a rate limiter middleware
 * Default: 100 requests per 15 minutes per IP
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    keyGenerator = (req: Request) => {
      // Use X-Forwarded-For if behind proxy, otherwise use IP
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
      }
      return req.socket.remoteAddress || 'unknown';
    },
    message = 'Too many requests, please try again later.',
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Cleanup expired entries
    let record = requestLog.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      requestLog.set(key, record);
    }

    record.count++;

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

    if (record.count > maxRequests) {
      return res.status(429).json({ error: message });
    }

    next();
  };
}

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes per IP
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

/**
 * Moderate rate limiter for general API endpoints
 * 100 requests per 15 minutes per IP
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: 'Too many requests. Please try again later.',
});

/**
 * Loose rate limiter for public endpoints
 * 1000 requests per 15 minutes per IP
 */
export const publicRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 1000,
  message: 'Too many requests. Please try again later.',
});

/**
 * Cleanup job - runs every 5 minutes to remove old entries
 * Prevents memory leak in long-running process
 */
export function startRateLimiterCleanup() {
  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of requestLog.entries()) {
      if (now > record.resetTime) {
        requestLog.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[RateLimiter] Cleaned up ${cleaned} expired entries`);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}
