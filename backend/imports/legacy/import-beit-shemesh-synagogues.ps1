# Beit Shemesh Synagogues Bulk Import – Destination 374
# Usage: .\import-beit-shemesh-synagogues.ps1 -Email "admin@example.com" -Password "yourpass"

param(
    [string]$Email      = "admin@example.com",
    [string]$Password   = "password",
    [string]$BackendUrl = "http://localhost:3001"
)

function Add-City($addr) {
    if (-not $addr -or $addr -eq "") { return $null }
    if ($addr -like "*בית שמש*") { return $addr }
    return "$addr, בית שמש"
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
    @{ name="אור מאיר"; destinationId=374; address=(Add-City "נחל לכיש 4"); phone="054-3201231"; denomination="ספרדי"; description="גבאי: משה סיסו" }
    @{ name="אהבה ואחווה"; destinationId=374; address=(Add-City "יהודה המכבי 17"); phone="052-6367806"; denomination="ספרדי"; description="גבאי: מורן חן" }
    @{ name="אב הרחמים"; destinationId=374; address=(Add-City "רבי טרפון 4 רמת בית שמש"); phone="054-8410251"; denomination="ירושלמי ספרדי"; description="גבאי: משה גוזלן" }
    @{ name="אהבת חינם"; destinationId=374; address=(Add-City "שביל האשל 17"); phone="052-3944789"; denomination="ספרדי"; description="גבאי: יוסף" }
    @{ name="אהבת ציון"; destinationId=374; address=(Add-City "רועי קליין 17"); phone="050-5363911"; denomination="ספרדי ירושלמי"; description="גבאי: אליהו אבישיד" }
    @{ name="אהבת תורה"; destinationId=374; address=(Add-City "רב חלקייה בר טובי 1"); phone="058-3226388"; denomination="ספרדי"; description="גבאי: דניאל עמיאל" }
    @{ name="אוהל אברהם ושרה"; destinationId=374; address=(Add-City "נהרדעא 2"); phone="052-7195155"; denomination="ירושלמי"; description="גבאי: שחר שמש" }
    @{ name="אוהל מרדכי ושרה"; destinationId=374; address=(Add-City "נחל אוריה 14"); phone="050-2223137"; denomination="ספרדי"; description="גבאי: משה ניסני" }
    @{ name="אוהל עפרה"; destinationId=374; address=(Add-City "שד' בן זאב 6"); phone="050-4206996"; denomination="ספרדי"; description="גבאי: פנחס מזוז" }
    @{ name="אוהל תורה"; destinationId=374; address=(Add-City "קליין 1 רמה ה'"); phone="055-6707703"; denomination="ירושלמי"; description="גבאי: יצחק עטיה" }
    @{ name="אוהלי יוסף"; destinationId=374; address=(Add-City "אחיה השילוני 10"); phone="054-8445280"; denomination="ספרדי"; description="גבאי: מיכאל בן עמרם" }
    @{ name="אור החיים הקדוש"; destinationId=374; address=(Add-City "מנחם בגין 1"); phone="052-3663718"; denomination="ספרדי"; description="גבאי: אבנר צרפתי" }
    @{ name="אור החיים הקדוש גדרה"; destinationId=374; address=(Add-City "הרצוג 1"); phone="054-6924750"; denomination="ספרדי"; description="גבאי: מיכאל מרקו יפרח" }
    @{ name="אור ישראל"; destinationId=374; address=(Add-City "אברהם שפירא"); phone="052-6991655"; denomination="ספרד"; description="גבאי: דוד וינר" }
    @{ name="אור ליהודה"; destinationId=374; address=(Add-City "מנחם פרוש 10"); phone="052-7137644"; denomination="ספרדי"; description="גבאי: אליאל האוזי" }
    @{ name="אור ליהודים"; destinationId=374; address=(Add-City "נהרדעא 7"); phone="050-3449339"; denomination="חסידי"; description="גבאי: מרדכי ליזרוביץ" }
    @{ name="אור מרים"; destinationId=374; address=(Add-City "חגי 5"); phone="058-6605571"; denomination="ספרדי"; description="גבאי: מאיר לומברוזו" }
    @{ name="אור נגה"; destinationId=374; address=(Add-City "בר אילן 19"); phone="052-2265628"; denomination="אתיופים"; description="גבאי: ראובן הדנה" }
    @{ name="איילה תמימה"; destinationId=374; address=(Add-City "פינת דולב 10"); phone="050-4119721"; denomination="ירושלמי"; description="גבאי: משה ביטן" }
    @{ name="אילת השחר ג' 2"; destinationId=374; address=(Add-City "דבורה הנביאה 23"); phone="052-7118796"; denomination="אשכנז"; description="גבאי: יוסי דרמר" }
    @{ name="אשל אברהם"; destinationId=374; address=(Add-City "נחל שורק 16"); phone="054-2658686"; denomination="מרוקאי"; description="גבאי: אברהם מוגרבי" }
    @{ name="ביאלא - רמה ב'"; destinationId=374; address=(Add-City "מחזיקי הדת 7"); phone="050-8845268"; denomination="ספרד"; description="גבאי: מרדכי חנא צוקרמן" }
    @{ name="בית אביגדור משה"; destinationId=374; address=(Add-City "בן איש חי 10"); phone="052-7170821"; denomination="ספרד"; description="גבאי: מאיר פלוטקא יעקב קוהן" }
    @{ name="בית אהרון"; destinationId=374; address=(Add-City "רבי טרפון 2"); phone="052-7169556"; denomination="ספרדי ירושלמי"; description="גבאי: הרב משה אלחדד" }
    @{ name="בית אסתר"; destinationId=374; address=(Add-City "הנורית"); phone="052-8629456"; denomination="ספרדי"; description="גבאי: בן עדי סמי" }
    @{ name="בית בנימין וחנה"; destinationId=374; address=(Add-City "אילפה 1"); phone="050-4300283"; denomination="עדות המזרח"; description="גבאי: מאיר אברהם סיסרו" }
    @{ name="בית הכנסת המרכזי משקפיים"; destinationId=374; address=(Add-City "הרב מרדכי אליהו 8"); phone="054-439222"; denomination="אשכנז"; description="גבאי: מאיר הלר" }
    @{ name="בית הכנסת ובית המדרש מקבציאל"; destinationId=374; address=(Add-City "המעפילים 1"); phone="054-7778804"; denomination="ספרדי"; description="גבאי: ניר יצחק" }
    @{ name="בית הכנסת ויז'ניץ"; destinationId=374; address=(Add-City "קדושת אהרן 16"); phone="053-4124850"; denomination="ספרד"; description="גבאי: גדליה דוד וינברגר" }
    @{ name="בית חב''ד שכונת המשקפיים"; destinationId=374; address=(Add-City "הרב אברהם שפירא 2"); phone="058-7704541"; denomination="חב''ד"; description="גבאי: הרב עמוס הלוי עזיזוף" }
    @{ name="בית חיה פרל - קרליבך"; destinationId=374; address=(Add-City "זלמן איירבך 52"); phone="053-7220307"; denomination="ספרד"; description="גבאי: יצחק דרזנר" }
    @{ name="בית כנסת חבד רמה ב"; destinationId=374; address=(Add-City "רבי מאיר בעל הנס 8"); phone="054-4991889"; denomination="חבד"; description="גבאי: יניב כהן" }
    @{ name="בית כנסת מגן אברהם"; destinationId=374; address=(Add-City "בן איש חי"); phone="050-4109302"; denomination="עדות המזרח"; description="גבאי: משה כהן" }
    @{ name="בית מנחם"; destinationId=374; address=(Add-City "הרקפת 8"); phone="054-4662251"; denomination="חב''ד"; description="גבאי: יענקי קליין" }
    @{ name="בית מרדכי יוסף"; destinationId=374; address=(Add-City "עובדיה הנביא 15"); phone="052-7144455"; denomination="ספרד"; description="גבאי: בן ציון וינטרוב" }
    @{ name="בית מרדכי"; destinationId=374; address=(Add-City "בן אליעזר 10"); phone="054-8453081"; denomination="אשכנז"; description="גבאי: הרב יוסף גולדשטיין" }
    @{ name="בית מרן ומוהר''ן"; destinationId=374; address=(Add-City "הגפן 20"); phone="052-7163153"; denomination="ספרדי"; description="גבאי: יצחק יצחקוב" }
    @{ name="בית משה דוד - כלל חסידי"; destinationId=374; address=(Add-City "ירמיהו"); phone="058-5556689"; denomination="ספרד"; description="גבאי: דוד קורשון" }
    @{ name="בני מלכים"; destinationId=374; address=(Add-City "רבג 3"); phone="052-7122291"; denomination="ספרד"; description="גבאי: הרב זוהר" }
    @{ name="בני עקיבא"; destinationId=374; address=(Add-City "בני דן"); phone="052-9436947"; denomination="מרוקאי ספרדי"; description="גבאי: מיקי אדרי" }
    @{ name="בני תורה תימן"; destinationId=374; address=(Add-City "מר עוקבא 6"); phone="050-8218200"; denomination="תימן"; description="גבאי: אלחנן ושדי" }
    @{ name="בריכת ראובן על שם רבי דוד ומשה"; destinationId=374; address=(Add-City "בן עזאי 10"); phone="050-4393163"; denomination="ספרדי"; description="גבאי: מנחם מלכי" }
    @{ name="דושינסקיא"; destinationId=374; address=(Add-City "אביי 4"); phone="054-8410782"; denomination="חסידי"; description="גבאי: יוסף אליהו אבלס" }
    @{ name="דרכי יצחק"; destinationId=374; address=(Add-City "ירמיהו הנביא 24"); phone="054-9499896"; denomination="אשכנז"; description="גבאי: ישראל חולבה" }
    @{ name="דרכי תורה"; destinationId=374; address=(Add-City "נחל עין גדי 37"); phone="052-2269050"; denomination="עדות המזרח"; description="גבאי: מולא משה" }
    @{ name="הבבא סאלי'"; destinationId=374; denomination="עדות המזרח"; description="גבאי: דרעי אברהם"; phone="050-2997209" }
    @{ name="הזוהר"; destinationId=374; address=(Add-City "הגפן 1"); phone="053-7589062"; denomination="ספרדי"; description="גבאי: טוביאנה יצחק" }
    @{ name="היכל אברהם"; destinationId=374; address=(Add-City "אלישע הנביא 17"); phone="054-4588520"; denomination="ספרדי"; description="גבאי: משה לוי" }
    @{ name="היכל אליהו"; destinationId=374; address=(Add-City "נחל מטע 6"); phone="052-7505600"; denomination="ירושלמי"; description="גבאי: מכלוף כהן" }
    @{ name="היכל אשר ומשה"; destinationId=374; address=(Add-City "שדרות האמוראים 54"); phone="053-2412213"; denomination="עדות המזרח"; description="גבאי: יצחק לוי" }
    @{ name="היכל התורה"; destinationId=374; address=(Add-City "המשלט"); phone="052-8345362"; denomination="מרוקאי"; description="גבאי: הרב אליהו קקון" }
    @{ name="היכל התורה - חזון עובדיה"; destinationId=374; address=(Add-City "בעל הסולם 1"); phone="054-8423384"; denomination="ספרדי - עדות המזרח"; description="גבאי: אברהם חיים דוד" }
    @{ name="היכל יחיאל"; destinationId=374; address=(Add-City "בין קיסמא 22"); phone="050-8423653"; denomination="ספרד"; description="גבאי: בנימין חיים" }
    @{ name="המרכז לתורה תפילה וחסד ממזרח שמש"; destinationId=374; address=(Add-City "שפת אמת 5 שכונת בית ומנוחה"); phone="052-7304050"; denomination="עדות המזרח - ירושלמי"; description="גבאי: הרב דניאל יוסף / הרב אפריים שמש ומשה אבוטבול" }
    @{ name="המרכזי"; destinationId=374; address=(Add-City "יונה בן אמיתי 6"); phone="050-4293889"; denomination="אשכנז"; description="גבאי: אבי ארנטרוי" }
    @{ name="המרכזי רמה ד'"; destinationId=374; address=(Add-City "מר עוקבא 6"); phone="053-3145031"; denomination="אשכנז"; description="גבאי: יחיאל בלוי" }
    @{ name="הנקודה"; destinationId=374; address=(Add-City "הרצל 5"); phone="050-5063771"; denomination="מרוקאי"; description="גבאי: יעקב אדרי" }
    @{ name="הספרדי שכונת המשקפיים"; destinationId=374; address=(Add-City "הרב מרדכי אליהו 5"); phone="052-3775535"; denomination="ספרדי"; description="גבאי: ינון ללום" }
    @{ name="ואתחנן משה"; destinationId=374; address=(Add-City "בן עזאי 22"); phone="055-6729567"; denomination="עדות המזרח"; description="גבאי: משה כהן" }
    @{ name="וילנא"; destinationId=374; address=(Add-City "רבי ברכיה 3"); phone="050-4174324"; denomination="אשכנז"; description="גבאי: אשר גרוסמן" }
    @{ name="ויזרע יצחק"; destinationId=374; address=(Add-City "המשלט 10 בית שמש"); phone="053-3116005"; denomination="ספרדי"; description="גבאי: איצ'קייב אברהם" }
    @{ name="זכור לאברהם"; destinationId=374; address=(Add-City "שפת אמת 1"); phone="052-7149307"; denomination="ספרדי"; description="גבאי: משה דהן" }
    @{ name="זכות אבות"; destinationId=374; address=(Add-City "נחל שורק 25 רמה א"); phone="050-4111744"; denomination="ספרדי ירושלמי"; description="גבאי: ערן יעקבי" }
    @{ name="זכרון שמעון ומשה"; destinationId=374; address=(Add-City "האמוראים 56"); phone="058-5213493"; denomination="מרוקאי"; description="גבאי: דן אבוזרט" }
    @{ name="חגי הנביא"; destinationId=374; address=(Add-City "חגי הנביא 3"); phone="054-2189508"; denomination="ספרדי"; description="גבאי: ישראל הרוש" }
    @{ name="חניכי הישיבות"; destinationId=374; address=(Add-City "המשלט 10"); phone="053-33139191"; denomination="אשכנז"; description="גבאי: מאיר כהן" }
    @{ name="חניכי הישיבות ד1"; destinationId=374; address=(Add-City "רב עולא 15"); phone="052-7169945"; denomination="עדות מזרח"; description="גבאי: יוסף חיים דניאלי" }
    @{ name="חניכי הישיבות קריה"; destinationId=374; address=(Add-City "אור שמח 13 בית שמש"); phone="052-7178593"; denomination="ספרדי"; description="גבאי: אליהו אלחרר - יוסף יפרח" }
    @{ name="חניכי הישיבות רמת אברהם"; destinationId=374; address=(Add-City "הרב יעקב אדלשטיין 24 בית שמש"); phone="052-7176084"; denomination="אשכנז"; description="גבאי: אברהם לורנס" }
    @{ name="חסד לשאול"; destinationId=374; address=(Add-City "נחל שורק 25"); phone="053-2515014"; denomination="ספרדי"; description="גבאי: משה הראל" }
    @{ name="טשאקווא"; destinationId=374; address=(Add-City "אדלשטיין 26"); phone="052-7653845"; denomination="ספרד"; description="גבאי: יוחנן דינקל" }
    @{ name="יד דוד ואוהל רחל"; destinationId=374; address=(Add-City "מעפילים 57/1 בית שמש"); phone="052-7625913"; denomination="ספרדי"; description="גבאי: דוד שיטרית" }
    @{ name="יד לשלמה"; destinationId=374; address=(Add-City "רבי יצחק נפחא 3"); phone="055-280555"; denomination="אשכנז"; description="גבאי: שאול דוידוביץ" }
    @{ name="יוסף חיים"; destinationId=374; address=(Add-City "שערי העיר"); phone="054-5229743"; denomination="ספרדי"; description="גבאי: פנחס אוחנה" }
    @{ name="ישמח אברהם ותגל טובה"; destinationId=374; address=(Add-City "שדרות הדקל 12"); phone="050-8783325"; denomination="ספרדי"; description="גבאי: מאיר קרבלו" }
    @{ name="לב אליהו"; destinationId=374; address=(Add-City "נחל שורק 29"); phone="052-7613141"; denomination="אשכנז"; description="גבאי: יהודה שמואלי" }
    @{ name="לב שמואל"; destinationId=374; address=(Add-City "שד' לוי אשכול מתחם הקראוונים"); phone="052-7677081"; denomination="אשכנז"; description="גבאי: יוסף בריקמן" }
    @{ name="מגן אברהם רמה ג'"; destinationId=374; address=(Add-City "ירמיהו הנביא 13 רמה ג 1"); phone="050-9944517"; denomination="ירושלמי"; description="גבאי: אהרון שטרית" }
    @{ name="מגן אברהם בן איש חי"; destinationId=374; address=(Add-City "בן איש חי 7"); phone="050-4109302"; denomination="עדות המזרח"; description="גבאי: נתנאל ימין" }
    @{ name="מגן אברהם רמת בית שמש ג'"; destinationId=374; address=(Add-City "ירמיהו 13"); phone="052-7113638"; denomination="עדות המזרח"; description="גבאי: מרדכי פרץ" }
    @{ name="מגן דוד"; destinationId=374; address=(Add-City "בר אילן 65"); phone="054-8478837"; denomination="ספרדי"; description="גבאי: מלא אברהם" }
    @{ name="מורשת אבות"; destinationId=374; address=(Add-City "ריבל 37"); phone="050-4277252"; denomination="תימני"; description="גבאי: יוסי גמליאל" }
    @{ name="מורשת אבות לבני קהילה אתיופית"; destinationId=374; address=(Add-City "צפניה הנביא 15/02"); phone="050-6091182"; denomination="ספרדי ירושלמי"; description="גבאי: ברוך צ'אנה" }
    @{ name="מחנה ישראל"; destinationId=374; address=(Add-City "הרצל 631"); phone="050-4789891"; denomination="עדות המזרח"; description="גבאי: הרב משה כהן" }
    @{ name="מניין אברכים"; destinationId=374; address=(Add-City "שמואל הנביא 5"); phone="050-8936100"; denomination="עדות המזרח"; description="גבאי: יצחק מלול" }
    @{ name="מנן אברהם"; destinationId=374; address=(Add-City "בני דן"); phone="058-3252690"; denomination="אתיופית"; description="גבאי: אליהו" }
    @{ name="מסורת אבות"; destinationId=374; address=(Add-City "קישון 23"); phone="050-2215422"; denomination="תימני"; description="גבאי: משה עוקבי" }
    @{ name="מעייני ישראל"; destinationId=374; address=(Add-City "הרב אדלשטיין 25"); phone="054-8425022"; denomination="אשכנזי"; description="גבאי: יצחק גנזלר" }
    @{ name="מקדש דוד"; destinationId=374; address=(Add-City "נהר הירדן 28"); phone="052-2284444"; denomination="ספרד"; description="גבאי: אברהם רוזן" }
    @{ name="מקדש מלך"; destinationId=374; address=(Add-City "קליין 17 רמה ה"); phone="054-8456958"; denomination="עדות המזרח ירושלמי"; description="גבאי: תמיר יעקב" }
    @{ name="מר עוקבא נוסח מרוקו"; destinationId=374; address=(Add-City "מר עוקבא 12"); phone="050-6003000"; denomination="מרוקאי"; description="גבאי: אליצור ויצמן" }
    @{ name="מרכז התורה ראדזימין"; destinationId=374; address=(Add-City "בן איש חי 14"); phone="052-7150200"; denomination="ספרד"; description="גבאי: יעקב כהן" }
    @{ name="משיבת נפש"; destinationId=374; address=(Add-City "שד' בן זאב 6 בית שמש"); phone="054-9395199"; denomination="ירושלמי ספרדי"; description="גבאי: חיים יהודה הבן של הרב כרמל" }
    @{ name="משכן אברהם ומאיר"; destinationId=374; address=(Add-City "נחל דולב 78"); phone="050-6450234"; denomination="מרוקאי"; description="גבאי: דוד וקנין" }
    @{ name="משכן אליהו ומלכה"; destinationId=374; address=(Add-City "נחל עין גדי"); phone="050-4116688"; denomination="ספרדי"; description="גבאי: ראובן כהן" }
    @{ name="משכן יחיאל"; destinationId=374; address=(Add-City "בן איש חי 10/5 חפציבה"); phone="050-4159123"; denomination="ספרדי"; description="גבאי: דוד תורגמן" }
    @{ name="משכן ישראל"; destinationId=374; address=(Add-City "אביי 28"); phone="050-4115321"; denomination="עדות המזרח"; description="גבאי: ישראל רייבי" }
    @{ name="משכן מנחם חב''ד"; destinationId=374; address=(Add-City "רבי טרפון 1/1"); phone="050-6748770"; denomination="חב''ד"; description="גבאי: ברוך צדוק" }
    @{ name="משכן מצדה"; destinationId=374; address=(Add-City "מצדה 25 בית שמש"); phone="054-5429101"; denomination="מרוקאי"; description="גבאי: שמואל אדרי" }
    @{ name="משכן מרדכי"; destinationId=374; address=(Add-City "שלמה זלמן 50"); phone="052-7521153"; denomination="ספרדי"; description="גבאי: שמואל בן עוליאל" }
    @{ name="משכן משה ואליהו"; destinationId=374; address=(Add-City "נחל עין גדי"); phone="050-6014266"; denomination="ספרדי"; description="גבאי: דרור בוטח באל" }
    @{ name="משכן תורה"; destinationId=374; address=(Add-City "רבי חנינא 30"); phone="052-7614549"; denomination="אשכנז"; description="גבאי: יהושע אסתרין" }
    @{ name="משכנות יוסף"; destinationId=374; address=(Add-City "אביי 21"); phone="052-7606112"; denomination="עדות המזרח"; description="גבאי: יהונתן נאמן" }
    @{ name="נוה אשר"; destinationId=374; address=(Add-City "נהר הירדן 106"); phone="054-8422724"; denomination="ספרדי"; description="גבאי: שלמה ביטון" }
    @{ name="נוה צדק"; destinationId=374; address=(Add-City "דוד רזיאל חצר ביס גשר"); phone="055-6838347"; denomination="ספרדי"; description="גבאי: יואב אליהו" }
    @{ name="נווה ישראל"; destinationId=374; address=(Add-City "נווה שמיר"); phone="054-7758818"; denomination="מרוקאי"; description="גבאי: הדר קקון" }
    @{ name="נווה שלום"; destinationId=374; address=(Add-City "השלושה 6"); phone="050-6566519"; denomination="מרוקאי"; description="גבאי: גל לחמני" }
    @{ name="נועם שמיר"; destinationId=374; address=(Add-City "רועי קליין 15"); phone="058-4430637"; denomination="ספרדי ירושלמי"; description="גבאי: ליאב נגרין" }
    @{ name="נחל שלום"; destinationId=374; address=(Add-City "ביאליק 1"); phone="058-3241637"; denomination="ספרדי"; description="גבאי: נתנאל כהן" }
    @{ name="נחלי תפילה"; destinationId=374; address=(Add-City "נחל רפאים 3"); phone="054-2447714"; denomination="ספרד אשכנזי"; description="גבאי: יעקב קירשנבוים" }
    @{ name="נחלת החיים הישן"; destinationId=374; address=(Add-City "מעשי חיא 1"); phone="050-2800406"; denomination="עדות המזרח"; description="גבאי: אפרים חאזי" }
    @{ name="ניר אברהם"; destinationId=374; address=(Add-City "בני דן 9"); phone="053-5244403"; denomination="אתיופים"; description="גבאי: דרסיי איינאו" }
    @{ name="נתיבות שלום - חסידי סלונים"; destinationId=374; address=(Add-City "רב שילא 1"); phone="052-7167956"; denomination="חסידי"; description="גבאי: חיים וינברג" }
    @{ name="נתיבי אמונה"; destinationId=374; address=(Add-City "נהרדעא 18 א"); phone="050-4118084"; denomination="עדות המזרח"; description="גבאי: יוסף דהן" }
    @{ name="סערט ויז'ניץ"; destinationId=374; address=(Add-City "נהרדעא 18"); phone="050-4168272"; denomination="חסידי"; description="גבאי: שמואל יצחק שוורץ" }
    @{ name="עטרת יוסף"; destinationId=374; address=(Add-City "עובדיה הנביא 15"); phone="054-8416914"; denomination="ירושלמי"; description="גבאי: שמעון שושן" }
    @{ name="עטרת ישראל"; destinationId=374; address=(Add-City "נהרדעא 24"); phone="050-4144099"; denomination="תימני"; description="גבאי: אהרון כהן" }
    @{ name="עטרת נחום צעירים"; destinationId=374; address=(Add-City "שפת אמת 27"); phone="053-4130077"; denomination="חסידים"; description="גבאי: מרדכי קרויזר" }
    @{ name="עטרת שלום"; destinationId=374; address=(Add-City "שבטי ישראל"); phone="054-2376662"; denomination="ספרדי"; description="גבאי: בנימין בן לולו" }
    @{ name="עץ יוסף"; destinationId=374; address=(Add-City "השבעה"); phone="052-8396517"; denomination="מרוקאי"; description="גבאי: מאיר סבג" }
    @{ name="פני שמואל"; destinationId=374; address=(Add-City "נחל לוז 11"); phone="054-5414539"; denomination="אשכנז"; description="גבאי: יהושע לנגסם" }
    @{ name="פעמי משיח"; destinationId=374; address=(Add-City "האתרוג 23"); phone="054-3331077"; denomination="ספרדי"; description="גבאי: עוזי מזרחי" }
    @{ name="קהילת ברדיטשוב"; destinationId=374; address=(Add-City "רב זביד"); phone="054-2615474"; denomination="ספרד - קרליבך"; description="גבאי: גבי הורן" }
    @{ name="קהילת גרעין יחד"; destinationId=374; address=(Add-City "הנורית 4"); phone="054-2566451"; description="גבאי: שלמה עמנואל" }
    @{ name="קהילה דתית לאומית"; destinationId=374; address=(Add-City "התבור 7"); phone="052-3462609"; denomination="מעורב אשכנזי"; description="גבאי: פיני ויקסלבוים" }
    @{ name="קהילת בני תורה"; destinationId=374; address=(Add-City "ר' מאיר בעל הנס"); phone="050-4112278"; denomination="אשכנז"; description="גבאי: חנוך הבלין" }
    @{ name="קהילת טהר לב"; destinationId=374; address=(Add-City "נחל קטלב 1"); phone="054-5994351"; denomination="כלל ישראל"; description="גבאי: אליאב מורי" }
    @{ name="קהילת ישראל"; destinationId=374; address=(Add-City "הרצל 20/8"); phone="050-7489891"; denomination="ספרדי"; description="גבאי: משה כהן" }
    @{ name="קהל חסידים רמת אברהם"; destinationId=374; address=(Add-City "הרב יעקב אדלשטיין 22"); phone="052-7169072"; denomination="ספרד/אשכנז"; description="גבאי: אלימלך שפירא" }
    @{ name="קהל חסידים צאעלים"; destinationId=374; address=(Add-City "צאעלים רמה א'"); phone="050-4192419"; denomination="ספרד"; description="גבאי: הרב פנחס דיוטש" }
    @{ name="קול אליהו"; destinationId=374; address=(Add-City "שד' האמוראים 67 ד3"); phone="052-7672473"; denomination="ספרדי"; description="גבאי: יחיאל צנרו" }
    @{ name="קול ה' ברמה"; destinationId=374; address=(Add-City "חגואל 7"); phone="052-7028323"; denomination="ספרדי"; description="גבאי: ירון ביטון" }
    @{ name="קיבוץ גלויות"; destinationId=374; address=(Add-City "אלנקווה 7"); phone="052-2866606"; denomination="ספרדי"; description="גבאי: מרדכי חייאייב" }
    @{ name="קהילת בני תורה בני תימן רמה ד"; destinationId=374; address=(Add-City "מר עוקבא"); phone="054-8454162"; denomination="תימני"; description="גבאי: עדיאל רענן" }
    @{ name="רשבי"; destinationId=374; address=(Add-City "סמטת הרימון 10"); phone="054-6232477"; denomination="ספרדי"; description="גבאי: רפי כהן" }
    @{ name="שבט הלוי"; destinationId=374; address=(Add-City "נחל שורק 25"); denomination="ספרדי"; description="גבאי: אברהם משה" }
    @{ name="שלום"; destinationId=374; address=(Add-City "אלרוזורוב"); phone="054-6688713"; denomination="תמני בלדי"; description="גבאי: יחיאל אדמוני" }
    @{ name="שלום שבזי"; destinationId=374; address=(Add-City "סמ' הרב יעקב מורי"); phone="054-5919825"; denomination="ספרדי"; description="גבאי: בצלאל כלאף" }
    @{ name="שמחת חיים"; destinationId=374; address=(Add-City "שורק 21"); phone="058-4481714"; denomination="ספרדי"; description="גבאי: ניסנוב" }
    @{ name="שערי צדק לעדת העיראקים"; destinationId=374; address=(Add-City "מורי יעקב 5"); phone="054-2374555"; denomination="ירושלמי - בבלי"; description="גבאי: יצחק הלוי" }
    @{ name="שערי תפילה - ריש לקיש"; destinationId=374; address=(Add-City "ריש לקיש 7"); phone="058-3268725"; denomination="עדות מזרח"; description="גבאי: משה לוי" }
    @{ name="שערי תפילה - רבי ברכיה"; destinationId=374; address=(Add-City "רבי ברכיה 18"); phone="052-7600628"; denomination="ספרדי ירושלמי"; description="גבאי: נפתלי אטיאס" }
    @{ name="שפת אמת - אברכים"; destinationId=374; address=(Add-City "שפת אמת 28 ב"); phone="053-4143994"; denomination="ספרד- חסידי"; description="גבאי: הרב נתנאל צבי פריזנט" }
    @{ name="תהילה לדוד"; destinationId=374; address=(Add-City "בן איש חי"); phone="058-4117764"; denomination="ירושלמי"; description="גבאי: מרדכי טימסיט" }
    @{ name="תולדות שלמה"; destinationId=374; address=(Add-City "ריש לקיש 24"); phone="055-6723938"; denomination="מרוקו"; description="גבאי: ישראל קדוש" }
    @{ name="תפארת אבות"; destinationId=374; address=(Add-City "חזון איש 8"); phone="054-4462503"; denomination="ספרדי"; description="גבאי: זכיר כהן" }
    @{ name="תפארת אוהל משה"; destinationId=374; address=(Add-City "תפארת משה 1"); phone="055-6684439"; denomination="ירושלמי"; description="גבאי: דוד עסיס" }
    @{ name="תפארת דוד"; destinationId=374; address=(Add-City "מרים הנביאה 31"); phone="052-7659760"; denomination="ספרדי"; description="גבאי: הרב אלעד יעקב" }
    @{ name="תפארת יעקב עדות המזרח"; destinationId=374; address=(Add-City "נריה הנביא 4"); phone="053-6918718"; denomination="ספרדי"; description="גבאי: יעקב אבוטבול" }
    @{ name="תפארת מסעוד"; destinationId=374; phone="050-6262706"; description="גבאי: דוד איבגי" }
    @{ name="תפארת עובדיה"; destinationId=374; address=(Add-City "ביאליק 32"); phone="053-8353257"; denomination="עדות מזרח"; description="גבאי: חזי מועלם" }
    @{ name="תפילה למשה"; destinationId=374; address=(Add-City "נהר הירקון 28"); phone="055-6750508"; denomination="ספרדי"; description="גבאי: פנחס קרויזר" }
)

# Prepend nusach to description where denomination is set
$payload = $payload | ForEach-Object {
    if ($_.denomination) {
        $_.description = "נוסח: $($_.denomination) | $($_.description)"
    }
    $_
}

# ── Send ───────────────────────────────────────────────────────────────────────
$headers   = @{ "Content-Type" = "application/json"; "Authorization" = "Bearer $token" }
$total     = $payload.Count
$batchSize = 50
$sent = 0; $errors = 0; $batchNum = 0

Write-Host ""
Write-Host "Sending $total synagogues to destination 374 (בית שמש)..." -ForegroundColor Cyan

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
