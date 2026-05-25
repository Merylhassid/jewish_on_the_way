param(
    [string]$Email      = "admin@example.com",
    [string]$Password   = "password",
    [string]$BackendUrl = "http://localhost:3001"
)

# Login
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

# Load data
$jsonPath = Join-Path $PSScriptRoot "rabanut-scraper\gedera_synagogues_clean.json"
$payload = Get-Content $jsonPath -Raw | ConvertFrom-Json

# Send
$headers = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $token" }
$total = $payload.Count
Write-Host "Sending $total synagogues to destination 310 (גדרה)..." -ForegroundColor Cyan

try {
    Invoke-WebRequest -Uri "$BackendUrl/admin/synagogues/bulk" -Method POST `
        -Headers $headers -Body (ConvertTo-Json -InputObject $payload -Depth 10) | Out-Null
    Write-Host "Done — $total synagogues imported successfully" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
