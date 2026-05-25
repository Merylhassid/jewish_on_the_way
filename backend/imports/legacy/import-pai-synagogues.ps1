# Pai Synagogues Bulk Import PowerShell Script
# Imports synagogue records for destination 477
# Usage: .\import-pai-synagogues.ps1 -Email "admin@example.com" -Password "password"
#        or with defaults: .\import-pai-synagogues.ps1

param(
    [string]$Email = "admin@example.com",
    [string]$Password = "password",
    [string]$BackendUrl = "http://localhost:3001"
)

# Step 1: Login to get JWT token
Write-Host "Logging in to get access token..." -ForegroundColor Cyan
$loginPayload = @{
    email    = $Email
    password = $Password
} | ConvertTo-Json

$loginHeaders = @{
    "Content-Type" = "application/json"
}

try {
    $loginResponse = Invoke-WebRequest -Uri "$BackendUrl/auth/login" -Method POST -Headers $loginHeaders -Body $loginPayload
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $accessToken = $loginData.access_token

    if (-not $accessToken) {
        Write-Host "Login failed: No access token in response" -ForegroundColor Red
        exit 1
    }

    Write-Host "Login successful" -ForegroundColor Green
} catch {
    Write-Host "Login failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Import synagogues using the token
# Supported fields only: name, address, phone, website, latitude, longitude, description (plus destinationId for routing)
$payload = @(
    @{
        name = "Chabad House Pai"
        destinationId = 477
        address = "71/4 Wiang Tai, Pai District, Mae Hong Son 58130, Thailand"
        phone = "+66 65 719 5466"
        website = "https://chabadthailand.co.il/houses/pai/"
        latitude = 19.36194
        longitude = 98.45715
        description = "Chabad House and synagogue in Pai serving Jewish travelers with daily prayers, Shabbat meals, Torah classes, holiday services and community support. Weekdays: Shacharit 09:30, Mincha near sunset, Arvit 20:00. Shabbat: Shacharit 10:00, Mincha and Kabbalat Shabbat at candle lighting time, Seudah Shlishit and Havdalah after Mincha. Jewish activities: Torah and singing lessons every Sunday-Thursday at 16:00, Challah baking every Friday at 12:30, Chassidut lesson every Saturday at 09:30, farewell gathering after Shabbat approximately 400 minutes before end of Shabbat. WhatsApp contacts: +66 65 719 5466, +66 65 719 5467. Email: chabadpai@gmail.com. Business hours: 10:00-22:30 daily. Google Maps: https://maps.app.goo.gl/"
    }
)

$bulkHeaders = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $accessToken"
}

$uri = "$BackendUrl/admin/synagogues/bulk"
$jsonBody = ConvertTo-Json -InputObject $payload -Depth 10

Write-Host ""
Write-Host "Sending bulk import to $uri..."
Write-Host "Records: $($payload.Count) synagogue(s)"
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $uri -Method POST -Headers $bulkHeaders -Body $jsonBody
    Write-Host "Import successful" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host
} catch {
    Write-Host "Import failed" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host ""
    try {
        $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Error Details:" -ForegroundColor Red
        Write-Host ($errorDetails | ConvertTo-Json -Depth 10) -ForegroundColor Red
    } catch {
        Write-Host "Response: $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
}
