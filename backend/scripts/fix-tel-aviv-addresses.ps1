# fix-tel-aviv-addresses.ps1
# Fetches ALL synagogues for destination 348, appends ", תל אביב" to any
# address that doesn't already include it, then re-submits via bulk import
# so the server re-geocodes to the correct Tel Aviv location.
#
# Usage:
#   .\fix-tel-aviv-addresses.ps1 -Email "admin@example.com" -Password "yourpass"

param(
    [string]$Email        = "admin@example.com",
    [string]$Password     = "password",
    [string]$BackendUrl   = "http://localhost:3001",
    [int]   $DestinationId = 348,
    [string]$City         = "תל אביב",
    [int]   $BatchSize    = 50
)

# ── Login ──────────────────────────────────────────────────────────────────────
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

# ── Fetch all synagogues for destination ──────────────────────────────────────
Write-Host ""
Write-Host "Fetching all synagogues for destination $DestinationId..." -ForegroundColor Cyan
try {
    $resp = Invoke-WebRequest -Uri "$BackendUrl/synagogues?destinationId=$DestinationId" -Method GET
    $allSynagogues = $resp.Content | ConvertFrom-Json
    Write-Host "Found $($allSynagogues.Count) synagogues total" -ForegroundColor Green
} catch {
    Write-Host "Failed to fetch synagogues: $($_.Exception.Message)" -ForegroundColor Red; exit 1
}

# ── Filter: only those missing the city in their address ──────────────────────
$toUpdate = $allSynagogues | Where-Object {
    # Has an address AND it doesn't already contain the city name
    $_.address -and ($_.address -notlike "*$City*")
}

Write-Host "Need update: $($toUpdate.Count) synagogues" -ForegroundColor Yellow
Write-Host "Already correct: $($allSynagogues.Count - $toUpdate.Count) synagogues" -ForegroundColor Green

if ($toUpdate.Count -eq 0) {
    Write-Host ""
    Write-Host "Nothing to do — all addresses already include '$City'." -ForegroundColor Green
    exit 0
}

# ── Build payload ─────────────────────────────────────────────────────────────
$payload = $toUpdate | ForEach-Object {
    $updated = @{
        name          = $_.name
        destinationId = $DestinationId
        address       = "$($_.address), $City"
    }
    # Carry over existing fields so we don't wipe them
    if ($_.phone)   { $updated.phone   = $_.phone }
    if ($_.website) { $updated.website = $_.website }
    $updated
}

# ── Send in batches ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Sending updates in batches of $BatchSize..." -ForegroundColor Cyan

$headers  = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $token" }
$total    = $payload.Count
$sent     = 0
$errors   = 0
$batchNum = 0

for ($i = 0; $i -lt $total; $i += $BatchSize) {
    $batchNum++
    $batch      = @($payload[$i..[Math]::Min($i + $BatchSize - 1, $total - 1)])
    $batchTotal = [Math]::Ceiling($total / $BatchSize)

    Write-Host "Batch $batchNum/$batchTotal  ($($batch.Count) records)..." -NoNewline

    try {
        $body = ConvertTo-Json -InputObject $batch -Depth 10
        Invoke-WebRequest -Uri "$BackendUrl/admin/synagogues/bulk" `
            -Method POST -Headers $headers -Body $body | Out-Null
        $sent += $batch.Count
        Write-Host " OK" -ForegroundColor Green
    } catch {
        $errors++
        Write-Host " FAILED: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }

    Start-Sleep -Milliseconds 300
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "─────────────────────────────────" -ForegroundColor Cyan
Write-Host "  Done"
Write-Host "─────────────────────────────────" -ForegroundColor Cyan
Write-Host "Updated OK:    $sent" -ForegroundColor Green
if ($errors -gt 0) {
    Write-Host "Batch errors:  $errors" -ForegroundColor Red
} else {
    Write-Host "Batch errors:  0" -ForegroundColor Green
}
Write-Host ""
Write-Host "All updated synagogues were re-geocoded with '$City' in the address."
