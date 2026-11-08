# 🚀 POWERSHELL DEPLOYMENT CHEAT SHEET

## QUICK COMMANDS

```powershell
# Navigate to project
cd C:\Users\DELL\Downloads\n-health-phase16\n-health

# Generate JWT secret (copy to Render)
.\generate-jwt-secret.ps1

# Check everything is installed
.\deploy-render.ps1 -Action check

# Set your backend URL (replace with actual)
$backendUrl = "https://n-health-backend-abc123.onrender.com"

# Setup environment variables
.\deploy-render.ps1 -BackendUrl $backendUrl -Action setup-env

# Build frontend
.\deploy-render.ps1 -Action build-frontend

# Test backend
.\deploy-render.ps1 -BackendUrl $backendUrl -Action test

# Deploy to Vercel
.\deploy-render.ps1 -Action deploy-frontend

# Do everything at once
.\deploy-render.ps1 -BackendUrl $backendUrl -Action full
```

---

## MANUAL STEPS (Render Dashboard)

### Create Database
1. https://dashboard.render.com
2. New + → PostgreSQL
3. Name: n-health-db
4. User: nhealth
5. Database: nhealth
6. **Copy internal URL**

### Deploy Backend
1. New + → Web Service
2. Connect GitHub (AbuBkrrr/NHealth)
3. Name: n-health-backend
4. Root: backend
5. Build: npm install && npm run build
6. Start: npm start
7. Add 7 env variables:
   - NODE_ENV=production
   - PORT=4000
   - DATABASE_URL=[from step 1]
   - JWT_SECRET=[from .\generate-jwt-secret.ps1]
   - JWT_EXPIRES_IN=7d
   - CORS_ORIGIN=https://admin-kncvmxlpz-budget-pro.vercel.app
   - PUBLIC_URL=[blank]
8. Create & wait 5-10 minutes
9. **Copy backend URL**

### Update Configuration
1. Go to n-health-backend
2. Environment tab
3. Update PUBLIC_URL to your backend URL
4. Save (auto redeploys)

---

## WORKFLOW

```
┌─ MANUAL: Create Database
├─ MANUAL: Deploy Backend (15 min wait)
├─ PowerShell: Generate JWT Secret
├─ MANUAL: Add JWT_SECRET to Render
├─ MANUAL: Update PUBLIC_URL on Render
├─ PowerShell: Full Deployment
│  ├─ Check prerequisites
│  ├─ Setup environment
│  ├─ Build frontend
│  ├─ Test backend
│  └─ Deploy to Vercel
└─ Manual: Test system
   ├─ Sign up
   ├─ Login
   └─ Verify dashboard
```

---

## COMMON ISSUES & FIXES

```powershell
# Permission denied
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Vercel not installed
npm install -g vercel

# Need to rebuild
cd admin-web
Remove-Item -Recurse node_modules
npm install
npm run build

# Check backend URL format
$backendUrl  # Should show: https://n-health-backend-SOMETHING.onrender.com
```

---

## KEY URLS

```
Render Dashboard:    https://dashboard.render.com
GitHub:              https://github.com/AbuBkrrr/NHealth
Frontend Live:       https://admin-kncvmxlpz-budget-pro.vercel.app
Backend Health:      [your-backend-url]/health
```

---

## DEPLOYMENT CHECKLIST

Manual Steps:
- [ ] Create PostgreSQL database
- [ ] Deploy backend service
- [ ] Copy database URL
- [ ] Copy backend URL
- [ ] Generate JWT secret
- [ ] Add all env variables to Render
- [ ] Update PUBLIC_URL on Render

PowerShell Steps:
- [ ] Check prerequisites: `.\deploy-render.ps1 -Action check`
- [ ] Setup env: `.\deploy-render.ps1 -BackendUrl $url -Action setup-env`
- [ ] Build: `.\deploy-render.ps1 -Action build-frontend`
- [ ] Test: `.\deploy-render.ps1 -BackendUrl $url -Action test`
- [ ] Deploy: `.\deploy-render.ps1 -Action deploy-frontend`

Testing:
- [ ] Visit frontend URL
- [ ] Sign up
- [ ] Login
- [ ] Dashboard loads
- [ ] Real-time clock works

---

## SCRIPT USAGE

```powershell
# Help
.\deploy-render.ps1 -Action help

# Check setup
.\deploy-render.ps1 -Action check

# Generate JWT
.\generate-jwt-secret.ps1
.\generate-jwt-secret.ps1 -Length 64

# Individual steps
.\deploy-render.ps1 -BackendUrl $url -Action setup-env
.\deploy-render.ps1 -Action build-frontend
.\deploy-render.ps1 -BackendUrl $url -Action test
.\deploy-render.ps1 -Action deploy-frontend

# Full deployment
.\deploy-render.ps1 -BackendUrl $url -Action full
```

---

## ENVIRONMENT VARIABLES

**Set by PowerShell script**:
```
VITE_API_URL=https://n-health-backend-xxx.onrender.com/api
VITE_APP_MODE=production
```

**Set manually on Render**:
```
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://nhealth:...@dpg-xxx.render.internal:5432/nhealth
JWT_SECRET=[generated from script]
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://admin-kncvmxlpz-budget-pro.vercel.app
PUBLIC_URL=https://n-health-backend-xxx.onrender.com
```

---

## TIME ESTIMATES

```
Database creation:        2 minutes
Backend deployment:      15 minutes  ⏳ (you wait)
Backend config:           2 minutes
PowerShell deployment:    10 minutes ⏳ (includes build)
Manual testing:           5 minutes
────────────────────────────────────
TOTAL:                   34 minutes
```

---

## VERIFICATION

```powershell
# Health check
$backendUrl = "https://n-health-backend-abc123.onrender.com"
Invoke-WebRequest -Uri "$backendUrl/health" -UseBasicParsing

# Should return: {"status":"ok"}
```

---

## NEXT STEPS

1. **After PowerShell deployment**:
   ```powershell
   .\deploy-render.ps1 -BackendUrl $url -Action full
   ```

2. **Test the system**:
   - Visit frontend URL
   - Create account
   - Login
   - Verify dashboard

3. **All 7 roles**:
   - Patient ✅
   - Doctor ✅
   - Nurse ✅
   - Pharmacy ✅
   - Lab ✅
   - Ambulance ✅
   - Admin ✅

---

## QUICK START (Copy-Paste)

```powershell
# 1. Go to project
cd C:\Users\DELL\Downloads\n-health-phase16\n-health

# 2. Generate JWT (copy to Render)
.\generate-jwt-secret.ps1

# 3. [Do Render steps manually]
# 4. [Copy your backend URL]

# 5. Set URL and deploy
$backendUrl = "https://n-health-backend-YOUR_ID.onrender.com"
.\deploy-render.ps1 -BackendUrl $backendUrl -Action full

# Done!
```

---

**Ready? Run:**
```powershell
.\deploy-render.ps1 -Action help
```

