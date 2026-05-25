# Bangkok Synagogues Bulk Import PowerShell Script
# Imports synagogue records for destination 470
# Usage: .\import-bangkok-synagogues.ps1 -Email "admin@example.com" -Password "password"
#        or with defaults: .\import-bangkok-synagogues.ps1

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
        name = "Chabad House Bangkok"
        destinationId = 470
        address = "96 Ram Buttri Alley, Chana Songkhram, Phra Nakhon, Bangkok 10200, Thailand"
        phone = "+66 2 629 2770"
        website = "https://chabadthailand.co.il/houses/bangkok/"
        description = "Chabad House and synagogue in Bangkok offering daily prayers, Shabbat meals, holiday services and community support for Jewish travelers. Weekdays: Shacharit 09:00, Mincha around 15 minutes before sunset, Arvit 45 minutes after sunset. Shabbat: Shacharit 10:00, Seudah Shlishit and Havdalah approximately one hour after Mincha. WhatsApp: +66 81 924 4570."
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
