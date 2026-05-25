# Akko Synagogues Bulk Import PowerShell Script
# Automatically logs in and imports 75 synagogue records from akko_synagogues_full.json
# Usage: .\import-akko-synagogues.ps1 -Email "admin@example.com" -Password "password"
#        or with defaults: .\import-akko-synagogues.ps1

param(
    [string]$Email = "admin@example.com",
    [string]$Password = "password",
    [string]$BackendUrl = "http://localhost:3001",
    [string]$SourceJsonPath = "$env:USERPROFILE\Downloads\akko_synagogues_full.json"
)

# Step 1: Login to get JWT token
Write-Host "🔐 Logging in to get access token..." -ForegroundColor Cyan
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
        Write-Host "❌ Login failed: No access token in response" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Login successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Load JSON data from disk
if (-not (Test-Path $SourceJsonPath)) {
    Write-Host "❌ JSON file not found at: $SourceJsonPath" -ForegroundColor Red
    exit 1
}

Write-Host "📂 Loading JSON data from: $SourceJsonPath" -ForegroundColor Cyan
$akkoData = Get-Content $SourceJsonPath -Raw | ConvertFrom-Json

Write-Host "✅ Loaded $($akkoData.Count) synagogues from JSON" -ForegroundColor Green

# Step 3: Transform JSON data to match API format
$payload = @()
$skippedRows = 0

function Get-RowValue {
    param(
        $Row,
        [string]$FieldName
    )

    $property = $Row.PSObject.Properties[$FieldName]
    if ($null -eq $property -or $null -eq $property.Value) {
        return $null
    }

    return [string]$property.Value
}

foreach ($synagogue in $akkoData) {
    $name = Get-RowValue -Row $synagogue -FieldName 'שם בית כנסת'
    $address = Get-RowValue -Row $synagogue -FieldName 'כתובת בית הכנסת'
    if ($name) {
        $name = $name.Trim()
    }
    if ($address) {
        $address = $address.Trim()
    }

    if (-not $name -or -not $address) {
        $skippedRows++
        continue
    }

    $item = @{
        name = $name
        destinationId = 454  # AKKO destination ID
        address = $address
    }
    
    # Add optional fields if they exist and are not empty
    $phone = Get-RowValue -Row $synagogue -FieldName 'טלפון בית הכנסת'
    if ($phone) {
        $phone = $phone.Trim()
    }
    if ($phone) {
        $item.phone = $phone
    }
    
    # Add Gabai (sexton) info in description if available
    $descriptionParts = @()
    $gabai = Get-RowValue -Row $synagogue -FieldName 'שם הגבאי'
    if ($gabai) {
        $gabai = $gabai.Trim()
    }
    if ($gabai) {
        $descriptionParts += "Gabai: $gabai"
    }
    $gabaiPhone = Get-RowValue -Row $synagogue -FieldName 'טלפון גבאי'
    if ($gabaiPhone) {
        $gabaiPhone = $gabaiPhone.Trim()
    }
    if ($gabaiPhone) {
        $descriptionParts += "Gabai phone: $gabaiPhone"
    }
    
    if ($descriptionParts.Count -gt 0) {
        $item.description = $descriptionParts -join " | "
    }
    
    $payload += $item
}

# Step 4: Send bulk import request
$bulkHeaders = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $accessToken"
}

$uri = "$BackendUrl/admin/synagogues/bulk"
$jsonBody = $payload | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "📤 Sending bulk import to $uri..." -ForegroundColor Cyan
Write-Host "Records: $($payload.Count) synagogues from Akko" -ForegroundColor Cyan
if ($skippedRows -gt 0) {
    Write-Host "Skipped empty rows: $skippedRows" -ForegroundColor Yellow
}
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $uri -Method POST -Headers $bulkHeaders -Body $jsonBody
    Write-Host "✅ Import successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host
} catch {
    Write-Host "❌ Import failed!" -ForegroundColor Red
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
