Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NHealth Vulnerability Fix Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Fix admin-web vulnerabilities
Write-Host "`n[1/3] Fixing admin-web vulnerabilities..." -ForegroundColor Yellow
cd admin-web
npm audit fix --force
cd ..

# Fix backend vulnerabilities  
Write-Host "`n[2/3] Fixing backend vulnerabilities..." -ForegroundColor Yellow
cd backend
npm audit fix --force
cd ..

# Fix mobile vulnerabilities with legacy peer deps
Write-Host "`n[3/3] Fixing mobile vulnerabilities..." -ForegroundColor Yellow
cd mobile
npm audit fix --force --legacy-peer-deps
cd ..

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "All vulnerabilities fixed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Stage changes
Write-Host "`nStaging changes..." -ForegroundColor Cyan
git add -A

# Commit
Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m "fix: resolve npm vulnerabilities and peer dependency conflicts

- Fixed admin-web dependencies
- Fixed backend dependencies
- Fixed mobile React Native peer dependencies using legacy-peer-deps flag
- Applied npm audit fix --force across all projects"

# Push
Write-Host "Pushing to repository..." -ForegroundColor Cyan
git push origin main

Write-Host "`nDone!" -ForegroundColor Green
