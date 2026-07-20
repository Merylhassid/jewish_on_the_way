# אבטחה ובדיקת עומסים — דף לימוד מלא (2 עמודים + שו"ת)

> כל מה שקשור לסייבר/אבטחה ובדיקת העומסים, במילים פשוטות ואמינות.
> המספרים אומתו מול הקוד האמיתי (`main.ts`, `app.module.ts`, `auth.service.ts`).
> עיקרון-על: **Defense in Depth** — כמה שכבות הגנה, לא נקודת כשל יחידה.

---

# עמוד 1 — אימות, הרשאות, והגנה על נתונים

## 1. אימות זהות (Authentication)

**JWT — שני טוקנים בכל התחברות:**
- **Access Token** — חתום, קצר-טווח (**15 דקות** בפרודקשן), נשלח בכל בקשה מוגנת ב-Header. נחתם עם `JWT_SECRET` ממשתנה סביבה.
- **Refresh Token** — ארוך-טווח (**7 ימים**), משמש לחידוש ה-Access בלי להתחבר מחדש.

**אחסון מאובטח של טוקנים (נקודה חשובה!):**
- ה-Refresh Token **לעולם לא נשמר גלוי**. הוא נוצר אקראי (64 בייט) ונשמר ב-DB **מגובב ב-SHA-256**. הערך הגולמי חוזר ללקוח בלבד.
- ⚠️ **גיבוב (hash), לא הצפנה** — חד-כיווני. גם אם ה-DB דולף, אי אפשר לשחזר את הטוקן המקורי.
- ב-**Logout** ה-Refresh נמחק מה-DB מיידית (**Token Revocation**) — טוקן גנוב חסר ערך אחרי התנתקות.

**סיסמאות:**
- **bcrypt עם 10 rounds + salt**. שוב — **גיבוב חד-כיווני, לא הצפנה**. הסיסמה אף פעם לא ניתנת לשחזור.
- הודעות שגיאה **זהות** בין "משתמש לא קיים" ל-"סיסמה שגויה" → מונע **User Enumeration** (גילוי אילו אימיילים רשומים).

**אימות אימייל (OTP):**
- בהרשמה נשלח **קוד בן 6 ספרות**, תוקף **15 דקות**. הקוד עצמו **מגובב ב-SHA-256** ב-DB.
- המשתמש **לא פעיל** (`isActive=false`) עד אימות — אי אפשר להתחבר לפני.
- מנגנון **Resend** ליצירת קוד חדש.

## 2. הרשאות (Authorization) — RBAC
- **JwtAuthGuard** — מגן על כל endpoint: מאמת שהטוקן תקין + שהמשתמש קיים + שהחשבון פעיל.
- **AdminGuard** — ממשקי ניהול דורשים `role = admin` (נבדק מול ה-DB).
- **צ'אט אירוח** — רק 2 הצדדים של בקשה **מאושרת** רשאים להיכנס לחדר (Participant Validation).

## 3. הגנה מפני קלט זדוני (Input Validation)
- **ValidationPipe גלובלי** עם:
  - `whitelist: true` — זורק שדות שלא הוגדרו ב-DTO.
  - `forbidNonWhitelisted: true` — דוחה בקשה עם שדות לא מוכרים.
  - `transform: true` — ממיר לטיפוסים הנכונים.
- אימייל מנורמל (`lowercase`), סיסמה ≥8 תווים עם אות וספרה, הודעות צ'אט 1–500 תווים.
- גוף הבקשה מוגבל ל-**10MB** (מונע הצפת זיכרון).

## 4. הגנה מפני SQL Injection
- כל הגישה ל-DB דרך **TypeORM עם Parameterized Queries** — **אף פעם** לא בונים מחרוזת SQL ידנית עם קלט משתמש.
- `synchronize: false` — הסכמה מנוהלת ב-**Migrations ידניות בלבד** (לא שינוי אוטומטי מסוכן בפרודקשן).

---

# עמוד 2 — Rate Limiting, כותרות, ובדיקת עומסים

## 5. הגנה מפני ניצול לרעה (Rate Limiting / DoS)
מנגנון `@nestjs/throttler`, אומת בקוד:

| רמה | מגבלה | למה |
|-----|-------|-----|
| כלל ה-API (גלובלי) | **500 בקשות / 60 שניות** לכל IP | הגנת DoS כללית |
| Endpoints של אימות (login/register) | **5 בקשות / 60 שניות** | מניעת **brute-force** על סיסמאות |
| צור קשר | **3 בקשות / שעה** | מניעת ספאם |
| הודעות WebSocket | **5 הודעות / 10 שניות** למשתמש | מניעת הצפת צ'אט |

## 6. כותרות אבטחה, CORS ו-HTTPS (אומת ב-`main.ts`)
| כותרת | מטרה |
|-------|------|
| `X-Content-Type-Options: nosniff` | מניעת MIME Sniffing |
| `X-Frame-Options: DENY` | מניעת **Clickjacking** |
| `Referrer-Policy: strict-origin-when-cross-origin` | מניעת דליפת URL |
| `Strict-Transport-Security` (HSTS, בפרודקשן) | אכיפת **HTTPS** |
- **CORS** — בפרודקשן מוגבל ל-Origins מורשים בלבד; בפיתוח פתוח.
- **DB** — חיבור עם `ssl: true, rejectUnauthorized: true`.

## 7. רישום ביקורת (Audit Logging)
תיעוד כל פעולה רגישה ב-DB: `USER_REGISTERED`, `USER_LOGIN`, `USER_LOGIN_FAILED`, `USER_LOGOUT`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_DONE`, `CHAT_MESSAGE_SENT`, `EMAIL_VERIFIED`. מאפשר חקירת אירועים בדיעבד.

## 8. אימות ב-WebSocket
ערוצי הצ'אט מאומתים ב-JWT — חיבור ללא טוקן תקף **מנותק מיד**. RBAC חל גם פה (צ'אט אירוח רק למשתתפים מאושרים).

---

## ⚡ בדיקת עומסים (k6)

**סביבה:** שרת `49.12.189.108:3000`, כלי **k6**, **60 משתמשים וירטואליים**, משך ~4.5 דקות, ניהול ב-PM2.
**4 תרחישים:** Health Check, Destinations List, Restaurants List, AI Search.

**תוצאות (מהספר):**
| מדד | תוצאה |
|-----|-------|
| סה"כ בקשות | 5,470 |
| זמן תגובה **חציוני** | **79ms** |
| p90 | 495ms |
| p95 | 555ms |
| מקסימום | 2.37s |
| אחוז "כישלונות" | 63.41% |

**הפרשנות הקריטית (זה כל הסיפור):**
> ה-63% **אינם קריסה** — אלו תגובות **HTTP 429 מה-Rate Limiter**. כל 60 המשתמשים רצו מ-**IP אחד**, וה-limiter חוסם מעל 500 בקשות/דקה לכל IP. בכל תרחיש התקבלו **בדיוק 500 הצלחות** ואז חסימה — בדיוק כמתוכנן.

| תרחיש | הצלחות | כשלים (429) |
|-------|--------|-------------|
| Health Check | 500 | 110 |
| Destinations | 500 | 453 |
| Restaurants | 500 | 475 |
| AI Search | 500 | 431 |

**מסקנות:**
- השרת **לא קרס**, פעל ברציפות, חציון **79ms** — מצוין.
- מנגנון ה-Rate Limiting **הוכיח את עצמו** והגן מפני הצפה.
- בפרודקשן כל משתמש מגיע מ-**IP נפרד** → המגבלה לא חלה עליו → הכשלים לא מייצגים מצב אמיתי.
- **שיפור עתידי:** הרצה חוזרת מ-IP-ים שונים, הוספת Redis cache, הפרדת קודי שגיאה בניתוח.

---

## 🛡️ טבלת סיכום — איום מול הגנה
| איום | מנגנון |
|------|--------|
| גניבת סיסמאות | bcrypt (10 rounds) + salt |
| גניבת טוקנים | SHA-256 hash ב-DB + Revocation ב-logout |
| Brute-force | Rate limit 5/60s על login |
| DoS | Throttle 500/60s גלובלי |
| SQL Injection | TypeORM Parameterized Queries |
| XSS | Security Headers + Whitelist validation |
| Clickjacking | X-Frame-Options: DENY |
| MITM | HTTPS + HSTS + SSL/TLS |
| CSRF | JWT ב-Header (ללא cookies) |
| User Enumeration | הודעות שגיאה זהות |
| Privilege Escalation | AdminGuard + בדיקת Role |
| גישה ללא אימות מייל | `isActive=false` עד OTP |
| גישה לא מורשית לצ'אט | Participant Validation |
