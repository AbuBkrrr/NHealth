# 📋 Production Deployment & Security Checklist

Complete this checklist before deploying to production.

---

## 🔐 Security Hardening

- [ ] **Secrets Management**
  - [ ] Generate strong JWT_SECRET: `openssl rand -base64 32`
  - [ ] Store in environment variables (not in code)
  - [ ] Rotate secrets monthly
  - [ ] Never commit `.env` files
  - [ ] Use GitHub repository secrets for CI/CD

- [ ] **HTTPS/TLS**
  - [ ] Certificate installed (automatic on Render/Vercel/Railway)
  - [ ] HSTS headers enabled (Helmet)
  - [ ] Redirect HTTP → HTTPS
  - [ ] TLS 1.2+ only (no SSL 3.0)

- [ ] **Authentication**
  - [ ] JWT validation on all protected routes
  - [ ] JWT expiration: 7 days max
  - [ ] Refresh token mechanism (if needed)
  - [ ] Logout clears tokens client-side
  - [ ] Password hashing with bcrypt (10+ rounds)

- [ ] **Authorization**
  - [ ] Role-based access control (6 roles)
  - [ ] Check permissions on every protected route
  - [ ] Admin-only endpoints restricted
  - [ ] Users can only access own data

- [ ] **Rate Limiting** (✅ IMPLEMENTED)
  - [ ] Auth endpoints: 5 req/15min per IP
  - [ ] API endpoints: 100 req/15min per IP
  - [ ] Monitor for rate limit violations
  - [ ] Replace in-memory with Redis for scale

- [ ] **Input Validation** (✅ IMPLEMENTED)
  - [ ] All endpoints validate input with Zod
  - [ ] File uploads size-limited
  - [ ] File types whitelisted
  - [ ] SQL injection protection (Prisma)
  - [ ] XSS protection (React + Helmet)

- [ ] **Error Handling** (✅ ENHANCED)
  - [ ] No sensitive info in error messages
  - [ ] Proper Prisma error mapping
  - [ ] Generic 500 errors logged server-side
  - [ ] Stack traces never shown to client

- [ ] **CORS Configuration**
  - [ ] Specific origins allowed (not wildcard)
  - [ ] Credentials included if needed
  - [ ] Preflight requests handled

---

## 🗄️ Database Security

- [ ] **PostgreSQL Hardening**
  - [ ] Strong password for DB user
  - [ ] Credentials stored in environment
  - [ ] Only accept connections from backend
  - [ ] No public internet access (use private network)
  - [ ] Encryption at rest enabled
  - [ ] SSL connections from backend

- [ ] **Backups** (❌ NOT IMPLEMENTED - YOU MUST DO)
  - [ ] Automated daily backups
  - [ ] Backups encrypted
  - [ ] Test restore procedure
  - [ ] Store backups in separate region
  - [ ] Retention policy: 30 days minimum
  - [ ] Document rollback procedure

- [ ] **Migrations**
  - [ ] All migrations tested locally
  - [ ] Rollback plan documented
  - [ ] Zero-downtime migrations where possible
  - [ ] `prisma:migrate` runs on startup

---

## 🚀 Deployment

- [ ] **Backend Deployment**
  - [ ] Deployed to Render/Railway/AWS
  - [ ] Environment variables configured
  - [ ] Health check endpoint working
  - [ ] Logs accessible and monitored
  - [ ] Auto-restart on crash enabled
  - [ ] Database migrations run at startup

- [ ] **Frontend Deployment**
  - [ ] Deployed to Vercel/Netlify
  - [ ] Backend URL in `.env.production`
  - [ ] Build optimizations enabled
  - [ ] Cache headers configured
  - [ ] CDN enabled for static assets
  - [ ] Gzip compression enabled

- [ ] **Infrastructure**
  - [ ] Load balancer in front (if needed)
  - [ ] Database in private network
  - [ ] Web server not directly exposed
  - [ ] Firewall rules configured
  - [ ] DDoS protection enabled

---

## 📊 Monitoring & Logging

- [ ] **Application Monitoring**
  - [ ] Error tracking (Sentry recommended)
  - [ ] Performance monitoring (APM)
  - [ ] Uptime monitoring
  - [ ] Alert on errors/downtime
  - [ ] Dashboard for key metrics

- [ ] **Logging**
  - [ ] Centralized log collection
  - [ ] Minimum 30-day retention
  - [ ] Logs include: timestamp, level, service, message
  - [ ] Sensitive data filtered from logs
  - [ ] Access logs for API requests
  - [ ] Search/filter logs easily

- [ ] **Metrics**
  - [ ] Response time (p50, p95, p99)
  - [ ] Error rate
  - [ ] Request rate
  - [ ] Database query time
  - [ ] Cache hit rate

---

## 📁 File Storage

- [ ] **Avatar Upload Storage** (❌ CURRENTLY LOCAL - YOU MUST FIX)
  - [ ] Move from local disk to S3/Cloudinary
  - [ ] Bucket not publicly accessible
  - [ ] File size limits enforced
  - [ ] Virus scanning enabled
  - [ ] CDN in front (CloudFront/CloudFlare)
  - [ ] Old files auto-deleted after 30 days

Configuration example (create `backend/src/services/S3StorageService.ts`):
```typescript
import AWS from 'aws-sdk';

export class S3StorageService {
  private s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });

  async uploadAvatar(file: Express.Multer.File, userId: string): Promise<string> {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: `avatars/${userId}/${Date.now()}-${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
    };
    const result = await this.s3.upload(params).promise();
    return result.Location;
  }
}
```

---

## 🔄 Staging Environment

- [ ] **Staging Deployment** (❌ NOT IMPLEMENTED - RECOMMENDED)
  - [ ] Separate staging database
  - [ ] Same config as production
  - [ ] Only team has access
  - [ ] Used for testing before prod release
  - [ ] Automatic backup snapshots
  - [ ] Database scrubbed weekly (no real user data)

Configuration:
```yaml
# render.yaml - add staging service
services:
  - type: web
    name: n-health-backend-staging
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    branch: develop
    region: ohio
    plan: free
```

---

## 📱 Mobile App (if applicable)

- [ ] **App Distribution**
  - [ ] Code signing configured
  - [ ] Version bumping automated
  - [ ] Beta testing via TestFlight/Play Store
  - [ ] Release notes generated
  - [ ] Changelog maintained

---

## 👥 Team Access

- [ ] **Developer Access**
  - [ ] Only necessary developers have access
  - [ ] SSH keys/tokens rotated quarterly
  - [ ] 2FA enabled on all accounts
  - [ ] Access logs reviewed monthly
  - [ ] Offboarded users' access removed immediately

- [ ] **GitHub**
  - [ ] 2FA enabled for all contributors
  - [ ] Branch protection: require PR review
  - [ ] Branch protection: require status checks
  - [ ] Delete head branches automatically
  - [ ] Only admins can push to main
  - [ ] Audit log reviewed monthly

- [ ] **Deployment Platforms**
  - [ ] 2FA enabled on Render/Vercel/Railway
  - [ ] SSH keys stored securely
  - [ ] Access tokens rotated monthly
  - [ ] Environment secrets not logged

---

## 🧪 Testing & QA

- [ ] **Automated Testing** (❌ NOT IMPLEMENTED - SEE TESTING_GUIDE.md)
  - [ ] Unit tests: 70%+ coverage
  - [ ] Integration tests for critical paths
  - [ ] E2E tests for user workflows
  - [ ] All tests pass in CI before merge
  - [ ] Performance benchmarks tracked

- [ ] **Manual Testing**
  - [ ] Smoke test all 6 role dashboards
  - [ ] Test on multiple browsers
  - [ ] Test on mobile (Android + iOS)
  - [ ] Slow network testing (3G)
  - [ ] Load testing before major release

---

## 📦 Dependency Management

- [ ] **Dependency Scanning**
  - [ ] Weekly `npm audit` runs
  - [ ] Automated alerts for vulnerabilities
  - [ ] Security patches applied within 24h
  - [ ] Non-security updates reviewed
  - [ ] Lockfiles committed

- [ ] **License Compliance**
  - [ ] All dependencies GPL-compatible
  - [ ] No AGPL dependencies (if SaaS)
  - [ ] License list maintained

---

## 📞 Incident Response

- [ ] **On-Call Process**
  - [ ] Rotation schedule established
  - [ ] On-call contact info documented
  - [ ] Escalation path defined
  - [ ] Response time SLAs (e.g., 30min)
  - [ ] Status page for incidents

- [ ] **Post-Mortem**
  - [ ] Document what went wrong
  - [ ] Root cause analysis
  - [ ] Prevention steps for next time
  - [ ] Team review meeting scheduled

---

## 🚨 Disaster Recovery

- [ ] **Backup & Restore**
  - [ ] Database backups: daily
  - [ ] Restore tested monthly
  - [ ] Recovery time objective (RTO): < 4 hours
  - [ ] Recovery point objective (RPO): < 24 hours
  - [ ] Offsite backup copies maintained

- [ ] **Failover**
  - [ ] Database failover tested
  - [ ] DNS failover configured (if needed)
  - [ ] Documentation updated

---

## 📋 Compliance & Audit

- [ ] **Health Data Security** (HIPAA, GDPR, etc.)
  - [ ] Data classification complete
  - [ ] Encryption at rest + transit
  - [ ] User consent tracking
  - [ ] Data deletion on request
  - [ ] Audit log of access

- [ ] **Documentation**
  - [ ] Architecture documented
  - [ ] API documented (OpenAPI/Swagger)
  - [ ] Operations runbook created
  - [ ] Disaster recovery plan written
  - [ ] Security policy documented

---

## ✅ Pre-Launch Checklist

**Before going live:**

- [ ] All security items above ✅
- [ ] Monitoring & alerts configured ✅
- [ ] Backups verified ✅
- [ ] Team trained on ops ✅
- [ ] Staging environment tested ✅
- [ ] Load testing passed ✅
- [ ] Browser/mobile testing passed ✅
- [ ] Accessibility tested (WCAG 2.1 AA) ✅
- [ ] Performance acceptable (LCP < 2.5s) ✅
- [ ] Analytics configured ✅
- [ ] Error tracking live ✅
- [ ] Status page live ✅
- [ ] Support process documented ✅

---

## 📅 Ongoing Maintenance

**Weekly:**
- [ ] Monitor error rates
- [ ] Check uptime status
- [ ] Review logs for anomalies

**Monthly:**
- [ ] Run `npm audit`
- [ ] Review access logs
- [ ] Update dependencies
- [ ] Performance review

**Quarterly:**
- [ ] Security audit
- [ ] Penetration test
- [ ] Disaster recovery drill
- [ ] Team access review

**Annually:**
- [ ] Full security audit
- [ ] Compliance review
- [ ] Architecture review
- [ ] License audit

---

## 📞 Support Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| On-Call Engineer | [phone/email] | 24/7 |
| Database Admin | [email] | Business hours |
| Security Lead | security@nhealth.dev | 24/7 |
| Platform Owner | [email] | Business hours |

---

## 📚 References

- [Security Policy](SECURITY.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Testing Guide](TESTING_GUIDE.md)
- [README](README.md)

---

**Status:** ⚠️ Partially Complete - Complete all ❌ items before production

**Last Updated:** 2024

