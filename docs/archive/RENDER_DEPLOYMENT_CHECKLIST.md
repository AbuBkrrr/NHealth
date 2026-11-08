# Render Deployment Checklist — Nhealth.com.ng

**Your Details:**
- **Domain**: Nhealth.com.ng
- **Workspace ID**: tea-d995gq28qa3s73eb4ing
- **Notification Email**: aibrainsventures@gmail.com
- **GitHub Repo**: AbuBkrrr/NHealth
- **Backend URL**: https://api.nhealth.com.ng
- **Admin URL**: https://admin.nhealth.com.ng
- **Mobile API URL**: https://api.nhealth.com.ng/api

---

## 📋 Pre-Deployment (Before clicking Blueprint)

- [ ] GitHub repo is pushed to main branch
- [ ] All changes committed (no pending edits)
- [ ] You have Render account access
- [ ] You have DNS provider access (GoDaddy, Namecheap, etc.)
- [ ] You have SendGrid account (optional but recommended)

---

## 🚀 Step 1: Deploy via Render Blueprint (5 min)

### Open Render Dashboard
```
1. Go to https://render.com
2. Log in
3. Select workspace: tea-d995gq28qa3s73eb4ing
4. Click [+ New] → [Blueprint]
```

### Connect GitHub Repository
```
1. Click [Connect Repository]
2. Search for: AbuBkrrr/NHealth
3. Click [Connect]
4. Leave branch as: main
5. Click [Apply]
```

**Status:**
- [ ] Blueprint shows 3 services (backend, admin-web, db)
- [ ] All services start provisioning
- [ ] Wait 3-5 minutes for services to show "Live"

**Expected Output:**
- ✅ n-health-backend — Live
- ✅ n-health-admin-web — Live
- ✅ n-health-db — Live

---

## 🔧 Step 2: Configure Backend Environment (2 min)

### Navigate to Backend Service
```
Render Dashboard → [n-health-backend] → [Environment]
```

### Update Variables

**Add/Edit these variables:**

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `https://admin.nhealth.com.ng` |
| `PUBLIC_URL` | `https://api.nhealth.com.ng` |
| `SENDGRID_API_KEY` | *Get from SendGrid (Step 5)* |
| `SENDGRID_FROM_EMAIL` | `noreply@nhealth.com.ng` |

**Do NOT change:**
- `JWT_SECRET` (Render auto-generated)
- `DATABASE_URL` (Render auto-injected)

**Steps:**
1. Find each variable in the list
2. Update the value
3. Click [Save]
4. Click [Manual Deploy] → [Deploy latest commit]
5. Wait for deployment to complete (watch logs: should see "Listening on port 4000")

**Status:**
- [ ] Backend deployment complete (Logs show: "N-Health API listening on port 4000")

---

## 🔧 Step 3: Configure Admin-Web Environment (2 min)

### Navigate to Admin-Web Service
```
Render Dashboard → [n-health-admin-web] → [Environment]
```

### Update Variable

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://api.nhealth.com.ng/api` |

**Steps:**
1. Edit `VITE_API_URL`
2. Click [Save]
3. Click [Manual Deploy] → [Deploy latest commit]
4. Wait for build to complete

**Status:**
- [ ] Admin-web deployment complete (Build succeeds, showing "✅")

---

## 🗄️ Step 4: Initialize Database (2 min)

### Open Backend Shell
```
Render Dashboard → [n-health-backend] → [Shell]
```

### Run Migration & Seed
```bash
npx prisma migrate deploy
npm run prisma:seed
```

**Expected Output:**
```
✅ Migrations applied successfully
✅ Seed completed
Created accounts:
  - superadmin@demo.com (ADMIN)
  - patient@demo.com (PATIENT)
  - doctor@demo.com (DOCTOR)
  - [... other demo accounts ...]
```

**Status:**
- [ ] Migrations applied
- [ ] Seed completed
- [ ] Demo accounts created

---

## 🌐 Step 5: Configure DNS at Your Provider (3 min)

### Get Render CNAME Values

**For Backend:**
```
Render Dashboard → [n-health-backend] → [Settings] → [Custom Domains]
Copy the CNAME target value
```

**For Admin-Web:**
```
Render Dashboard → [n-health-admin-web] → [Settings] → [Custom Domains]
Copy the CNAME target value
```

### Add DNS Records at Your Provider

**Log in to your DNS provider** (GoDaddy, Namecheap, Cloudflare, etc.):

#### Record 1: Backend API
```
Type:  CNAME
Name:  api
Value: <paste Render CNAME from backend>
TTL:   3600
```

#### Record 2: Admin Panel
```
Type:  CNAME
Name:  admin
Value: <paste Render CNAME from admin-web>
TTL:   3600
```

**Steps:**
1. Log in to DNS provider
2. Find DNS management section
3. Add Record 1 (api subdomain)
4. Add Record 2 (admin subdomain)
5. Save changes

**Status:**
- [ ] `api.nhealth.com.ng` CNAME added
- [ ] `admin.nhealth.com.ng` CNAME added

---

## ✅ Step 6: Verify DNS Propagation (5-10 min)

### Test DNS Resolution
```bash
nslookup api.nhealth.com.ng
nslookup admin.nhealth.com.ng
# Both should show CNAME records pointing to Render
```

### Test HTTPS
```bash
curl https://api.nhealth.com.ng/health
# Expected: {"status":"ok"}
```

**Status:**
- [ ] DNS resolves
- [ ] HTTPS works (no certificate errors)
- [ ] Backend health check returns OK

---

## 📧 Step 7: Configure SendGrid (Optional but Recommended) (3 min)

### Create SendGrid Account
```
1. Go to https://sendgrid.com
2. Sign up (free tier: 100 emails/day)
3. Verify email
4. Log in
```

### Verify Sender Domain
```
1. SendGrid Dashboard → [Settings] → [Sender Authentication]
2. Click [Authenticate Your Domain]
3. Enter: nhealth.com.ng
4. Enter subdomain prefix: noreply
5. Click [Next]
6. Copy DNS records provided
```

### Add SendGrid DNS Records
```
At your DNS provider, add the TXT/CNAME records from SendGrid
(Same place you added api and admin subdomains)
Wait 5-10 minutes for verification
```

### Create API Key
```
1. SendGrid Dashboard → [Settings] → [API Keys]
2. Click [Create API Key]
3. Name: N-Health Backend Production
4. Access: Full Access
5. Click [Create & View]
6. Copy the key (SG.xxxxx...)
```

### Add to Render
```
Render Dashboard → [n-health-backend] → [Environment]
Add:
  SENDGRID_API_KEY = SG.xxxxx...
  SENDGRID_FROM_EMAIL = noreply@nhealth.com.ng
Click [Save] → [Manual Deploy]
```

**Status:**
- [ ] SendGrid account created
- [ ] Sender domain verified
- [ ] API key added to Render backend
- [ ] Backend redeployed

---

## 🧪 Step 8: Verify Production (5 min)

### Test Backend
```bash
# Health check
curl https://api.nhealth.com.ng/health

# Try login
curl -X POST https://api.nhealth.com.ng/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@demo.com",
    "password": "password123"
  }'
# Should return JWT token
```

### Test Admin Panel
```
1. Open https://admin.nhealth.com.ng in browser
2. Log in with:
   Email: superadmin@demo.com
   Password: password123
3. Should see dashboard with stats
```

### Test Mobile App
```
1. Update mobile/.env:
   EXPO_PUBLIC_API_URL=https://api.nhealth.com.ng/api
2. Rebuild app (via Expo/EAS)
3. Try to register/login
4. Should connect without errors
```

**Status:**
- [ ] Backend API responds
- [ ] Admin login works
- [ ] Mobile app connects

---

## 🔔 Step 9: Set Up Alerts (1 min)

### Enable Render Notifications
```
Render Dashboard → [Settings] → [Notifications]
Add email: aibrainsventures@gmail.com
Enable alerts for:
  ☑ Deploy failures
  ☑ Service crashes
  ☑ Resource limits exceeded
```

**Status:**
- [ ] Email notifications enabled

---

## 📊 Step 10: Verify Render Services (2 min)

### Check All Services
```
Render Dashboard → Check each service status:
  ✅ n-health-backend — Live
  ✅ n-health-admin-web — Live
  ✅ n-health-db — Live
```

### Check Logs
```
For each service:
  → Click [Logs]
  → Should see recent deployment logs
  → No errors visible
```

**Status:**
- [ ] All 3 services showing "Live"
- [ ] Recent deployment logs show success

---

## ✨ Deployment Complete!

**Checklist Summary:**

- ✅ Render Blueprint deployed
- ✅ Backend environment configured
- ✅ Admin-web environment configured
- ✅ Database migrated & seeded
- ✅ DNS records added
- ✅ DNS propagated
- ✅ SendGrid configured (optional)
- ✅ Production verified
- ✅ Alerts enabled

---

## 🚀 Live URLs

| Service | URL | Login |
|---------|-----|-------|
| **Backend API** | https://api.nhealth.com.ng | N/A (API only) |
| **Admin Panel** | https://admin.nhealth.com.ng | superadmin@demo.com / password123 |
| **Mobile App** | (on device/emulator) | Any demo account |

---

## 📚 Next Steps

1. **Read full guides** (for deep dives):
   - `DEPLOYMENT_GUIDE_NHEALTH.md` — Complete walkthrough
   - `DNS_SETUP_NHEALTH.md` — DNS configuration
   - `SENDGRID_SETUP_GUIDE.md` — Email setup
   - `POST_DEPLOYMENT_CHECKLIST.md` — Verification steps

2. **Set up ongoing monitoring**:
   - Monitor Render dashboard daily
   - Watch email alerts for crashes
   - Review logs weekly

3. **Plan next features**:
   - Add more demo data
   - Configure backup strategy
   - Plan scaling (if usage grows)

---

## 🆘 Troubleshooting Quick Links

**Issue: DNS not resolving**
→ See `DNS_SETUP_NHEALTH.md` — DNS Troubleshooting section

**Issue: Backend won't start**
→ Check Render logs, verify `DATABASE_URL` exists

**Issue: Admin page blank**
→ Check browser console (F12), verify `VITE_API_URL` is correct

**Issue: Emails not sending**
→ See `SENDGRID_SETUP_GUIDE.md` — Troubleshooting section

---

**Deployment Date**: September 1, 2026  
**Status**: ✅ Production Ready
