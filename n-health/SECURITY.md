# 🔐 Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in N-Health, please email **security@nhealth.dev** with:

- **Description**: What is the vulnerability?
- **Affected Versions**: Which version(s) are impacted?
- **Reproduction Steps**: How can we reproduce it?
- **Potential Impact**: What could an attacker do?
- **Suggested Fix** (optional): Your recommendations

**Please do not open public GitHub issues for security vulnerabilities.**

---

## Security Measures

### Authentication & Authorization
- ✅ JWT tokens (7-day expiration by default)
- ✅ Bcrypt password hashing (10 salt rounds)
- ✅ Role-based access control (6 roles: Patient, Doctor, Pharmacy, Lab, Ambulance, Nurse, Admin)
- ✅ Protected routes require valid JWT token

### Rate Limiting
- ✅ Auth endpoints: 5 requests per 15 minutes per IP
- ✅ API endpoints: 100 requests per 15 minutes per IP
- ✅ Public endpoints: 1000 requests per 15 minutes per IP
- ⚠️ In-memory store (use Redis for distributed systems)

### Input Validation
- ✅ Zod schema validation on all endpoints
- ✅ Request body, query params, and route params validated
- ✅ File upload validation (size, type, storage)
- ✅ Email format validation

### Error Handling
- ✅ Comprehensive Prisma error mapping
- ✅ No sensitive information in error messages
- ✅ Structured error responses
- ✅ Request/response logging

### Data Security
- ✅ CORS configured for specific origins
- ✅ Helmet security headers enabled
- ✅ HTTPS required in production
- ✅ Sensitive data removed from logs
- ⚠️ Local file storage (use S3/Cloudinary in production)

### Dependency Management
- ✅ Regular `npm audit` checks in CI/CD
- ⚠️ No automated dependency updates (review manually)
- ✅ TypeScript for type safety

---

## Security Checklist for Developers

Before committing code:

- [ ] Input validation using Zod schemas
- [ ] No hardcoded secrets (use `.env` files)
- [ ] Error messages don't expose sensitive data
- [ ] SQL injection protection (using Prisma ORM)
- [ ] XSS protection (React auto-escapes, Helmet CSP)
- [ ] CSRF tokens not needed (JWT-based, same-origin API)
- [ ] Authentication checks on protected routes
- [ ] Rate limiting on sensitive endpoints
- [ ] No logging of passwords, tokens, PII
- [ ] HTTPS/TLS in production

---

## Security Scanning

The repository runs automated security checks:

- **npm audit**: Dependency vulnerability scanning
- **TypeScript**: Type checking reduces runtime errors
- **Zod**: Runtime schema validation
- **Helmet**: Security headers

**CI/CD Pipeline:** `.github/workflows/ci-cd.yml`

---

## Known Limitations & Mitigations

| Issue | Mitigation |
|-------|-----------|
| In-memory rate limiter (not distributed) | Use Redis in production (TODO) |
| Local file uploads | Move to S3/Cloudinary (TODO) |
| No HTTPS in development | HTTPS enforced in production via Render/Railway |
| No database backups configured | Add automated daily backups (TODO) |
| No staging environment | Create separate staging deployment (TODO) |
| Demo SMS service has no rate limit | Add SMS provider rate limits (TODO) |

---

## Production Security Requirements

Before deploying to production:

1. **Set strong JWT_SECRET**
   ```bash
   openssl rand -base64 32
   ```

2. **Enable HTTPS** (automatic on Render/Railway)

3. **Configure CORS_ORIGIN** for your domain
   ```bash
   CORS_ORIGIN=https://yourdomain.com
   ```

4. **Use managed PostgreSQL** (not local SQLite)

5. **Enable database backups**
   - Render: Automatic daily backups included
   - Railway: Manual backups via CLI
   - AWS RDS: Automatic backups + automated snapshots

6. **Monitor logs** for suspicious activity

7. **Run npm audit regularly**
   ```bash
   npm audit
   ```

8. **Update dependencies monthly**
   ```bash
   npm outdated
   npm update
   ```

9. **Use environment secrets** in CI/CD
   - GitHub Actions: Use repository secrets
   - Never commit `.env` files

10. **Enable two-factor authentication** on:
    - GitHub account
    - Deployment platforms (Render, Vercel, Railway)
    - Database management tools

---

## Incident Response

If a security issue is discovered:

1. **Immediately patch** the vulnerability
2. **Notify affected users** (if data was exposed)
3. **Publish security advisory** (GitHub Security tab)
4. **Post-mortem**: Document what happened and prevention

---

## Related Documentation

- [README.md](README.md) - Project overview
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contributing guidelines
- [Render Deployment](render.yaml) - Production environment
- [Docker Compose](docker-compose.yml) - Local development

---

**Last Updated**: 2024  
**Maintainer**: N-Health Core Team
