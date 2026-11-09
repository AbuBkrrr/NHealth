# N-Health Production Deployment Guide
## Render + Nhealth.com.ng Domain

**Date**: September 1, 2026  
**Environment**: Production  
**Domain**: Nhealth.com.ng  
**Deployment Platform**: Render  
**Notification Email**: aibrainsventures@gmail.com  
**Render Workspace ID**: tea-d995gq28qa3s73eb4ing

---

## Overview

This guide deploys:
- **Backend API**: `https://api.nhealth.com.ng` (Node.js + Express + PostgreSQL)
- **Admin Web**: `https://admin.nhealth.com.ng` (React + Vite — static site)
- **Mobile App**: Points to `https://api.nhealth.com.ng/api`

All on Render with automatic HTTPS via the Blueprint.

---

## Step 1: Prepare Your GitHub Repository

Ensure your repo is pushed with all changes:

```bash
cd n-health
git add .
git commit -m "Production deployment setup for Nhealth.com.ng"
git push origin main
```

Verify in your GitHub: `https://github.com/AbuBkrrr/NHealth`

---

## Step 2: Deploy via Render Blueprint (5 minutes)

### 2.1 Open Render Dashboard
1. Go to [render.com](https://render.com) and log in
2. Select workspace **tea-d995gq28qa3s73eb4ing**
3. Click **+ New** → **Blueprint** (top right)

### 2.2 Connect GitHub Repository
1. Click **Connect Repository**
2. Select **AbuBkrrr/NHealth**
3. Leave branch as **main**
4. Click **Connect**

### 2.3 Review & Apply Blueprint
Render auto-detects `n-health/render.yaml` and shows:
- ✅ **n-health-backend** (Node.js web service)
- ✅ **n-health-admin-web** (Static site)
- ✅ **n-health-db** (PostgreSQL database)

**Do NOT change anything yet** — click **Apply**.

Render provisions all three services (~3-5 minutes).

---

## Step 3: Configure Environment Variables

Once deployed, services show as **Live**. Now set environment variables:

### 3.1 Backend Environment (n-health-backend)

1. Dashboard → **n-health-backend** service → **Environment**
2. Add/update these variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(Render auto-generated — leave as-is)* |
| `CORS_ORIGIN` | `https://admin.nhealth.com.ng` |
| `PUBLIC_URL` | `https://api.nhealth.com.ng` |
| `SENDGRID_API_KEY` | *(see Step 6 below)* |
| `SENDGRID_FROM_EMAIL` | `noreply@nhealth.com.ng` |

3. Click **Save** → **Manual Deploy** → **Deploy latest commit**

**Wait for deploy to complete** (watch logs for `Listening on port 4000`).

### 3.2 Admin Web Environment (n-health-admin-web)

1. Dashboard → **n-health-admin-web** service → **Environment**
2. Update:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://api.nhealth.com.ng/api` |

3. Click **Save** → **Manual Deploy** → **Deploy latest commit**

**Wait for deploy to complete** (watch for build output ending in ✅).

---

## Step 4: Database Setup

### 4.1 Run Migrations & Seed

1. Dashboard → **n-health-backend** service → **Shell** tab
2. Run:
   ```bash
   npx prisma migrate deploy
   npm run prisma:seed
   ```
3. Verify output: should see `✅ Seed completed` and demo accounts created

### 4.2 Verify Database
- Access **n-health-db** service → copy connection string
- Use any PostgreSQL client (pgAdmin, DBeaver) to verify 21 tables created

---

## Step 5: Configure Custom Domains (DNS)

You now have auto-generated Render URLs (e.g., `n-health-backend-abc123.onrender.com`).  
Now point your domain to them.

### 5.1 Backend Domain: api.nhealth.com.ng

1. Dashboard → **n-health-backend** → **Settings** → **Custom Domain**
2. Enter: `api.nhealth.com.ng`
3. Render shows DNS instructions — **note the CNAME target** (e.g., `cname.onrender.com`)

### 5.2 Admin Domain: admin.nhealth.com.ng

1. Dashboard → **n-health-admin-web** → **Settings** → **Custom Domain**
2. Enter: `admin.nhealth.com.ng`
3. Render shows DNS instructions — **note the CNAME target**

### 5.3 Configure DNS at Your Provider

Go to your DNS provider's control panel (GoDaddy, Namecheap, etc.):

**For api.nhealth.com.ng:**
```
Type: CNAME
Name: api
Value: <Render's CNAME target from step 5.1>
TTL: 3600 (or default)
```

**For admin.nhealth.com.ng:**
```
Type: CNAME
Name: admin
Value: <Render's CNAME target from step 5.2>
TTL: 3600 (or default)
```

**For root domain (nhealth.com.ng) — optional landing page redirect:**
```
Type: CNAME or A record
Name: @ (or leave blank)
Value: <Set to admin.nhealth.com.ng or your landing page>
```

**Save changes in your DNS provider.**

### 5.4 Verify DNS Propagation

Wait 5-10 minutes, then test:
```bash
curl https://api.nhealth.com.ng/health
# Should return: {"status":"ok"}

curl https://admin.nhealth.com.ng
# Should load the React app
```

---

## Step 6: Configure SendGrid Email (Optional but Recommended)

### 6.1 Create SendGrid Account
1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up (free tier: 100 emails/day)
3. Verify your sender email: `noreply@nhealth.com.ng` (requires DNS TXT records)

### 6.2 Create API Key
1. SendGrid dashboard → **Settings** → **API Keys**
2. Create new API key → **Full Access**
3. Copy the key

### 6.3 Add to Render
1. Dashboard → **n-health-backend** → **Environment**
2. Add:
   ```
   SENDGRID_API_KEY=<your-key>
   SENDGRID_FROM_EMAIL=noreply@nhealth.com.ng
   ```
3. **Manual Deploy**

### 6.4 Verify (Optional)
Once deployed, users will receive emails for:
- Payment confirmations
- Order updates
- Appointment reminders
- (More features as you build them)

---

## Step 7: Mobile App Configuration

Update your mobile app's environment:

```bash
cd n-health/mobile
echo "EXPO_PUBLIC_API_URL=https://api.nhealth.com.ng/api" > .env
```

Then rebuild/redeploy via Expo:
```bash
eas build --platform android    # or ios
```

---

## Step 8: Verify Production is Live

### Test Backend
```bash
curl https://api.nhealth.com.ng/health
# Response: {"status":"ok"}
```

### Test Admin Login
1. Open `https://admin.nhealth.com.ng`
2. Log in with:
   - Email: `superadmin@demo.com`
   - Password: `password123`
3. Should see dashboard with stats

### Test Patient Login (Mobile)
1. Open Expo app (or build)
2. Should connect to backend without errors
3. Try registering a test patient account

---

## Step 9: Post-Deployment Monitoring

### 9.1 Render Alerts
1. Dashboard → **Settings** → **Notifications**
2. Add email: `aibrainsventures@gmail.com`
3. Enable alerts for: Deploy failures, service crashes

### 9.2 Monitoring
- **Dashboard** → each service shows real-time logs
- **Backend logs**: Dashboard → **n-health-backend** → **Logs**
- **Database health**: Dashboard → **n-health-db** → **Metrics**

### 9.3 Backup Verification
- Render auto-backs up PostgreSQL daily (free)
- Stored for 7 days
- Access via: Dashboard → **n-health-db** → **Backups**

---

## Step 10: SSL/TLS Certificate

✅ **Automatic** — Render provisions free Let's Encrypt certificates for:
- `api.nhealth.com.ng`
- `admin.nhealth.com.ng`

Certificates auto-renew every 60 days. No action needed.

---

## Common Issues & Troubleshooting

| Problem | Solution |
|---------|----------|
| DNS not resolving | Wait 10-15 min for propagation; test with `nslookup api.nhealth.com.ng` |
| "Cannot connect to database" | Verify `DATABASE_URL` in backend environment (Render auto-injects this) |
| Admin page blank | Check browser console (F12). Verify `VITE_API_URL` in admin-web environment |
| Mobile app can't reach backend | Verify mobile `.env` has `EXPO_PUBLIC_API_URL=https://api.nhealth.com.ng/api` |
| 502 Bad Gateway | Check backend logs — likely a crash. Render auto-restarts; watch for errors |
| Out of memory/crashes | Render free tier has 0.5GB RAM. Upgrade to paid plan if needed |

---

## Maintenance Checklist

**Weekly:**
- Check Render dashboard for errors/crashes
- Monitor `aibrainsventures@gmail.com` for alerts

**Monthly:**
- Review logs for patterns
- Test a database backup restore (optional)

**Quarterly:**
- Update dependencies: `npm audit fix`
- Review security settings

---

## Next Steps (After Going Live)

1. ✅ **Set up password reset flow** (email via SendGrid)
2. ✅ **Monitor usage** (Render shows bandwidth, compute time)
3. ✅ **Configure rate limiting** (optional, in backend middleware)
4. ✅ **Enable 2FA** for Render & GitHub accounts
5. ✅ **Set up CI/CD** (GitHub Actions to auto-deploy on push)
6. ✅ **Plan scaling** (upgrade Render plan if user base grows)

---

## Support & Questions

- **Render Docs**: https://render.com/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **N-Health README**: See `n-health/README.md`

---

**Deployment Date**: September 1, 2026  
**Status**: ✅ Production Ready
