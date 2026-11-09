# Environment Configuration for N-Health
# Create these files in your repository root and deployment servers

# ============================================
# FRONTEND ENVIRONMENT (.env.production)
# ============================================

# API Configuration
VITE_API_BASE_URL=https://api.nhealth.com.ng
VITE_APP_NAME=N-Health
VITE_APP_VERSION=1.0.0
VITE_APP_URL=https://nhealth.com.ng

# Sentry Error Tracking
VITE_SENTRY_DSN=https://your-sentry-key@sentry.io/your-project-id
VITE_SENTRY_ENVIRONMENT=production

# Analytics
VITE_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
VITE_POSTHOG_API_KEY=phc_xxxxxxxxxx

# Security
VITE_SECURE_COOKIES=true
VITE_SAME_SITE=Strict

# ============================================
# BACKEND ENVIRONMENT (.env.production)
# ============================================

# Server Configuration
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
FORCE_HTTPS=true
SSL_ENABLED=true

# Domain Configuration
DOMAIN=nhealth.com.ng
API_URL=https://api.nhealth.com.ng
FRONTEND_URL=https://nhealth.com.ng

# Database Configuration
DATABASE_URL=postgresql://nhealth_user:secure_password@postgres.nhealth.com.ng:5432/nhealth
DB_HOST=postgres.nhealth.com.ng
DB_PORT=5432
DB_USER=nhealth_user
DB_PASSWORD=secure_password
DB_NAME=nhealth

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_EXPIRY=24h
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRY=7d

# Email Configuration
EMAIL_SERVICE=sendgrid
EMAIL_API_KEY=sg_xxxxxxxxxxx
EMAIL_FROM=noreply@nhealth.com.ng
EMAIL_USER=noreply@nhealth.com.ng

# Or use Gmail SMTP
EMAIL_SERVICE=gmail
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Or use AWS SES
EMAIL_SERVICE=aws-ses
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# Security Headers
CORS_ORIGIN=https://nhealth.com.ng
CORS_CREDENTIALS=true
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX_REQUESTS=100

# Sentry Error Tracking
SENTRY_DSN=https://your-sentry-key@sentry.io/your-backend-project-id
SENTRY_ENVIRONMENT=production

# AWS Configuration (if using S3, etc.)
AWS_BUCKET_NAME=nhealth-storage
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Payment Configuration
STRIPE_PUBLIC_KEY=pk_live_xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
PAYSTACK_SECRET_KEY=sk_live_xxxxx

# SMS Configuration
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DIR=/var/log/nhealth

# ============================================
# DOCKER ENVIRONMENT (.env.docker)
# ============================================

# Database
POSTGRES_USER=nhealth
POSTGRES_PASSWORD=nhealth
POSTGRES_DB=nhealth
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# Backend
BACKEND_PORT=4000
BACKEND_ENV=development

# Frontend
FRONTEND_PORT=5173

# ============================================
# DEPLOYMENT SECRETS (GitHub Actions)
# ============================================
# Go to Settings → Secrets and add:

VERCEL_TOKEN=<your-vercel-token>
VERCEL_ORG_ID=<your-vercel-org-id>
VERCEL_PROJECT_ID=<your-vercel-project-id>

DOCKER_USERNAME=<your-docker-username>
DOCKER_PASSWORD=<your-docker-password>

SENTRY_AUTH_TOKEN=<your-sentry-token>

SLACK_WEBHOOK=<your-slack-webhook-url>

PRODUCTION_SERVER_IP=<your-prod-server-ip>
PRODUCTION_SERVER_USER=<deployment-user>
PRODUCTION_SERVER_KEY=<ssh-private-key>

# ============================================
# VERCEL DEPLOYMENT CONFIG (vercel.json)
# ============================================

{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_API_BASE_URL": "@api_base_url",
    "VITE_SENTRY_DSN": "@sentry_dsn"
  },
  "routes": [
    {
      "src": "/(.*)",
      "destination": "/index.html"
    }
  ]
}

# ============================================
# NGINX CONFIGURATION (for self-hosted)
# ============================================

server {
    listen 443 ssl http2;
    server_name nhealth.com.ng www.nhealth.com.ng;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/nhealth.com.ng/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nhealth.com.ng/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name nhealth.com.ng www.nhealth.com.ng;
    return 301 https://$server_name$request_uri;
}
