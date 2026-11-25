# 🚀 POWERSHELL DEPLOYMENT GUIDE - RENDER

**Using PowerShell to automate N-Health deployment on Render**

---

## 📋 PREREQUISITES

Before running scripts, ensure you have:

1. **PowerShell 7+** (or Windows PowerShell 5.1)
   ```powershell
   $PSVersionTable.PSVersion
   # Should show version 5.1 or higher
   ```

2. **Node.js & npm**
   ```powershell
   node --version
   npm --version
   ```

3. **Vercel CLI**
   ```powershell
   vercel --version
   # If not installed, run: npm install -g vercel
   ```

4. **Git** (already have)
   ```powershell
   git --version
   ```

---

## 🎯 STEP 1: MANUAL RENDER SETUP

These steps must be done on the Render dashboard (no automation yet):

### 1a. Create PostgreSQL Database

```
1. Go to: https://dashboard.render.com
2. Click: New + → PostgreSQL
3. Fill in:
   - Name: n-health-db
   - Database: nhealth
   - User: nhealth
   - Region: Virginia (US East)
4. Click: Create Database
5. Wait for "Available" status
6. Copy INTERNAL Database URL
```

**Save this URL** - you'll need it for backend deployment.

### 1b. Deploy Backend Service

```
1. Click: New + → Web Service
2. Connect GitHub (AbuBkrrr/NHealth)
3. Fill in:
   - Name: n-health-backend
   - Root Directory: backend
   - Build: npm install && npm run build
   - Start: npm start
4. Add Environment Variables (MANUALLY):
   - NODE_ENV: production
   - PORT: 4000
   - DATABASE_URL: [paste internal DB URL]
   - JWT_SECRET: [use script below or generate]
   - JWT_EXPIRES_IN: 7d
   - CORS_ORIGIN: https://admin-kncvmxlpz-budget-pro.vercel.app
   - PUBLIC_URL: [leave blank]
5. Click: Create Web Service
6. Wait for build (~5-10 minutes)
7. Copy Backend URL when ready
```

---

## 🔑 STEP 2: GENERATE JWT SECRET (PowerShell)

Run this PowerShell script to generate a secure JWT secret:

```powershell
cd C:\Users\DELL\Downloads\n-health-phase16\n-health

# Generate JWT secret
.\generate-jwt-secret.ps1

# Output:
# 🔐 JWT SECRET GENERATOR
# Generated JWT Secret (32 characters):
# a7f3k9m2x8n5b1j6c4e0h9r7t2w5v3z9
# 
# ✅ Secret copied to clipboard!
```

**What to do**:
1. Run the script
2. It generates a random 32-character secret
3. Automatically copies to clipboard
4. Paste into Render dashboard (JWT_SECRET environment variable)

**Or generate with custom length**:
```powershell
.\generate-jwt-secret.ps1 -Length 64
# Generates 64-character secret
```

---

## 🏗️ STEP 3: UPDATE & DEPLOY FRONTEND (PowerShell)

After backend is deployed on Render, use this script:

### 3a. Check Prerequisites

```powershell
.\deploy-render.ps1 -Action check

# Output:
# ✅ Node.js installed: v18.0.0
# ✅ npm installed: 9.0.0
# ✅ Vercel CLI installed: 28.0.0
# ✅ Git installed: 2.40.0
# ✅ Found admin-web directory
# ✅ All prerequisites met!
```

### 3b. Setup Environment Variables

```powershell
# Replace with your actual backend URL
$backendUrl = "https://n-health-backend-abc123.onrender.com"

.\deploy-render.ps1 -BackendUrl $backendUrl -Action setup-env

# Output:
# ℹ️  Backend URL: https://n-health-backend-abc123.onrender.com
# ℹ️  Environment file: admin-web\.env.production
# ✅ Environment variables updated:
#   VITE_API_URL=https://n-health-backend-abc123.onrender.com/api
#   VITE_APP_MODE=production
```

**What it does**:
- Reads admin-web/.env.production
- Updates VITE_API_URL with your backend URL
- Sets VITE_APP_MODE to production
- Saves updated file

### 3c. Build Frontend

```powershell
.\deploy-render.ps1 -Action build-frontend

# Output:
# ℹ️  Frontend path: admin-web
# ℹ️  Installing dependencies...
# ✅ Dependencies installed
# ℹ️  Building frontend...
# ✅ Frontend built successfully
```

**What it does**:
- Changes to admin-web directory
- Runs `npm install`
- Runs `npm run build`
- Creates optimized production build in dist/ folder

### 3d. Deploy to Vercel

```powershell
.\deploy-render.ps1 -Action deploy-frontend

# Output:
# ℹ️  Deploying to production...
# ✅ Frontend deployed to Vercel
```

**What it does**:
- Runs `vercel --prod --yes`
- Deploys built frontend to Vercel
- Updates live URL

### 3e. Test Backend Health

```powershell
$backendUrl = "https://n-health-backend-abc123.onrender.com"

.\deploy-render.ps1 -BackendUrl $backendUrl -Action test

# Output:
# ℹ️  Testing: https://n-health-backend-abc123.onrender.com/health
# ✅ Backend is responding (HTTP 200)
# Response: {"status":"ok"}
```

**What it does**:
- Calls backend health endpoint
- Verifies backend is responding
- Shows response

---

## 🚀 STEP 4: FULL DEPLOYMENT (PowerShell)

Run everything with one command:

```powershell
$backendUrl = "https://n-health-backend-abc123.onrender.com"

.\deploy-render.ps1 -BackendUrl $backendUrl -Action full

# Output:
# 
# ╔════════════════════════════════════════════════════════════╗
# ║  FULL DEPLOYMENT WORKFLOW                                 ║
# ╚════════════════════════════════════════════════════════════╝
# 
# ℹ️  Step 1: Checking prerequisites...
# ✅ Node.js installed: v18.0.0
# ✅ npm installed: 9.0.0
# ✅ All prerequisites met!
# 
# ℹ️  Step 2: Setting up environment...
# ✅ Environment variables updated
# 
# ℹ️  Step 3: Building frontend...
# ✅ Frontend built successfully
# 
# ℹ️  Step 4: Testing backend health...
# ✅ Backend is responding (HTTP 200)
# 
# ℹ️  Step 5: Deploying frontend...
# ✅ Frontend deployed to Vercel
# 
# ╔════════════════════════════════════════════════════════════╗
# ║  DEPLOYMENT COMPLETE!                                     ║
# ╚════════════════════════════════════════════════════════════╝
# 
# ✅ Your N-Health system is now connected!
# 
# Next steps:
# 1. Visit https://admin-kncvmxlpz-budget-pro.vercel.app
# 2. Sign up with a test account
# 3. Verify login works
```

---

## 📝 POWERSHELL COMMAND REFERENCE

### Running Scripts

```powershell
# Change to project directory
cd C:\Users\DELL\Downloads\n-health-phase16\n-health

# Set execution policy if needed
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# View help
.\deploy-render.ps1 -Action help

# Check prerequisites
.\deploy-render.ps1 -Action check

# Generate JWT secret
.\generate-jwt-secret.ps1

# Generate JWT secret (custom length)
.\generate-jwt-secret.ps1 -Length 64
```

### Step-by-Step Deployment

```powershell
# 1. Setup environment
$backendUrl = "https://n-health-backend-abc123.onrender.com"
.\deploy-render.ps1 -BackendUrl $backendUrl -Action setup-env

# 2. Build frontend
.\deploy-render.ps1 -Action build-frontend

# 3. Test backend
.\deploy-render.ps1 -BackendUrl $backendUrl -Action test

# 4. Deploy frontend
.\deploy-render.ps1 -Action deploy-frontend

# OR do all at once:
.\deploy-render.ps1 -BackendUrl $backendUrl -Action full
```

---

## 🔧 ENVIRONMENT VARIABLE REFERENCE

Variables set by deploy-render.ps1:

| Variable | Value | Set By |
|----------|-------|--------|
| VITE_API_URL | https://n-health-backend-xxx.onrender.com/api | Script |
| VITE_APP_MODE | production | Script |

Variables you set manually on Render:

| Variable | Example | Notes |
|----------|---------|-------|
| NODE_ENV | production | Required |
| PORT | 4000 | Required |
| DATABASE_URL | postgresql://nhealth@dpg-xxx | From DB creation |
| JWT_SECRET | a7f3k9m2x8n5b1j6c4e0h9r7t2w5v3z9 | Use generate script |
| JWT_EXPIRES_IN | 7d | Required |
| CORS_ORIGIN | https://admin-kncvmxlpz-budget-pro.vercel.app | Required |
| PUBLIC_URL | https://n-health-backend-abc123.onrender.com | Update after deploy |

---

## 📊 FULL DEPLOYMENT WORKFLOW

```
┌─────────────────────────────────────────┐
│ 1. MANUAL: Create PostgreSQL Database   │
│    - Go to Render dashboard             │
│    - New + → PostgreSQL                 │
│    - Copy internal URL                  │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 2. MANUAL: Deploy Backend Service       │
│    - New + → Web Service                │
│    - Connect GitHub                     │
│    - Add env variables manually         │
│    - Wait for build (5-10 min)          │
│    - Copy backend URL                   │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 3. PowerShell: Generate JWT Secret      │
│    $ .\generate-jwt-secret.ps1          │
│    - Generates random 32-char string    │
│    - Copies to clipboard                │
│    - Paste in Render dashboard          │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 4. PowerShell: Full Deployment          │
│    $ .\deploy-render.ps1                │
│      -BackendUrl <URL>                  │
│      -Action full                       │
│                                         │
│    Does:                                │
│    - Check prerequisites                │
│    - Setup environment variables        │
│    - Build frontend                     │
│    - Test backend health                │
│    - Deploy to Vercel                   │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│ 5. Manual: Test Full System             │
│    - Visit frontend URL                 │
│    - Sign up                            │
│    - Login                              │
│    - Verify dashboard                   │
└─────────────────────────────────────────┘
```

---

## 🆘 TROUBLESHOOTING

### PowerShell Execution Policy Error

```
Error: "cannot be loaded because running scripts is disabled"
```

**Solution**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Vercel CLI Not Found

```
Error: "vercel : The term 'vercel' is not recognized"
```

**Solution**:
```powershell
npm install -g vercel
```

### Backend URL Not Working

```powershell
# Test the URL manually
$backendUrl = "https://n-health-backend-abc123.onrender.com"
Invoke-WebRequest -Uri "$backendUrl/health" -UseBasicParsing
```

### Frontend Build Fails

```powershell
# Clear cache and rebuild
cd admin-web
Remove-Item -Recurse node_modules
npm install
npm run build
```

### Deployment Hangs

```powershell
# Ctrl+C to cancel
# Then check Render dashboard for errors
# Retry deployment
```

---

## 📖 SCRIPT DOCUMENTATION

### deploy-render.ps1

**Purpose**: Main deployment script

**Parameters**:
- `-BackendUrl <string>` - Your Render backend URL
- `-Action <string>` - Action to perform (help, check, setup-env, build-frontend, deploy-frontend, test, full)

**Actions**:
- `help` - Show help
- `check` - Check prerequisites
- `setup-env` - Update environment variables
- `build-frontend` - Rebuild frontend
- `deploy-frontend` - Deploy to Vercel
- `test` - Test backend health
- `full` - Do everything

### generate-jwt-secret.ps1

**Purpose**: Generate secure JWT secret

**Parameters**:
- `-Length <int>` - Secret length (default 32)

**Output**: Random secure string copied to clipboard

---

## 🎯 QUICK START

```powershell
# 1. Navigate to project
cd C:\Users\DELL\Downloads\n-health-phase16\n-health

# 2. Generate JWT secret (copy to Render)
.\generate-jwt-secret.ps1

# 3. [MANUAL] Create database & backend on Render dashboard

# 4. Set your backend URL
$backendUrl = "https://n-health-backend-YOUR_ID.onrender.com"

# 5. Run full deployment
.\deploy-render.ps1 -BackendUrl $backendUrl -Action full

# Done! Your system is live!
```

---

## ✅ SUCCESS INDICATORS

When everything works:

```
✅ All prerequisites met!
✅ Environment variables updated
✅ Frontend built successfully
✅ Backend is responding (HTTP 200)
✅ Frontend deployed to Vercel
✅ Your N-Health system is now connected!
```

---

**Ready? Start with:**

```powershell
.\deploy-render.ps1 -Action help
```

