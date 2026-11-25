# 🚀 RENDER BACKEND DEPLOYMENT - STEP BY STEP

**Database Created Successfully** ✅

Your PostgreSQL database is ready:
- **Internal Database URL**: `postgresql://nhealth_com_ng_user:[REDACTED]@dpg-dacmrlijnfac73d49te0-a/nhealth_com_ng`
- **External Database URL**: `postgresql://nhealth_com_ng_user:[REDACTED]@dpg-dacmrlijnfac73d49te0-a.virginia-postgres.render.com/nhealth_com_ng`

---

## 📋 NEXT: DEPLOY BACKEND SERVICE

### Step 1: Create Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** button
3. Select **"Web Service"**

### Step 2: Connect GitHub

1. Click **"Connect account"** (GitHub)
2. Authorize Render to access GitHub
3. Select repository: **AbuBkrrr/NHealth**
4. Click **"Connect"**

### Step 3: Configure Service

**Name:** `n-health-backend`
**Root Directory:** `backend`
**Environment:** Node
**Region:** Virginia (US East) - same as database
**Plan:** Free

**Build Command:**
```
npm install && npm run build
```

**Start Command:**
```
npm start
```

### Step 4: Add Environment Variables

Click **"Advanced"** then add these **7 variables**:

| KEY | VALUE |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `DATABASE_URL` | `postgresql://nhealth_com_ng_user:[PASSWORD]@dpg-dacmrlijnfac73d49te0-a/nhealth_com_ng` |
| `JWT_SECRET` | [Generate with: `powershell -NoProfile -ExecutionPolicy Bypass -File '.\generate-jwt-secret.ps1'`] |
| `JWT_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | `https://admin-kncvmxlpz-budget-pro.vercel.app` |
| `PUBLIC_URL` | [Leave blank for now] |

**For DATABASE_URL**:
- Use the **INTERNAL** URL (with dpg-dacmrlijnfac73d49te0-a, NOT the virginia-postgres one)
- Replace `[REDACTED]` with your actual password from the database creation

**For JWT_SECRET**:
1. Open PowerShell
2. Run: `powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\DELL\Downloads\n-health-phase16\n-health\generate-jwt-secret.ps1'`
3. It generates and copies to clipboard
4. Paste into Render

### Step 5: Create & Wait for Build

1. Click **"Create Web Service"**
2. **Wait 5-10 minutes** for build to complete
3. Check **"Logs"** tab for progress
4. When status shows **"Live"** (green), it's ready

### Step 6: Get Backend URL

When deployment is complete, you'll see a URL like:
```
https://n-health-backend-XXXXX.onrender.com
```

**Copy this URL** - you'll need it for the next step.

---

## ✅ THEN: RUN POWERSHELL AGAIN

Once backend is **LIVE** on Render:

```powershell
cd C:\Users\DELL\Downloads\n-health-phase16\n-health

# Replace XXXXX with your actual backend ID
powershell -NoProfile -ExecutionPolicy Bypass -File '.\deploy-render.ps1' -BackendUrl 'https://n-health-backend-XXXXX.onrender.com' -Action full
```

This will:
- ✅ Setup frontend environment
- ✅ Build frontend
- ✅ Test backend (will pass now)
- ✅ Deploy to Vercel
- ✅ Done!

---

## 🔑 YOUR DATABASE CREDENTIALS

```
Host: dpg-dacmrlijnfac73d49te0-a
Port: 5432
Username: nhealth_com_ng_user
Database: nhealth_com_ng
Password: [shown during creation]

Internal: postgresql://nhealth_com_ng_user:PASSWORD@dpg-dacmrlijnfac73d49te0-a/nhealth_com_ng
External: postgresql://nhealth_com_ng_user:PASSWORD@dpg-dacmrlijnfac73d49te0-a.virginia-postgres.render.com/nhealth_com_ng
```

---

## ⏱️ TIMELINE

- **Now**: Deploy backend service to Render (you're doing this)
- **5-10 min**: Wait for build
- **Then**: Run PowerShell script
- **10 min**: Deploy frontend
- **35 min TOTAL**: Live system

---

**Go to https://dashboard.render.com and create the Web Service now!** 🚀

