param(
    [Parameter(Mandatory=$false)]
    [string]$BackendUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$Action = "help"
)

function Show-Help {
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "N-HEALTH RENDER DEPLOYMENT" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "USAGE:" -ForegroundColor Yellow
    Write-Host "  ./deploy-render.ps1 -BackendUrl URL -Action ACTION"
    Write-Host ""
    Write-Host "ACTIONS:" -ForegroundColor Yellow
    Write-Host "  help              Show this help"
    Write-Host "  check             Check prerequisites"
    Write-Host "  setup-env         Setup environment"
    Write-Host "  build-frontend    Build frontend"
    Write-Host "  deploy-frontend   Deploy to Vercel"
    Write-Host "  test              Test backend health"
    Write-Host "  full              Do everything"
    Write-Host ""
}

function Check-Prerequisites {
    Write-Host ""
    Write-Host "Checking prerequisites..." -ForegroundColor Cyan
    Write-Host ""
    
    $ok = $true
    
    try { $v = node --version; Write-Host "[OK] Node.js: $v" -ForegroundColor Green } 
    catch { Write-Host "[FAIL] Node.js not found" -ForegroundColor Red; $ok = $false }
    
    try { $v = npm --version; Write-Host "[OK] npm: $v" -ForegroundColor Green } 
    catch { Write-Host "[FAIL] npm not found" -ForegroundColor Red; $ok = $false }
    
    try { $v = vercel --version; Write-Host "[OK] Vercel: $v" -ForegroundColor Green } 
    catch { Write-Host "[WARN] Installing Vercel..." -ForegroundColor Yellow; npm install -g vercel }
    
    try { $v = git --version; Write-Host "[OK] Git: $v" -ForegroundColor Green } 
    catch { Write-Host "[FAIL] Git not found" -ForegroundColor Red; $ok = $false }
    
    if (Test-Path "admin-web" -PathType Container) { Write-Host "[OK] admin-web directory exists" -ForegroundColor Green }
    else { Write-Host "[FAIL] admin-web directory not found" -ForegroundColor Red; $ok = $false }
    
    Write-Host ""
    if (-not $ok) { exit 1 }
}

function Setup-Environment {
    param([string]$Url)
    
    Write-Host ""
    Write-Host "Setting up environment..." -ForegroundColor Cyan
    
    if (-not $Url) { Write-Host "Error: BackendUrl required" -ForegroundColor Red; exit 1 }
    
    $envFile = "admin-web\.env.production"
    Write-Host "Backend URL: $Url"
    Write-Host "File: $envFile"
    Write-Host ""
    
    $content = ""
    if (Test-Path $envFile) { $content = Get-Content $envFile -Raw }
    
    $apiUrl = "$Url/api"
    
    if ($content -match "VITE_API_URL=") {
        $content = $content -replace "VITE_API_URL=.*", "VITE_API_URL=$apiUrl"
    } else {
        $content += "`nVITE_API_URL=$apiUrl"
    }
    
    if ($content -match "VITE_APP_MODE=") {
        $content = $content -replace "VITE_APP_MODE=.*", "VITE_APP_MODE=production"
    } else {
        $content += "`nVITE_APP_MODE=production"
    }
    
    Set-Content $envFile -Value $content.TrimStart()
    Write-Host "Environment updated (check $envFile)" -ForegroundColor Green
    Write-Host ""
}

function Build-Frontend {
    Write-Host ""
    Write-Host "Building frontend..." -ForegroundColor Cyan
    Write-Host ""
    
    if (-not (Test-Path "admin-web\package.json")) {
        Write-Host "Error: package.json not found" -ForegroundColor Red
        exit 1
    }
    
    Push-Location admin-web
    npm install
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "npm install failed" -ForegroundColor Red; exit 1 }
    
    npm run build
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "Build failed" -ForegroundColor Red; exit 1 }
    
    Pop-Location
    Write-Host "Build successful" -ForegroundColor Green
    Write-Host ""
}

function Deploy-Frontend {
    Write-Host ""
    Write-Host "Deploying frontend..." -ForegroundColor Cyan
    Write-Host ""
    
    Push-Location admin-web
    vercel --prod --yes
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "Deployment failed" -ForegroundColor Red; exit 1 }
    Pop-Location
    
    Write-Host "Deployment successful" -ForegroundColor Green
    Write-Host ""
}

function Test-Backend {
    param([string]$Url)
    
    Write-Host ""
    Write-Host "Testing backend..." -ForegroundColor Cyan
    
    if (-not $Url) { Write-Host "Error: BackendUrl required" -ForegroundColor Red; exit 1 }
    
    $healthUrl = "$Url/health"
    Write-Host "URL: $healthUrl"
    Write-Host ""
    
    try {
        $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "Backend responding (HTTP 200)" -ForegroundColor Green
            Write-Host "Response: $($response.Content)"
        } else {
            Write-Host "Status: $($response.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Backend unreachable" -ForegroundColor Red
        Write-Host "$($_.Exception.Message)"
        exit 1
    }
    Write-Host ""
}

function Do-Full {
    param([string]$Url)
    
    if (-not $Url) { Write-Host "Error: BackendUrl required" -ForegroundColor Red; exit 1 }
    
    Write-Host ""
    Write-Host "===== FULL DEPLOYMENT =====" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Step 1: Check prerequisites..." -ForegroundColor Yellow
    Check-Prerequisites
    
    Write-Host "Step 2: Setup environment..." -ForegroundColor Yellow
    Setup-Environment -Url $Url
    
    Write-Host "Step 3: Build frontend..." -ForegroundColor Yellow
    Build-Frontend
    
    Write-Host "Step 4: Test backend..." -ForegroundColor Yellow
    Test-Backend -Url $Url
    
    Write-Host "Step 5: Deploy frontend..." -ForegroundColor Yellow
    Deploy-Frontend
    
    Write-Host ""
    Write-Host "===== DEPLOYMENT COMPLETE =====" -ForegroundColor Green
    Write-Host "Frontend: https://admin-kncvmxlpz-budget-pro.vercel.app" -ForegroundColor White
    Write-Host "Backend: $Url" -ForegroundColor White
    Write-Host ""
}

switch ($Action) {
    "help" { Show-Help }
    "check" { Check-Prerequisites }
    "setup-env" { Setup-Environment -Url $BackendUrl }
    "build-frontend" { Build-Frontend }
    "deploy-frontend" { Deploy-Frontend }
    "test" { Test-Backend -Url $BackendUrl }
    "full" { Do-Full -Url $BackendUrl }
    default {
        Write-Host "Unknown action: $Action" -ForegroundColor Red
        Show-Help
    }
}
