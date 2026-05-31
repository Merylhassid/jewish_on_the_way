# ────────────────────────────────────────────────────────────────
# Import Jerusalem synagogues in batches of 50
# Each batch takes ~55 seconds (50 × 1.1s geocoding)
# ────────────────────────────────────────────────────────────────

$BackendUrl  = "http://localhost:3001"
$JsonFile    = "$PSScriptRoot\..\synagogue-scrapers\jerusalem_synagogues.json"
$BatchSize   = 50

# Login
Write-Host "🔐 Logging in..." -ForegroundColor Cyan
$token = (Invoke-RestMethod -Uri "$BackendUrl/auth/login" `
    -Method Post -ContentType "application/json" `
    -Body '{"email":"daniyehudai@gmail.com","password":"daniel2109"}').access_token

if (-not $token) { Write-Host "❌ Login failed" -ForegroundColor Red; exit 1 }
Write-Host "✅ Logged in" -ForegroundColor Green

# Load data
$allRows = Get-Content $JsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
$total   = $allRows.Count
Write-Host "📂 Loaded $total synagogues from JSON" -ForegroundColor Cyan

# Counters
$totalCreated = 0
$totalUpdated = 0
$totalSkipped = 0
$totalErrors  = 0

# Batch loop
$batchNum = 0
for ($i = 0; $i -lt $total; $i += $BatchSize) {
    $batchNum++
    $end   = [Math]::Min($i + $BatchSize, $total)
    $batch = $allRows[$i..($end - 1)]
    $count = $batch.Count

    Write-Host ""
    Write-Host "📦 Batch $batchNum — rows $($i+1)–$end ($count entries)..." -ForegroundColor Yellow

    try {
        $body   = ConvertTo-Json -InputObject $batch -Depth 10
        $result = Invoke-RestMethod `
            -Uri "$BackendUrl/admin/synagogues/bulk" `
            -Method Post `
            -ContentType "application/json; charset=utf-8" `
            -Headers @{ Authorization = "Bearer $token" } `
            -Body $body `
            -TimeoutSec 300   # 5-minute timeout per batch

        $totalCreated += $result.created
        $totalUpdated += $result.updated
        $totalSkipped += $result.skipped
        $totalErrors  += $result.errors

        Write-Host "  ✅ created=$($result.created) updated=$($result.updated) skipped=$($result.skipped) errors=$($result.errors)" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ Batch $batchNum FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $totalErrors += $count
    }
}

Write-Host ""
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ DONE — $batchNum batches" -ForegroundColor Green
Write-Host "   created=$totalCreated  updated=$totalUpdated  skipped=$totalSkipped  errors=$totalErrors" -ForegroundColor Green
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
