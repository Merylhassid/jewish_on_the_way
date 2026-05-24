# Binyamina Synagogues Bulk Import – Destination 390
# Usage: .\import-binyamina-synagogues.ps1 -Email "admin@example.com" -Password "yourpass"

param(
    [string]$Email      = "admin@example.com",
    [string]$Password   = "password",
    [string]$BackendUrl = "http://localhost:3001"
)

function Add-City($addr) {
    if (-not $addr -or $addr -eq "") { return $null }
    if ($addr -like "*בנימינה*") { return $addr }
    return "$addr, בנימינה"
}

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

# ── Data ───────────────────────────────────────────────────────────────────────
$payload = @(
    @{ name="שערי צדק";                          destinationId=390; address=(Add-City "הרקפת, בנימינה");           phone="050-6264980"; denomination="תימן";               description="נוסח: תימן | גבאי: אהרון שיאחי, יוסף עמרם" }
    @{ name="שערי ציון";                          destinationId=390; address=(Add-City "שכ' ישורון, בנימינה");      phone="052-8433665"; denomination="לובי ירושלמי";         description="נוסח: לובי ירושלמי | גבאי: בנימין חיון, עמוס חיון" }
    @{ name="שערי רחמים";                         destinationId=390; address=(Add-City "העצמאות, בנימינה");         phone="050-7875000";                                     description="גבאי: מאיר מלכה, אלי אנקונינה" }
    @{ name="סוכת שלום";                          destinationId=390; address=(Add-City "הסחלב, בנימינה");           phone="050-5665280"; denomination="תימני";               description="נוסח: תימני | גבאי: כתריאל אברהם, יצחק כתריאל" }
    @{ name="תפארת בנימין";                       destinationId=390; address=(Add-City "קרן היסוד, בנימינה");       phone="054-5988047"; denomination="אשכנזי נוסח אחיד";   description="נוסח: אשכנזי נוסח אחיד | גבאי: מתי אריזון, ארנון פסטר, צבי רווח" }
    @{ name="תפארת ישראל";                        destinationId=390; address=(Add-City "העצמאות, בנימינה");         phone="052-2411777"; denomination="לובי ירושלמי";         description="נוסח: לובי ירושלמי | גבאי: מכלוף גדעון, יצחק מכלוף" }
    @{ name="עץ חיים";                            destinationId=390; address=(Add-City "העצמאות 69, בנימינה");      phone="054-8189123"; denomination="מרוקאי";               description="נוסח: מרוקאי | גבאי: אשר דהן, הדר עמירם" }
    @{ name="עץ החיים (אוהל יעקב)";               destinationId=390; address=(Add-City "שכ' יעקב, בנימינה");        phone="053-9946894"; denomination="מעורב";                description="נוסח: מעורב | גבאי: אריה צ'יפקיס, קודר שמואל, מרדכי חנניה" }
    @{ name="בית הכנסת הנדיב";                    destinationId=390; address=(Add-City "הסחלב, בנימינה");           phone="054-4850912"; denomination="נוסח אחיד מעורב";     description="נוסח: נוסח אחיד מעורב | גבאי: גדעון לידר, הרב ישראל ויינברגר, חגי גולן" }
    @{ name='שערי אורה (חב"ד)';                   destinationId=390; address=(Add-City "האירוס, בנימינה");           phone="054-9770502"; denomination='חב"ד';                 description='נוסח: חב"ד | גבאי: הרב יהושוע אדוט' }
    @{ name='כולל מגן אברהם';                     destinationId=390;                                                 phone="050-3309404"; denomination="ירושלמי מעורב";       description="נוסח: ירושלמי מעורב" }
)

# ── Send ───────────────────────────────────────────────────────────────────────
$headers   = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $token" }
$total     = $payload.Count
$batchSize = 50
$sent = 0; $errors = 0; $batchNum = 0

Write-Host ""
Write-Host "Sending $total synagogues to destination 390 (בנימינה)..." -ForegroundColor Cyan

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
