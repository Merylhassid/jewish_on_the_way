# Jewish On The Way — Claude Code Instructions

## סקירת פרויקט
אפליקציית מובייל + בקאנד לאיתור מסעדות ובתי כנסת בערים ברחבי העולם.

- **Backend:** NestJS + TypeScript, פורט 3001
- **DB:** PostgreSQL על Neon Cloud (serverless)
- **Mobile:** React Native / Expo

---

## חיבור למסד הנתונים

```
postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require
```

---

## API — אימות

```powershell
$token = (Invoke-RestMethod -Uri "http://localhost:3001/auth/login" `
  -Method Post -ContentType "application/json" `
  -Body '{"email":"daniyehudai@gmail.com","password":"daniel2109"}').access_token
```

---

## Workflow — ייבוא בתי כנסת לעיר חדשה

### 1. קבלת נתונים מהמשתמש
המשתמש שולח: שם עיר + destinationId + מקור נתונים (טבלה / קישור לאתר).

### 2. הכנת JSON לייבוא

פורמט של כל רשומה:
```json
{
  "name": "שם בית הכנסת",
  "address": "רחוב מספר, שם העיר",
  "phone": "050-1234567",
  "denomination": "נוסח/עדה",
  "description": "שם גבאי - פלוני / שכונה - שם השכונה",
  "destinationId": 123,
  "latitude": 31.1234,
  "longitude": 34.5678
}
```

**חוקים קריטיים לכתובות:**
- הכתובת חייבת להסתיים עם `, שם העיר` (לדוגמה: `הרצל 5, יבנה`)
- אם יש רק שם רחוב ללא מספר → להוסיף `1` (לדוגמה: `הרצל 1, יבנה`)
- אם אין כתובת כלל → `שם העיר` בלבד

**מיפוי שדות:**
- שם גבאי → `description`: `"שם גבאי - [שם]"`
- שכונה → `description`: `"שכונה - [שם]"`
- טלפון → `phone`
- נוסח/עדה → `denomination`
- שדות שאין להם עמודה ייעודית → `description`
- עמודות כמות/אולם → **להתעלם, לא לייבא**
- `latitude` / `longitude` → שדות אופציונליים לעקיפת גיאוקודינג (כשיש קורדינטות מדויקות)

**מרחב מוגן (ייחודי ליבנה):**
- לא → `"אין מרחב מוגן"`
- כן / יש → `"יש מרחב מוגן"`
- ממ"ד → `"יש ממ\"ד"`
- מקלט → `"יש מקלט"`
- מקלט קרוב → `"יש מקלט קרוב"`
- ריק → לא לכתוב כלום

### 3. הוספת עיר ל-cityCenters

קובץ: `backend/src/admin/manual-synagogue-import.service.ts`

לחפש את ה-map של `cityCenters` ולהוסיף:
```typescript
'שם העיר': { lat: XX.XXXX, lon: XX.XXXX },
```

קורדינטות מרכז העיר: לחפש ב-Google Maps.

### 4. הרצת הייבוא

```powershell
$token = (Invoke-RestMethod -Uri "http://localhost:3001/auth/login" `
  -Method Post -ContentType "application/json" `
  -Body '{"email":"daniyehudai@gmail.com","password":"daniel2109"}').access_token

$data = Get-Content "backend/import-CITYNAME-synagogues.json" -Raw -Encoding UTF8

$result = Invoke-RestMethod -Uri "http://localhost:3001/admin/synagogues/bulk" `
  -Method Post -ContentType "application/json; charset=utf-8" `
  -Headers @{Authorization="Bearer $token"} -Body $data

"created=$($result.created) updated=$($result.updated) skipped=$($result.skipped) errors=$($result.errors)"
```

---

## ⚠️ אזהרות קריטיות

### אל תקרא regeocode אחרי import!
**לעולם אל** תקרא `POST /admin/synagogues/regeocodeDestination/:id` אחרי ייבוא חדש.

**למה:** הייבוא כבר מגיאוקד כל כתובת בנפרד. קריאה ל-regeocode מייד אחרי = הצפת Nominatim → חסימה → כל הכתובות נופלות על מרכז העיר ומדרסות את הקורדינטות התקינות.

השתמש ב-regeocode רק לתיקון בעיה ספציפית ידועה בעיר קיימת.

### Windows PowerShell בלבד
המשתמש על Windows 11. תמיד להשתמש ב-PowerShell, לא bash/Linux.

---

## ערים שכבר יובאו

| עיר | destinationId | כמות |
|-----|--------------|------|
| גבעת שמואל | — | — |
| גבעתיים | — | — |
| חדרה | — | — |
| חיפה | — | — |
| הוד השרון | — | — |
| ירושלים | — | 518 (kipa.co.il) |
| קרית אתא | — | — |
| קרית ביאליק | — | — |
| גדרה | — | — |
| גן יבנה | — | — |
| אילת | — | — |
| דימונה | — | — |
| קרית גת | — | — |
| קריית מוצקין | — | — |
| קריית אונו | — | — |
| קרית שמונה | — | — |
| לוד | — | — |
| מעלה אדומים | — | — |
| מזכרת בתיה | — | — |
| מבשרת ציון | — | — |
| מגדל העמק | — | — |
| מודיעין | — | — |
| נהריה | — | — |
| נס ציונה | — | — |
| נתניה | — | — |
| נתיבות | — | — |
| אור יהודה | — | — |
| פרדס חנה כרכור | — | — |
| פתח תקווה | — | — |
| רעננה | — | — |
| רמת גן | — | — |
| רמת השרון | — | — |
| רמלה | — | — |
| רחובות | — | — |
| ראשון לציון | — | — |
| ראש העין | — | — |
| ראש פינה | — | — |
| סביון | — | — |
| שדרות | — | — |
| שוהם | — | — |
| טבריה | — | — |
| יבנה | 355 | 78 |
| יהוד | 317 | 22 |
| יקנעם | 409 | 24 |
| זכרון יעקב | 406 | 17 |
| קיסריה | 434 | 2 |
| עפולה | 430 | 111 |
| אשקלון | 293 | 158 |

---

## Endpoint חשוב

- `POST /admin/synagogues/bulk` — ייבוא מרוכז (מגיאוקד אוטומטית)
- `GET /admin/synagogues` — רשימת בתי כנסת
- `POST /admin/synagogues/regeocodeDestination/:id` — **אל תשתמש ראוטינית!**

---

## גיאוקודינג — מנגנון

`backend/src/admin/manual-synagogue-import.service.ts` → פונקציה `geocodeAddress`:
1. מנסה כתובת מובנית (רחוב + עיר) דרך Nominatim
2. אם נכשל ואין מספר → מוסיף "1" ומנסה שוב
3. אם נכשל → Nominatim free-text
4. אם נכשל → fallback ל-`cityCenters` (מרכז העיר)

**מגבלה:** ערים קטנות בישראל לא ממופות טוב ב-Nominatim → כתובות ללא מספר בית יכולות ליפול על מרכז העיר. זה תקין ומצופה.

---

## scraping אתרים עם JS pagination

כאשר אתר משתמש ב-JS לדפדוף (לא URL params), להשתמש ב-Playwright:

```javascript
// ניווט לעמוד הבא ע"י לחיצה על כפתור
const clicked = await page.evaluate(async (num) => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const btn = buttons.find(b => 
    b.innerText.trim() === String(num) && 
    b.className.includes('cursor-pointer')
  );
  if (btn) { btn.click(); return true; }
  return false;
}, pageNum);
```

סקריפטים של scraping נשמרים ב: `backend/rabanut-scraper/scrape-CITYNAME.js`
