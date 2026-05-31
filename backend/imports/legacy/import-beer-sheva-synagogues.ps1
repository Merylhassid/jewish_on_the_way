# Beer Sheva Synagogues Bulk Import
# Usage: .\import-beer-sheva-synagogues.ps1 -Email "admin@example.com" -Password "yourpass"

param(
    [string]$Email      = "admin@example.com",
    [string]$Password   = "password",
    [string]$BackendUrl = "http://localhost:3001"
)

$ImportFile = "$PSScriptRoot\rabanut-scraper\beer-sheva_synagogues_import.json"

if (-not (Test-Path $ImportFile)) {
    Write-Host "File not found: $ImportFile" -ForegroundColor Red; exit 1
}

Write-Host "Logging in..." -ForegroundColor Cyan
$loginPayload = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
    $loginResp = Invoke-WebRequest -Uri "$BackendUrl/auth/login" -Method POST `
        -Headers @{ "Content-Type" = "application/json" } -Body $loginPayload
    $token = ($loginResp.Content | ConvertFrom-Json).access_token
    if (-not $token) { throw "No access_token" }
    Write-Host "Login OK" -ForegroundColor Green
} catch {
    Write-Host "Login failed: $($_.Exception.Message)" -ForegroundColor Red; exit 1
}

$payload  = Get-Content $ImportFile -Raw | ConvertFrom-Json
$total    = $payload.Count
$headers  = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $token" }
$batchSize = 50

Write-Host "Sending $total synagogues in batches of $batchSize..." -ForegroundColor Cyan

$sent = 0; $errors = 0; $batchNum = 0
for ($i = 0; $i -lt $total; $i += $batchSize) {
    $batchNum++
    $batch      = @($payload[$i..[Math]::Min($i + $batchSize - 1, $total - 1)])
    $batchTotal = [Math]::Ceiling($total / $batchSize)
    Write-Host "Batch $batchNum/$batchTotal ($($batch.Count) records)..." -NoNewline
    try {
        Invoke-WebRequest -Uri "$BackendUrl/admin/synagogues/bulk" -Method POST `
            -Headers $headers -Body (ConvertTo-Json -InputObject $batch -Depth 10) | Out-Null
        $sent += $batch.Count
        Write-Host " OK" -ForegroundColor Green
    } catch {
        $errors++
        Write-Host " FAILED: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 300
}

Write-Host ""
Write-Host "Done — Sent: $sent | Errors: $errors" -ForegroundColor Cyan
