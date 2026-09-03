// Security configuration file for HTTPS/SSL and security headers
// Place in: backend/src/middleware/securityMiddleware.ts

import { Express } from 'express';

/**
 * Configure all security headers and HTTPS settings
 * Implements industry-standard security practices
 */
export function setupSecurityMiddleware(app: Express) {
  // 1. HELMET - Adds security headers
  const helmet = require('helmet');
  app.use(helmet());

  // 2. HTTPS Redirect
  app.use((req, res, next) => {
    // Redirect HTTP to HTTPS in production
    if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    next();
  });

  // 3. HSTS - Force HTTPS for future requests
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    next();
  });

  // 4. Additional Security Headers
  app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
    );
    
    next();
  });

  // 5. Disable x-powered-by header
  app.disable('x-powered-by');

  // 6. Limit request size
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ limit: '10mb', extended: true }));

  console.log('✅ Security middleware configured');
}

/**
 * SSL/TLS Configuration
 * For different deployment platforms:
 */
export const SSL_CONFIG = {
  // 1. VERCEL (Automatic HTTPS)
  vercel: {
    note: 'Vercel automatically provides HTTPS',
    action: 'Deploy to Vercel, automatic SSL',
  },

  // 2. NETLIFY (Automatic HTTPS)
  netlify: {
    note: 'Netlify automatically provides HTTPS',
    action: 'Deploy to Netlify, automatic SSL',
  },

  // 3. AWS (Let\'s Encrypt via ACM)
  aws: {
    steps: [
      'Use AWS Certificate Manager (ACM)',
      'Request free certificate',
      'Validate domain',
      'Attach to load balancer',
    ],
  },

  // 4. HEROKU (Automatic HTTPS)
  heroku: {
    steps: [
      'Add domain to Heroku',
      'Automatic SSL provided',
      'Configure DNS',
    ],
  },

  // 5. SELF-HOSTED (Let\'s Encrypt)
  selfHosted: {
    steps: [
      'Install Certbot',
      'Run: certbot certonly --standalone -d yourdomain.com',
      'Configure nginx/apache with certificates',
      'Setup auto-renewal',
    ],
  },

  // 6. DOCKER (Let's Encrypt with Nginx)
  docker: {
    steps: [
      'Use nginx with certbot sidecar',
      'Automatic certificate renewal',
      'Mount certificate volume',
    ],
  },
};

/**
 * Environment Variables for HTTPS
 * Add to .env or .env.production
 */
export const HTTPS_ENV_VARS = {
  NODE_ENV: 'production',
  FORCE_HTTPS: 'true',
  SSL_ENABLED: 'true',
  DOMAIN: 'your-domain.com',
  // Certificate paths (if self-hosted)
  SSL_CERT_PATH: '/etc/ssl/certs/your-domain.crt',
  SSL_KEY_PATH: '/etc/ssl/private/your-domain.key',
};
