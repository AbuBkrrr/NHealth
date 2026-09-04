#!/usr/bin/env pwsh
<#
.SYNOPSIS
Generate JWT Secret for N-Health Render Deployment

.DESCRIPTION
Generates a secure random string suitable for JWT_SECRET environment variable

.PARAMETER Length
Length of the secret (default 32)

.EXAMPLE
.\generate-jwt-secret.ps1
.\generate-jwt-secret.ps1 -Length 64
#>

param(
    [Parameter(Mandatory=$false)]
    [int]$Length = 32
)

function Generate-RandomString {
    param(
        [int]$Length = 32,
        [string]$CharacterSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
    )
    
    $random = New-Object System.Random
    $chars = $CharacterSet.ToCharArray()
    $result = ""
    
    for ($i = 0; $i -lt $Length; $i++) {
        $result += $chars[$random.Next($chars.Length)]
    }
    
    return $result
}

Write-Host "`n" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  JWT SECRET GENERATOR" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "`n" -ForegroundColor Cyan

$secret = Generate-RandomString -Length $Length

Write-Host "Generated JWT Secret ($Length characters):" -ForegroundColor Green
Write-Host "`n$secret`n" -ForegroundColor Yellow

Write-Host "Instructions:" -ForegroundColor Cyan
Write-Host "1. Copy the secret above (Ctrl+C or right-click)" -ForegroundColor White
Write-Host "2. Go to Render dashboard" -ForegroundColor White
Write-Host "3. Select n-health-backend service" -ForegroundColor White
Write-Host "4. Go to Environment tab" -ForegroundColor White
Write-Host "5. Add environment variable:" -ForegroundColor White
Write-Host "   KEY: JWT_SECRET" -ForegroundColor White
Write-Host "   VALUE: [paste the secret]`n" -ForegroundColor White

# Copy to clipboard (Windows)
try {
    $secret | Set-Clipboard
    Write-Host "✅ Secret copied to clipboard!`n" -ForegroundColor Green
}
catch {
    Write-Host "Note: Could not copy to clipboard. Please copy manually.`n" -ForegroundColor Yellow
}
