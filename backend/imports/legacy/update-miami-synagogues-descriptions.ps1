# Miami Synagogues Description Update PowerShell Script
# Updates descriptions to include rabbi/leader information
# Usage: .\update-miami-synagogues-descriptions.ps1 -Email "admin@example.com" -Password "password"

param(
    [string]$Email = "admin@example.com",
    [string]$Password = "password",
    [string]$BackendUrl = "http://localhost:3001"
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

# Step 2: Fetch current synagogues for destination 464
Write-Host ""
Write-Host "📥 Fetching current synagogues for destination 464..." -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $accessToken"
}

try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/synagogues?destinationId=464" -Method GET -Headers $headers
    $currentSynagogues = $response.Content | ConvertFrom-Json
    Write-Host "✅ Found $($currentSynagogues.Count) synagogues" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to fetch synagogues!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Create update payload with rabbi information
Write-Host ""
Write-Host "📝 Preparing description updates..." -ForegroundColor Cyan

$rabbisMap = @{
    "Anshei Lubavitch" = "Rabbi David Shapiro"
    "Beth Israel Congregation" = "Rabbi Neil Turk"
    "Beth El North Miami Beach" = "Rabbi Alexander Hoss"
    "Yeshiva Gedola" = "Rabbi Leib Shapiro"
    "Ahavat Olam" = "Rabbi Danny Marmorstein"
    "Bet Shira Congregation" = "Rabbi Ben Herman"
    "Beth Torah Benny Rok Campus" = "Rabbi Mario Rojzman; Rabbi Ed Farber Emeritus"
    "Beth Moshe Congregation" = "Rabbi Jory Lang"
    "Beis Medrash Mekor Chochma at Temple Moses" = "Rabbi Reuven Glucksman"
    "Beis Hamedrash Levi Yitzchok" = "Rabbi Avraham Korf"
    "Beth David Congregation" = "Rabbi Julie Jacobs"
}

$updatePayload = @()
$updateCount = 0

foreach ($synagogue in $currentSynagogues) {
    $rabbi = $rabbisMap[$synagogue.name]
    
    # Skip if no rabbi is provided for this synagogue
    if ([string]::IsNullOrEmpty($rabbi)) {
        Write-Host "  ⏭️  $($synagogue.name) - no rabbi provided, skipping" -ForegroundColor Gray
        continue
    }
    
    # Get current description
    $currentDesc = $synagogue.description -as [string]
    $newDesc = ""
    
    if ([string]::IsNullOrWhiteSpace($currentDesc)) {
        # No description yet - create one with denomination + location + rabbi
        $denomination = $synagogue.denomination -as [string]
        
        # Extract city from address (usually last part before FL/USA)
        $addressParts = $synagogue.address -split ","
        $location = "Miami Beach"
        if ($addressParts.Count -gt 1) {
            $cityPart = $addressParts[-2].Trim()
            if ($cityPart -notmatch "FL|FL\s+\d+") {
                $location = $cityPart
            }
        }
        
        # Create description: capitalize denomination and add location + rabbi
        if ([string]::IsNullOrWhiteSpace($denomination)) {
            $newDesc = "Synagogue in $location led by $rabbi."
        } else {
            $capitalized = ([char]::ToUpper($denomination[0]) + $denomination.Substring(1).ToLower())
            $newDesc = "$capitalized synagogue in $location led by $rabbi."
        }
    } else {
        # Description already exists - append rabbi info if not already mentioned
        if ($currentDesc -notmatch [regex]::Escape($rabbi)) {
            $newDesc = "$currentDesc Led by $rabbi."
        } else {
            $newDesc = $currentDesc
            Write-Host "  ℹ️  $($synagogue.name) - rabbi already in description, no change" -ForegroundColor Gray
            continue
        }
    }
    
    # Build update record
    $updateRecord = @{
        name = $synagogue.name
        destinationId = 464
        address = $synagogue.address
        description = $newDesc
    }
    
    # Include optional fields if they exist
    if (-not [string]::IsNullOrWhiteSpace($synagogue.phone)) {
        $updateRecord.phone = $synagogue.phone
    }
    if (-not [string]::IsNullOrWhiteSpace($synagogue.website)) {
        $updateRecord.website = $synagogue.website
    }
    if (-not [string]::IsNullOrWhiteSpace($synagogue.denomination)) {
        $updateRecord.denomination = $synagogue.denomination
    }
    if ($synagogue.latitude) {
        $updateRecord.latitude = $synagogue.latitude
    }
    if ($synagogue.longitude) {
        $updateRecord.longitude = $synagogue.longitude
    }
    
    $updatePayload += $updateRecord
    $updateCount++
    
    Write-Host "  ✓ $($synagogue.name)" -ForegroundColor Green
    Write-Host "    New: $newDesc" -ForegroundColor Gray
}

Write-Host ""
if ($updateCount -eq 0) {
    Write-Host "ℹ️  No updates to apply" -ForegroundColor Yellow
    exit 0
}

Write-Host "📤 Sending $updateCount updates..." -ForegroundColor Cyan

# Step 4: Send updates via bulk import endpoint
$bulkHeaders = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $accessToken"
}

$uri = "$BackendUrl/admin/synagogues/bulk"
$jsonBody = $updatePayload | ConvertTo-Json -Depth 10

try {
    $response = Invoke-WebRequest -Uri $uri -Method POST -Headers $bulkHeaders -Body $jsonBody
    $result = $response.Content | ConvertFrom-Json
    
    Write-Host ""
    Write-Host "✅ Updates successful!" -ForegroundColor Green
    Write-Host "  Created: $($result.created)" -ForegroundColor Green
    Write-Host "  Updated: $($result.updated)" -ForegroundColor Green
    Write-Host "  Skipped: $($result.skipped)" -ForegroundColor Yellow
    Write-Host "  Errors: $($result.errors)" -ForegroundColor $(if ($result.errors -gt 0) { 'Red' } else { 'Green' })
    
    if ($result.errors -gt 0) {
        Write-Host ""
        Write-Host "Error details:" -ForegroundColor Red
        $result.results | Where-Object { $_.action -eq 'error' } | ForEach-Object {
            Write-Host "  ❌ $($_.name): $($_.error)" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "❌ Update failed!" -ForegroundColor Red
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
