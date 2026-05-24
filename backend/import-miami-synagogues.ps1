# Miami Synagogues Bulk Import PowerShell Script
# Automatically logs in and imports 16 synagogue records
# Usage: .\import-miami-synagogues.ps1 -Email "admin@example.com" -Password "password"
#        or with defaults: .\import-miami-synagogues.ps1

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

# Step 2: Import synagogues using the token

$payload = @(
    @{
        name = "Anshei Lubavitch"
        destinationId = 464
        address = "2049 North Bay Road, Miami Beach, FL 33140, USA"
        denomination = "Orthodox"
        phone = "+1 305-532-4160"
        description = "Orthodox synagogue located in Miami Beach led by Rabbi David Shapiro."
    },
    @{
        name = "Bais Menachem"
        destinationId = 464
        address = "444 W 40th Street, Miami Beach, FL 33140, USA"
        denomination = "Orthodox"
        phone = "+1 305-673-4444"
    },
    @{
        name = "Beth Israel Congregation"
        destinationId = 464
        address = "770 W 40th Street, Miami Beach, FL 33140, USA"
        denomination = "Orthodox"
        phone = "+1 305-538-1251"
        description = "Orthodox synagogue in Miami Beach led by Rabbi Neil Turk."
    },
    @{
        name = "Beth El North Miami Beach"
        destinationId = 464
        address = "2425 Pine Tree Drive, Miami Beach, FL 33140, USA"
        denomination = "Traditional"
    },
    @{
        name = "Congregation and Mikvah Adas Dej Magalei Zedek"
        destinationId = 464
        address = "225 37th Street, Miami, FL 33140, USA"
    },
    @{
        name = "Yeshiva Gedola"
        destinationId = 464
        address = "2040 Alton Road, Miami Beach, FL 33140-4563, USA"
        denomination = "Orthodox"
    },
    @{
        name = "Ahavat Olam"
        destinationId = 464
        address = "P.O. Box 160248, Miami, FL 33116-0248, USA"
        denomination = "Traditional"
    },
    @{
        name = "Bet Shira Congregation"
        destinationId = 464
        address = "7500 SW 120th Street, Pinecrest, FL 33156, USA"
        denomination = "Traditional"
    },
    @{
        name = "Beth Torah Benny Rok Campus"
        destinationId = 464
        address = "20350 NE 26th Avenue, Miami, FL 33180, USA"
        denomination = "Orthodox"
    },
    @{
        name = "Beth Moshe Congregation"
        destinationId = 464
        address = "2225 NE 121st Street, North Miami, FL 33181, USA"
        denomination = "Traditional"
    },
    @{
        name = "Beis Medrash Mekor Chochma at Temple Moses"
        destinationId = 464
        address = "1200 Normandy Drive, Miami Beach, FL 33141, USA"
        denomination = "Orthodox"
    },
    @{
        name = "Beis Hamedrash Levi Yitzchok"
        destinationId = 464
        address = "1140 Alton Road, Miami Beach, FL 33139, USA"
        denomination = "Orthodox"
    },
    @{
        name = "Beth David Congregation"
        destinationId = 464
        address = "2625 SW Third Avenue, Miami, FL 33129, USA"
        denomination = "Reform"
    },
    @{
        name = "Chabad in South Beach"
        destinationId = 464
        address = "320 Meridian Avenue, Miami Beach, FL 33139-8721, USA"
        description = "Provides Shabbat prayers, Friday night dinners, Cholent, Kiddush, holiday events, Torah classes and hosting for Jewish travelers and locals."
    },
    @{
        name = "Chabad of Venetian Causeway"
        destinationId = 464
        address = "14 Ferry Lane, Miami Beach, FL 33139, USA"
        description = "Offers synagogue services, Shabbat meals and Jewish women empowerment circles."
    },
    @{
        name = "Chabad of Miami Beach"
        destinationId = 464
        address = "320 Meridian Avenue, Miami Beach, FL 33139-8721, USA"
        description = "Provides regular prayers, candle lighting, Friday night meals and Shabbat meals for the Jewish community and visitors."
    }
)

$bulkHeaders = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $accessToken"
}

$uri = "$BackendUrl/admin/synagogues/bulk"
$jsonBody = $payload | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "📤 Sending bulk import to $uri..."
Write-Host "Records: $($payload.Count) synagogues"
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
