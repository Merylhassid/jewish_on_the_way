# Synagogues Bulk Import – Destination 303
# Usage: .\import-303-synagogues.ps1 -Email "admin@example.com" -Password "yourpass"

param(
    [string]$Email      = "admin@example.com",
    [string]$Password   = "password",
    [string]$BackendUrl = "http://localhost:3001"
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

# ── Data ───────────────────────────────────────────────────────────────────────
$payload = @(
    @{ name = "משכן יאיר";                    destinationId = 303; address = "הברוש 4, באר יעקב";                    description = "איש קשר: הרב בן דוד" }
    @{ name = "שמעון הצדיק";                  destinationId = 303; address = "רבי מאיר בעל הנס 17, באר יעקב";        description = "איש קשר: הרב אבהם סרבר" }
    @{ name = "בני ישראל";                    destinationId = 303; address = "הרב עוזיאל 19, באר יעקב";              description = "איש קשר: שימי טל" }
    @{ name = "עולי לוב";                     destinationId = 303; address = "הרב עוזיאל 11, באר יעקב";              phone = "052-3678665"; description = "איש קשר: מוטי דבוש" }
    @{ name = "חזון איש";                     destinationId = 303; address = "חזון איש 6, באר יעקב";                 description = "איש קשר: שמעון מכלוף" }
    @{ name = "אוהל מיכאל";                   destinationId = 303; address = "חזון איש 1, באר יעקב";                 description = "איש קשר: מאיר מרג'ין" }
    @{ name = "יעקב אבינו";                   destinationId = 303; address = "הרב קוק 26, באר יעקב";                 description = "איש קשר: בנצי חמי" }
    @{ name = "יוצאי בבל";                    destinationId = 303; address = "קרן היסוד 13, באר יעקב";               description = "איש קשר: ישראל יום טוב" }
    @{ name = "הבנים";                        destinationId = 303; address = "גבעת חוטר, באר יעקב";                  phone = "052-8555164"; description = "איש קשר: מאיר אמברק" }
    @{ name = "יהודה";                        destinationId = 303; address = "איילה 40, באר יעקב";                   description = "איש קשר: הרב אברהם יעקובזון" }
    @{ name = "מרכז תורני";                   destinationId = 303; address = "שא-נס 19, באר יעקב";                   description = "איש קשר: הרב אברהם בוסקילה" }
    @{ name = "שא נס";                        destinationId = 303; address = "ז'בוטינסקי 2, באר יעקב";               description = "איש קשר: הרב עזרא עטיה" }
    @{ name = "נווה דורון - אשכנזים";         destinationId = 303; address = "ז'בוטינסקי 60, באר יעקב";              description = "איש קשר: קובי מזרחי" }
    @{ name = "אוהל משה";                     destinationId = 303; address = "נחום 11, באר יעקב";                    phone = "052-4572370"; description = "איש קשר: אבי כלף" }
    @{ name = "ספרדים";                       destinationId = 303; address = "תלמי מנשה, באר יעקב" }
    @{ name = "תימנים";                       destinationId = 303; address = "תלמי מנשה, באר יעקב" }
    @{ name = "זכרון מנחם";                   destinationId = 303; address = "תלמי מנשה, באר יעקב" }
    @{ name = "תלמי אליהו";                   destinationId = 303; address = "אהוד מנור, באר יעקב";                  phone = "050-4155681"; description = "איש קשר: הרב יעקב טטרו" }
    @{ name = "חב''ד איילה";                  destinationId = 303; address = "איילה 34, באר יעקב";                   phone = "054-7330363"; description = "איש קשר: הרב שמואל בקרמן" }
    @{ name = "יוצאי אתיופיה - היכל שלמה";   destinationId = 303; address = "ר' מאיר בעה''נ 23, באר יעקב";          description = "איש קשר: הרב דביר בוחניק" }
    @{ name = "רח' ברקת";                     destinationId = 303; address = "ברקת 8, באר יעקב";                     phone = "052-8094449"; description = "איש קשר: אפי גבאי" }
    @{ name = "אור יצחק";                     destinationId = 303; address = "שוהם, באר יעקב";                       phone = "052-6441777"; description = "איש קשר: הרב עמר" }
    @{ name = "חב''ד שוהם";                   destinationId = 303; address = "שוהם, באר יעקב";                       phone = "058-7708084"; description = "איש קשר: הרב עקיבא פרידמן" }
    @{ name = "היכל יוסף";                    destinationId = 303; address = "קרן היסוד, באר יעקב";                  description = "איש קשר: הרב מיכאל רגינה" }
    @{ name = "ברסלב";                        destinationId = 303; address = "הרב עוזיאל, באר יעקב";                 phone = "052-8322646"; description = "איש קשר: שוקי גיירו" }
    @{ name = "אברהם אבינו";                  destinationId = 303; address = "הרב עוזיאל, באר יעקב";                 description = "איש קשר: הרב אליהו חיים" }
    @{ name = "באר חיים - ז'בוטינסקי";        destinationId = 303; address = "ז'בוטינסקי, באר יעקב";                 description = "איש קשר: הרב אלמו בוחניק" }
    @{ name = "באר חיים - כוכב הצפון";        destinationId = 303; address = "כוכב הצפון, באר יעקב";                 description = "איש קשר: הרב אלמו בוחניק" }
)

# ── Send ───────────────────────────────────────────────────────────────────────
$headers = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $token" }
$body    = ConvertTo-Json -InputObject $payload -Depth 10

Write-Host ""
Write-Host "Sending $($payload.Count) synagogues to destination 303..." -ForegroundColor Cyan

try {
    $resp = Invoke-WebRequest -Uri "$BackendUrl/admin/synagogues/bulk" -Method POST -Headers $headers -Body $body
    Write-Host "Import successful — $($payload.Count) synagogues sent" -ForegroundColor Green
    $resp.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "Import failed: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    try { $_.ErrorDetails.Message | ConvertFrom-Json | ConvertTo-Json -Depth 5 | Write-Host } catch {}
    exit 1
}
