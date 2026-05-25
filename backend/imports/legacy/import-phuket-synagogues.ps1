# Phuket Synagogues Bulk Import PowerShell Script
# Imports synagogue records for destination 471
# Usage: .\import-phuket-synagogues.ps1 -Email "admin@example.com" -Password "password"
#        or with defaults: .\import-phuket-synagogues.ps1

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
        name = "Chabad House Phuket"
        destinationId = 471
        address = "9/6 Rat-U-Thit 200 Pee Road, Patong, Kathu, Phuket 83150, Thailand"
        phone = "+66 81 848 6680"
        website = "https://chabadthailand.co.il/houses/phuket/"
        latitude = 7.8991
        longitude = 98.2977
        description = "Chabad House and synagogue in Phuket serving Jewish travelers with daily prayers, Shabbat meals, kosher food, holiday services and community support. Contact: Phuket@JewishThailand.com. Weekdays: Shacharit 09:30, Mincha 18:00, Arvit 19:00. Shabbat: Shacharit 10:00, Mincha and Kabbalat Shabbat at candle lighting time, Seudah Shlishit and Havdalah after Mincha. Additional services include kosher restaurant, pizza shop, Shabbat meals and traveler assistance. WhatsApp: +66 81 848 6680."
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
