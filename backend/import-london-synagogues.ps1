# London Synagogues Bulk Import PowerShell Script
# Imports synagogue records for destination 333
# Usage: .\import-london-synagogues.ps1 -Email "admin@example.com" -Password "password"
#        or with defaults: .\import-london-synagogues.ps1

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
        name = "Chabad Israeli Centre London"
        destinationId = 333
        address = "1035 Finchley Road, London NW11 7ES, United Kingdom"
        phone = "+44 7925 857050"
        website = "https://www.instagram.com/chabad_israeli_centre_london/"
        latitude = 51.57983
        longitude = -0.19850
        description = "Chabad Israeli Centre London offers a welcoming place for Jewish travelers and the local Israeli/Jewish community.`n`nFriday:`nMincha and Kabbalat Shabbat take place approximately 10 minutes after candle lighting.`nKiddush is held after prayers.`n`nShabbat:`nShacharit begins at 10:00.`nTorah reading begins at 10:45.`nKiddush is held after prayers at approximately 11:50.`n`nChildren's Shabbat Program:`nA Jewish children's activity takes place on Shabbat between 11:00-12:00, including a weekly parasha story and Shabbat songs.`n`nWhatsApp:`n+44 7925 857050"
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
