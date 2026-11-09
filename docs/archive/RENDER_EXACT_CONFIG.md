# EXACT RENDER CONFIGURATION FOR N-HEALTH BACKEND

## ROOT DIRECTORY
backend

## DOCKERFILE PATH
Dockerfile

## HEALTH CHECK PATH
/health

## DOCKER BUILD CONTEXT DIRECTORY
.

## DOCKER COMMAND
npm ci && npm run build

## START COMMAND
npm start

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ENVIRONMENT VARIABLES (Set all 7)

NODE_ENV
production

PORT
4000

DATABASE_URL
postgresql://nhealth_com_ng_user:[YOUR_PASSWORD]@dpg-dacmrlijnfac73d49te0-a/nhealth_com_ng

JWT_SECRET
[Generate with: powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\DELL\Downloads\n-health-phase16\n-health\generate-jwt-secret.ps1']

JWT_EXPIRES_IN
7d

CORS_ORIGIN
https://admin-8vzzjm0el-budget-pro.vercel.app

PUBLIC_URL
[Will be auto-filled - format: https://n-health-backend-XXXXX.onrender.com]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## STEP-BY-STEP COPY-PASTE

1. Root Directory: Copy this exactly:
   backend

2. Dockerfile Path: Copy this exactly:
   Dockerfile

3. Health Check Path: Copy this exactly:
   /health

4. Docker Build Context Directory: Copy this exactly:
   .

5. Docker Command: Copy this exactly:
   npm ci && npm run build

6. Start Command: Copy this exactly:
   npm start

7. Environment Variables: Add these EXACTLY as shown:

   KEY: NODE_ENV
   VALUE: production

   KEY: PORT
   VALUE: 4000

   KEY: DATABASE_URL
   VALUE: postgresql://nhealth_com_ng_user:[YOUR_PASSWORD]@dpg-dacmrlijnfac73d49te0-a/nhealth_com_ng
   (Replace [YOUR_PASSWORD] with your actual database password from Render)

   KEY: JWT_SECRET
   VALUE: [Generate a new one - run the PowerShell script and paste here]

   KEY: JWT_EXPIRES_IN
   VALUE: 7d

   KEY: CORS_ORIGIN
   VALUE: https://admin-8vzzjm0el-budget-pro.vercel.app

   KEY: PUBLIC_URL
   VALUE: [Leave empty for now - Render will auto-fill after first deploy]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## GENERATE JWT_SECRET

Run this in PowerShell:

powershell -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\DELL\Downloads\n-health-phase16\n-health\generate-jwt-secret.ps1'

It will copy a random 32+ character string to your clipboard. Paste that into JWT_SECRET.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## FINAL STEPS

1. Fill in all fields above
2. Click "Update Fields"
3. Click "Manual Deploy"
4. Wait 5-10 minutes for build
5. Check logs for success

If deployment succeeds, you'll see:
✅ N-Health API listening on port 4000 (production)
