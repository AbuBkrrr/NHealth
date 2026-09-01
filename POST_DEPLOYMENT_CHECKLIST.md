# Post-Deployment Verification Checklist

**Deployment Date**: September 1, 2026  
**Environment**: Production (Nhealth.com.ng)  
**Platform**: Render  
**Notification Email**: aibrainsventures@gmail.com

---

## ✅ Phase 1: Infrastructure (5 min)

- [ ] Backend service showing **Live** in Render dashboard
- [ ] Admin-web service showing **Live** in Render dashboard
- [ ] PostgreSQL database showing **Live** in Render dashboard
- [ ] All three services have green status indicators
- [ ] No errors in deployment logs

**Test:**
```bash
# Check backend health
curl https://api.nhealth.com.ng/health
# Expected: {"status":"ok"}
```

---

## ✅ Phase 2: DNS & HTTPS (5-10 min)

- [ ] `api.nhealth.com.ng` resolves (use `nslookup api.nhealth.com.ng`)
- [ ] `admin.nhealth.com.ng` resolves (use `nslookup admin.nhealth.com.ng`)
- [ ] HTTPS certificates issued for both domains (no SSL warnings)
- [ ] Render shows "Verified" for custom domains

**Test:**
```bash
# Test backend HTTPS
curl https://api.nhealth.com.ng/health -v
# Expected: 200 OK, no certificate errors

# Test admin HTTPS
curl https://admin.nhealth.com.ng -v
# Expected: 200 OK, redirects to /index.html
```

---

## ✅ Phase 3: Database (5 min)

- [ ] Migrations ran successfully (check backend logs)
- [ ] Seed data created (demo accounts exist)
- [ ] Database has 21 tables
- [ ] `user_admin` table has `superadmin@demo.com` account

**Manual Verify** (optional):
1. Use any PostgreSQL client (pgAdmin, DBeaver)
2. Connect to Render database using connection string from `n-health-db` service
3. Count tables: `SELECT count(*) FROM information_schema.tables WHERE table_schema='public';`
4. Verify users: `SELECT email, role FROM "user" LIMIT 5;`

---

## ✅ Phase 4: Backend API (10 min)

### 4.1 Authentication
- [ ] `POST /api/auth/register` works with valid data
- [ ] `POST /api/auth/login` works with `superadmin@demo.com` / `password123`
- [ ] Login returns JWT token
- [ ] `GET /api/auth/me` with token returns current user

**Test:**
```bash
# Register
curl -X POST https://api.nhealth.com.ng/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testpatient@demo.com",
    "password": "password123",
    "name": "Test Patient",
    "role": "PATIENT"
  }'

# Login
curl -X POST https://api.nhealth.com.ng/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@demo.com",
    "password": "password123"
  }'
# Save the returned `token` value
```

### 4.2 Protected Routes
- [ ] `GET /api/auth/me` with token returns user profile
- [ ] `GET /api/patient/profile` (with patient token) works
- [ ] `GET /api/admin/stats` (with admin token) requires JWT
- [ ] Invalid token returns 401 Unauthorized

**Test:**
```bash
# Replace TOKEN with the token from login above
curl https://api.nhealth.com.ng/api/auth/me \
  -H "Authorization: Bearer TOKEN"
# Expected: 200 OK, user object
```

### 4.3 CORS
- [ ] Admin panel can call backend API without CORS errors
- [ ] Browser console (F12) shows no CORS warnings
- [ ] Requests from other origins are blocked (CORS_ORIGIN restricted)

---

## ✅ Phase 5: Admin Web (5 min)

- [ ] Page loads at `https://admin.nhealth.com.ng`
- [ ] Login form visible
- [ ] Can log in with `superadmin@demo.com` / `password123`
- [ ] Dashboard loads with stats
- [ ] Users tab shows list of accounts
- [ ] Can navigate all main pages without errors

**Test:**
1. Open `https://admin.nhealth.com.ng` in browser
2. Log in with provided credentials
3. Click through:
   - Dashboard (should show stats)
   - Users (should list all accounts)
   - Admin Accounts (super admin only)
   - Audit Log (super admin only)

---

## ✅ Phase 6: Mobile App Connectivity (5 min)

- [ ] Mobile `.env` points to `https://api.nhealth.com.ng/api`
- [ ] Mobile app rebuilt/redeployed via Expo
- [ ] App can register a test account
- [ ] App can log in
- [ ] No network errors in app console

**Test:**
1. Build and run mobile app
2. Try to register
3. Verify account appears in admin panel users list
4. Log in on mobile
5. Verify dashboard loads without errors

---

## ✅ Phase 7: Real-Time Features (5 min)

- [ ] Socket.io connection established (check browser console)
- [ ] Real-time events work (if available in your app):
  - [ ] Message notifications
  - [ ] Payment updates
  - [ ] Order status changes
- [ ] No WebSocket errors in console

**Test:**
1. Open admin panel
2. Open browser console (F12)
3. Look for Socket.io connection messages
4. Verify no errors about connection failures

---

## ✅ Phase 8: Email (if SendGrid configured)

- [ ] SendGrid account created and verified
- [ ] `SENDGRID_API_KEY` added to Render backend environment
- [ ] `SENDGRID_FROM_EMAIL=noreply@nhealth.com.ng` set
- [ ] Backend deployed with email vars
- [ ] Test email sends and arrives in inbox

**Test:**
1. If backend has email test endpoint, call it
2. Check inbox for test email from `noreply@nhealth.com.ng`
3. Verify it's not in spam folder

---

## ✅ Phase 9: File Uploads (Avatar)

- [ ] Can upload avatar on profile page (if available)
- [ ] Avatar displays in dashboard
- [ ] Avatar URL uses `PUBLIC_URL=https://api.nhealth.com.ng`

**Test:**
1. Go to profile page
2. Upload an image
3. Verify it appears in the profile
4. Right-click image → inspect → check URL starts with `https://api.nhealth.com.ng/uploads`

---

## ✅ Phase 10: Error Handling

- [ ] 404 errors return JSON error message (not HTML)
- [ ] Invalid JWT returns 401 with clear message
- [ ] Database errors return 500 with generic message (not raw stack trace)
- [ ] Mobile app handles network errors gracefully (offline banner?)

**Test:**
```bash
# Test 404
curl https://api.nhealth.com.ng/api/invalid-route
# Expected: 404 JSON error

# Test invalid JWT
curl https://api.nhealth.com.ng/api/auth/me \
  -H "Authorization: Bearer invalid-token"
# Expected: 401 Unauthorized
```

---

## ✅ Phase 11: Render Monitoring

- [ ] Email alerts configured for `aibrainsventures@gmail.com`
- [ ] Render dashboard shows deployment history
- [ ] Can access service logs (Dashboard → Service → Logs)
- [ ] Auto-scaling is off (or configured appropriately)

**Test:**
1. Render Dashboard → **Settings** → **Notifications**
2. Verify email is set
3. Check each service can be accessed
4. View logs without errors

---

## ✅ Phase 12: Security Checklist

- [ ] `CORS_ORIGIN` is restricted (not `*`)
- [ ] `JWT_SECRET` is not in code (only in Render environment)
- [ ] `DATABASE_URL` is not in code (only in Render environment)
- [ ] Admin login requires both email AND password (no hardcoded access)
- [ ] HTTPS enforced for all domains

---

## ✅ Phase 13: Performance Check

**Backend Response Times:**
- [ ] `GET /health` responds in <100ms
- [ ] `POST /auth/login` responds in <500ms
- [ ] `GET /admin/stats` responds in <1000ms

**Test:**
```bash
time curl https://api.nhealth.com.ng/health
# Should complete in under 1 second
```

---

## ✅ Phase 14: Backup Verification

- [ ] Render shows PostgreSQL backups (automated)
- [ ] Backup retention is 7+ days

**Check:**
1. Render Dashboard → **n-health-db** → **Backups**
2. Verify at least one backup exists
3. Note backup schedule (automatic)

---

## 🚨 Critical Issues Found?

If any step fails, **STOP** and:

1. Check Render logs: Dashboard → Service → **Logs**
2. Look for error messages (database connection, build errors, etc.)
3. Common fixes:
   - **Database connection error**: Verify `DATABASE_URL` exists in environment
   - **Build failure**: Check build logs for missing dependencies
   - **CORS error**: Verify `CORS_ORIGIN` is set correctly
   - **Cannot find template**: Check `VITE_API_URL` matches backend URL

---

## ✅ All Tests Passed?

**Congratulations! 🎉 Your production deployment is live.**

---

## Post-Launch Maintenance

**Daily:**
- Monitor for errors in Render logs
- Check email alerts

**Weekly:**
- Review admin panel user stats
- Check payment/order activity

**Monthly:**
- Review performance metrics
- Update dependencies if security patches available

---

## Rollback Plan (If Critical Issue)

If something breaks:

1. Check latest commit in GitHub
2. If current deployment is bad:
   - Render Dashboard → Service → **Manual Deploy**
   - Select a previous commit from history
   - Deploy to roll back

---

## Support

- **Render Docs**: https://render.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **N-Health README**: `n-health/README.md`

---

**Status**: ✅ Production Ready (after all checks pass)  
**Deployment Date**: September 1, 2026
