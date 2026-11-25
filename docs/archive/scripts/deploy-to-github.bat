@echo off
REM N-Health Backend Deployment Script for Render
REM This script automates pushing code to GitHub

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                                                            ║
echo ║   N-HEALTH BACKEND - RENDER DEPLOYMENT SCRIPT             ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check if Git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git is not installed. Please install Git from https://git-scm.com
    pause
    exit /b 1
)

echo Step 1: Configure Git
set /p GIT_EMAIL="Enter your email (for commits): "
set /p GIT_NAME="Enter your name (for commits): "

git config --global user.email "%GIT_EMAIL%"
git config --global user.name "%GIT_NAME%"
echo ✅ Git configured

echo.
echo Step 2: Initialize Repository
cd "%~dp0"
git init
git add .
git commit -m "N-Health backend ready for production deployment"
echo ✅ Repository initialized and committed

echo.
echo Step 3: Add GitHub Remote
set /p GITHUB_URL="Enter your GitHub repository URL (e.g., https://github.com/username/n-health.git): "

git remote add origin %GITHUB_URL%
git branch -M main
echo ✅ GitHub remote configured

echo.
echo Step 4: Push to GitHub
echo Pushing code to GitHub...
git push -u origin main
if errorlevel 1 (
    echo ❌ Failed to push to GitHub
    echo Make sure your GitHub URL is correct and you have push access
    pause
    exit /b 1
)
echo ✅ Code pushed to GitHub

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                  DEPLOYMENT READY                         ║
echo ╠════════════════════════════════════════════════════════════╣
echo ║                                                            ║
echo ║ ✅ Code pushed to GitHub                                 ║
echo ║                                                            ║
echo ║ Next steps:                                              ║
echo ║ 1. Go to https://render.com                             ║
echo ║ 2. Sign up / Log in                                     ║
echo ║ 3. Create PostgreSQL database                           ║
echo ║ 4. Deploy backend service                               ║
echo ║ 5. Configure environment variables                      ║
echo ║ 6. Update frontend with backend URL                     ║
echo ║ 7. Redeploy frontend to Vercel                          ║
echo ║ 8. Test login                                           ║
echo ║                                                            ║
echo ║ See: RENDER_DEPLOYMENT_GUIDE.md for detailed steps      ║
echo ║                                                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

pause
