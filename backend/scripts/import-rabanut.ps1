# Rabanut Synagogues Bulk Import
# Imports the cleaned synagogues from import-ready.json into the backend.
#
# Usage:
#   .\import-rabanut.ps1 -Email "admin@example.com" -Password "yourpass"

param(
    [string]$Email      = "admin@example.com",
    [string]$Password   = "password",
    [string]$BackendUrl = "http://localhost:3001"
)

$ImportFile = "$PSScriptRoot\import-ready.json"

if (-not (Test-Path $ImportFile)) {
    Write-Host "import-ready.json not found." -ForegroundColor Red
    Write-Host "Run first:  node transform.js --destinationId <id>" -ForegroundColor Yellow
    exit 1
}

# ── Login ─────────────────────────────────────────────────────────────────────

Write-Host "Logging in..." -ForegroundColor Cyan
$loginPayload = @{ email = $Email; password = $Password } | ConvertTo-Json
try {
    $loginResp = Invoke-WebRequest -Uri "$BackendUrl/auth/login" -Method POST `
        -Headers @{ "Content-Type" = "application/json" } -Body $loginPayload
    $token = ($loginResp.Content | ConvertFrom-Json).access_token
    if (-not $token) { throw "No access_token in response" }
    Write-Host "Login OK" -ForegroundColor Green
} catch {
    Write-Host "Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# ── Read & send in batches ────────────────────────────────────────────────────

$payload = Get-Content $ImportFile -Raw | ConvertFrom-Json
$total   = $payload.Count
$batchSize = 50

Write-Host ""
Write-Host "Sending $total synagogues in batches of $batchSize..." -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $token"
}

$imported = 0
$errors   = 0

for ($i = 0; $i -lt $total; $i += $batchSize) {
    $batch     = $payload[$i..[Math]::Min($i + $batchSize - 1, $total - 1)]
    $batchNum  = [Math]::Floor($i / $batchSize) + 1
    $batchTotal = [Math]::Ceiling($total / $batchSize)

    Write-Host "Batch $batchNum/$batchTotal  (records $($i+1)–$([Math]::Min($i+$batchSize,$total)) of $total)..." -NoNewline

    try {
        $body = ConvertTo-Json -InputObject $batch -Depth 10
        $resp = Invoke-WebRequest -Uri "$BackendUrl/admin/synagogues/bulk" `
            -Method POST -Headers $headers -Body $body
        $result = $resp.Content | ConvertFrom-Json
        $imported += $batch.Count
        Write-Host " OK ($($batch.Count) sent)" -ForegroundColor Green
    } catch {
        $errors++
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host "  Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        try {
            $detail = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "  Error: $($detail | ConvertTo-Json -Depth 5)" -ForegroundColor Red
        } catch {}
    }

    Start-Sleep -Milliseconds 300
}

# ── Summary ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "─────────────────────────────────" -ForegroundColor Cyan
Write-Host "  Import Summary"
Write-Host "─────────────────────────────────" -ForegroundColor Cyan
Write-Host "Total records:  $total"
Write-Host "Sent OK:        $imported" -ForegroundColor Green
if ($errors -gt 0) {
    Write-Host "Batch errors:   $errors" -ForegroundColor Red
} else {
    Write-Host "Batch errors:   0" -ForegroundColor Green
}
Write-Host "─────────────────────────────────" -ForegroundColor Cyan
