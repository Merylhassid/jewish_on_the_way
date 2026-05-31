# Beit She'an Synagogues Bulk Import – Destination 382
# Usage: .\import-beit-shean-synagogues.ps1 -Email "admin@example.com" -Password "yourpass"

param(
    [string]$Email      = "admin@example.com",
    [string]$Password   = "password",
    [string]$BackendUrl = "http://localhost:3001"
)

function Add-City($addr) {
    if (-not $addr -or $addr -eq "" -or $addr -eq "אין כתובת") { return $null }
    if ($addr -like "*בית שאן*") { return $addr }
    return "$addr, בית שאן"
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
    @{ name="חסד לרחמים";                       destinationId=382; address=(Add-City "מקס נורדאו 13, בית שאן");          phone="052-7611795"; description="גבאי: ר' דוד ישראלי" }
    @{ name="מאיר לישראל";                       destinationId=382; address=(Add-City "אביר יעקב 12, בית שאן");           phone="052-7103381"; description="גבאי: שלום רפאלי" }
    @{ name="בני מנשה";                          destinationId=382; address=(Add-City "יעקב מכלוף 39, בית שאן");          phone="054-8485960"; description="גבאי: ר' מרדכי ישראלי" }
    @{ name="יפרח כשושנה";                       destinationId=382; address=(Add-City "איריס 15, בית שאן");               phone="052-9461982"; description="גבאי: רחמים גרשום" }
    @{ name="אור התורה";                         destinationId=382; address=(Add-City "הרב דוד סויסה 8, בית שאן");        phone="050-9533206"; description="גבאי: יהונתן אסולין" }
    @{ name="בית רבנו ברסלב";                    destinationId=382; address=(Add-City "יוסף ברנר 13, בית שאן");           phone="050-4169160"; description="גבאי: חביב אדרי / שלומי אדרי" }
    @{ name="אהבת ה'";                           destinationId=382; address=(Add-City "יצחק הרצוג 580, בית שאן");         phone="052-8381215"; description="גבאי: יוסי ארמה" }
    @{ name="בית מדרש דרכי אליהו";               destinationId=382; address=(Add-City "משה דיין 41, בית שאן");             phone="052-2841183"; description="גבאי: רמי אליאס" }
    @{ name="אם הבנים";                          destinationId=382; address=(Add-City "הלורד בלפור 13, בית שאן");          phone="050-9876206"; description="גבאי: ויקטור כהן זדה" }
    @{ name="הללויה";                            destinationId=382; address=(Add-City "אברהם אבן שושן 89, בית שאן");       phone="050-5551350"; description="גבאי: ירון בניסטי" }
    @{ name="זכור לאברהם קריית רבין";            destinationId=382; address=(Add-City "הרב מרדכי אליהו 2, בית שאן");      phone="050-7213811"; description="גבאי: ירון בן ברוך" }
    @{ name="תפארת שלמה";                        destinationId=382; address=(Add-City "מיזוג גלויות 2, בית שאן");          description="גבאי: יואל בן חמו" }
    @{ name="תפארת ישראל לעולי תימן";            destinationId=382; address=(Add-City "יעקב מרכוס 34, בית שאן");           phone="050-5296388"; description="גבאי: חיים חיים" }
    @{ name="תלמידי חכמים (תחכמוני)";            destinationId=382; address=(Add-City "התומר 257, בית שאן");               phone="054-6765860"; description="גבאי: דוד שבתאי" }
    @{ name="תורת משה ומכלוף";                   destinationId=382; address=(Add-City "ירושלים הבירה 1, בית שאן");         phone="054-3346814"; description="גבאי: אליהו בן שמחון" }
    @{ name="תורה וחיים";                        destinationId=382; address=(Add-City "ירושלים הבירה 39, בית שאן");        phone="052-7676894"; description="גבאי: משה טנג'י" }
    @{ name="שערי ישראל אמת וצדק";               destinationId=382; address=(Add-City "אלעזר בן לולו 9, בית שאן");         phone="054-2363710"; description="גבאי: יעקב אסגלי" }
    @{ name="תהילות זכריה";                      destinationId=382; address=(Add-City "עדולם 5, בית שאן");                 phone="052-4164500"; description="גבאי: דוד דוידי" }
    @{ name="שער השמיים";                        destinationId=382; address=(Add-City "שטורמן 2, בית שאן");                phone="050-4113184"; description="גבאי: יוסי לוי" }
    @{ name="שער הרחמים";                        destinationId=382; address=(Add-City "מקס נורדאו 2, בית שאן");            phone="050-6519286"; description="גבאי: נחום דניאל" }
    @{ name="שאול המלך";                         destinationId=382; address=(Add-City "הרב יצחק הרצוג 385, בית שאן");     phone="050-7404773"; description="גבאי: שלמה מלכה" }
    @{ name="שבט אחים גם יחד";                   destinationId=382; address=(Add-City "שדרות מנחם בגין 2, בית שאן");       phone="050-8657082"; description="גבאי: קראן אנדלו" }
    @{ name='רשב"י';                             destinationId=382; address=(Add-City "יעקב מכלוף 251, בית שאן");          phone="054-6060197"; description="גבאי: שמעון לוי" }
    @{ name='רמב"ם';                             destinationId=382; address=(Add-City 'רמב"ם 1, בית שאן');                 phone="054-6746028"; description="גבאי: בבר אביטן" }
    @{ name="רב פעלים";                          destinationId=382; address=(Add-City "הרב יצחק הרצוג 14, בית שאן");      phone="052-7642871"; description="גבאי: משה בוזגלו" }
    @{ name="ר' יעקוב חזוט";                     destinationId=382; address=(Add-City "לורד בלפור 3, בית שאן");            phone="054-3251414"; description="גבאי: מאיר רוימי" }
    @{ name="מקור ברוך";                         destinationId=382; address=(Add-City 'רמב"ם 62, בית שאן');                phone="052-8249154"; description="גבאי: מאיר" }
    @{ name="קהילת יעקב";                        destinationId=382; address=(Add-City "הלורד בלפור 13, בית שאן");          phone="050-9800051"; description="גבאי: אשר גוזלן" }
    @{ name="ר' דוד בן ברוך";                    destinationId=382; address=(Add-City "דוד רמז פינת שאול המלך 15, בית שאן");            description="גבאי: אליהו שטרית" }
    @{ name="מזרחי שמואל";                       destinationId=382; address=(Add-City "יעקב מכלוף 253, בית שאן");          phone="050-9631112"; description="גבאי: אוחנה דוד / יצחק בן חיים" }
    @{ name="מפתן צעירים – היכל אברהם";          destinationId=382; address=(Add-City "הרב יצחק הכהן קוק 2, בית שאן");    phone="054-4864805"; description="גבאי: מאיר תורג'מן" }
    @{ name="מגן אברהם";                         destinationId=382; address=(Add-City "יעקב מרכוס 21, בית שאן");           phone="050-6519221"; description="גבאי: רפי אור" }
    @{ name="ישמח ישראל";                        destinationId=382; address=(Add-City "שאול המלך 64, בית שאן");             phone="052-3136396"; description="גבאי: שייקה כהן" }
    @{ name="ישמח יהודה בשערי צדק";              destinationId=382; address=(Add-City "משה דיין 38, בית שאן");              phone="052-2841183"; description="גבאי: שימחי ברוך / רמי אליאס" }
    @{ name="ישורון";                            destinationId=382; address=(Add-City "הלורד בלפור 23, בית שאן");           description="גבאי: עמרני / פרג'י" }
    @{ name="יוסף מאיר";                         destinationId=382; address=(Add-City "הרב יעקב משה טולדאנו 35, בית שאן"); phone="050-9117117"; description="גבאי: גבריאל צדק / אורי כהן צמח" }
    @{ name="יד יצחק וניסים";                    destinationId=382; address=(Add-City "ירושלים הבירה 46, בית שאן");         phone="050-4734953"; description="גבאי: מאיר דנינו" }
    @{ name="יגל יעקב";                          destinationId=382; address=(Add-City "מקס נורדאו 2, בית שאן");             phone="054-7651563"; description="גבאי: שמואל נאנמני / משה כהן" }
    @{ name="חסד לאברהם";                        destinationId=382; address=(Add-City "שכונת אליהו 91, בית שאן");             phone="050-8334270"; description="גבאי: אשר לסרי" }
    @{ name="חנוך לנוער";                        destinationId=382; address=(Add-City "התומר 29, בית שאן");                 phone="054-8573647"; description="גבאי: הרב פנחס בדוס / שי רחמים" }
    @{ name="חיים ויצחק (ברית יצחק)";            destinationId=382; address=(Add-City "התומר 15, בית שאן");                 phone="055-6866022"; description="גבאי: נעים דוד / סימנה מרדכי" }
    @{ name="חידושי משה שערי דניאל";             destinationId=382; address=(Add-City "עלייה 14, בית שאן");                 phone="052-2977279"; description="גבאי: יעקב מוסאי" }
    @{ name="זכור לאברהם";                        destinationId=382; address=(Add-City "שכונת אליהו 91, בית שאן");                          description="גבאי: רחמים מוסאי" }
    @{ name="היכל שלמה";                         destinationId=382; address=(Add-City "יעקב מכלוף 82, בית שאן");            phone="050-4101806"; description="גבאי: ניסים עזרא" }
    @{ name="הישיבה הגבוהה הסדר";               destinationId=382;                                                          phone="050-6210775"; description="גבאי: הרב שלמה שושן" }
    @{ name="היכל הארבעה";                       destinationId=382; address=(Add-City "יוסף ברנר 7, בית שאן");              phone="050-8372539"; description="גבאי: דוד תורג'מן" }
    @{ name="הדרת יוסף";                         destinationId=382; address=(Add-City "אחד העם 4, בית שאן");                phone="050-5307210"; description="גבאי: שמעון הגר" }
    @{ name="ג'ריבה ג'רבה";                      destinationId=382; address=(Add-City "התומר 11, בית שאן");                 phone="052-4217313"; description="גבאי: חיון ז'ק" }
    @{ name="גולני";                             destinationId=382; address=(Add-City "ירושלים הבירה 50, בית שאן");         description="גבאי: דניאל סויסה" }
    @{ name="בנה ביתך כבתחילה";                  destinationId=382; address=(Add-City "רותם 11, בית שאן");                  phone="054-5744645"; description="גבאי: חיים בטיטו" }
    @{ name="בני עקיבא";                         destinationId=382; address=(Add-City "הרצל 22, בית שאן");                  phone="052-6227244"; description="גבאי: מאיר בן ברוך" }
    @{ name="בית מדרש זוהר בתורה";               destinationId=382; address=(Add-City "הלורד בלפור 8, בית שאן");            phone="055-6682026"; description="גבאי: מאיר אסרף" }
    @{ name="בית יעקב ויצחק";                    destinationId=382; address=(Add-City "שכונת אליהו 91, בית שאן");             phone="053-3195354"; description="גבאי: אברהם אלחרר" }
    @{ name="בית יצחק";                          destinationId=382; address=(Add-City "התומר 27, בית שאן");                 phone="04-6585330";  description="גבאי: ר' שמעון אלבז" }
    @{ name="בית יעקב";                          destinationId=382; address=(Add-City "חומה ומגדל 16, בית שאן");             phone="055-9283140"; description="גבאי: יעקב נחמני" }
    @{ name='בית חב"ד';                          destinationId=382; address=(Add-City "רח' השישה, בית שאן");                phone="054-6699965"; description="גבאי: הרב שמואל רייניץ" }
    @{ name="בית אל";                            destinationId=382; address=(Add-City "התומר 13, בית שאן");                 phone="054-5871904"; description="גבאי: מאיר אוחיון" }
    @{ name="אמת ליעקב חסד לאברהם";              destinationId=382; address=(Add-City "אביר יעקב 1, בית שאן");              phone="052-7130501"; description="גבאי: אברהם אסולין" }
    @{ name="אשכנזי מרכזי";                      destinationId=382; address=(Add-City "אנדרה ללוש 4, בית שאן");             description="גבאי: שלום דוידוביץ" }
    @{ name="אלי כהן";                           destinationId=382; address=(Add-City "חומה ומגדל 5, בית שאן");             phone="054-6150767"; description="גבאי: אברהם זגורי" }
    @{ name="אור שמעון";                         destinationId=382; address=(Add-City "רחוב ירושלים, בית שאן");              phone="050-4400638"; description="גבאי: יהודה אמסלם" }
    @{ name="אור החיים מיכאל וגבריאל";           destinationId=382; address=(Add-City "שאול המלך 9, בית שאן");              phone="050-9620928"; description="גבאי: יצחק אבוטבול" }
    @{ name='אור אלעד ע"ש אלעד בצון';            destinationId=382; address=(Add-City "רותם 8, בית שאן");                   phone="053-2708728"; description="גבאי: רפאל רוימי" }
    @{ name="אוהל שלמה";                         destinationId=382; address=(Add-City "שאול המלך 4, בית שאן");              phone="054-2282847"; description="גבאי: דוד בן שבת" }
    @{ name="אוהל מועד";                         destinationId=382; address=(Add-City "התומר 5, בית שאן");                  phone="050-2807764"; description="גבאי: מכלוף בן חיים" }
    @{ name="אוהל ישראל";                        destinationId=382; address=(Add-City "שאול המלך 61, בית שאן");             phone="050-5239503"; description="גבאי: שלמה ישראלי" }
    @{ name="אוהל יצחק";                         destinationId=382; address=(Add-City "ירושלים הבירה 594, בית שאן");        phone="050-6519257"; description="גבאי: יצחק דהן" }
    @{ name="אוהל יעקב וחי-מגן משיח";            destinationId=382; address=(Add-City "התומר 17א, בית שאן");                phone="050-6369714"; description="גבאי: שרון איובי" }
    @{ name="אוהל יוסף";                         destinationId=382; address=(Add-City "יוסף ברנר 11, בית שאן");             phone="054-5871504"; description="גבאי: מקסים אדרי" }
    @{ name="אהבת שלום";                         destinationId=382; address=(Add-City "התומר 17, בית שאן");                 phone="054-8000179"; description="גבאי: ראובן בנג'ו" }
    @{ name="אהבת ישראל";                        destinationId=382; address=(Add-City "אהבת ישראל 4, בית שאן");             phone="058-3249030"; description="גבאי: דודו אבו" }
    @{ name="אהבת חסד דרכי יהושע";               destinationId=382; address=(Add-City "הלורד בלפור 26, בית שאן");           phone="050-9444782"; description="גבאי: אלי סבג" }
    @{ name="אבנר מלול";                         destinationId=382; address=(Add-City "ירושלים הבירה 39, בית שאן");         phone="04-6585419";  description="גבאי: אברהם עמור / מאיר אלמליח" }
)

# ── Send ───────────────────────────────────────────────────────────────────────
$headers   = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $token" }
$total     = $payload.Count
$batchSize = 50
$sent = 0; $errors = 0; $batchNum = 0

Write-Host ""
Write-Host "Sending $total synagogues to destination 382 (בית שאן)..." -ForegroundColor Cyan

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
