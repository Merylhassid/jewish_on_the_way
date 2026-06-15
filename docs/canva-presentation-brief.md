# Canva Presentation Brief — Jewish On The Way

> **הוראה ל-Claude Desktop:** בנה מצגת ב-Canva על בסיס המסמך הזה.
> כל הטקסט בשקפים **בעברית** (RTL), אבל **מונחים טכניים וכלים נשארים באנגלית** (TF-IDF, Naive Bayes, JWT, PostGIS וכו') ואת שם הפרויקט "Jewish On The Way" השאר באנגלית.
> ערכת צבעים: **כחול** (כהה + בהיר), נקי ומקצועי. גופן ברור, יישור לימין לעברית.
> אל תמציא נתונים — השתמש רק במה שכתוב כאן.

---

## 0. רקע הפרויקט (להבנה שלך, לא שקף)

אפליקציית מובייל + בקאנד לאיתור שירותים יהודיים בעולם: מסעדות כשרות, בתי כנסת, מניינים, ואירוח שבת.
- **Mobile:** React Native + Expo + TypeScript
- **Backend:** NestJS + Node.js + TypeScript (REST API)
- **DB:** PostgreSQL + PostGIS + TypeORM (על Neon)
- **AI:** מודל חיפוש חכם שנבנה מאפס (TF-IDF + Naive Bayes), בלי ChatGPT בזמן חיפוש
- **שני מסלולים אקדמיים:** Daniel — AI / Machine Learning · Meryl — Cyber / Security
- פורמט הצגה: 15 דק' מצגת + 5 דק' שאלות, עם הדגמה חיה של האפליקציה אחרי המצגת.

נתוני היקף אמיתיים: **6,783 מסעדות · 6,227 בתי כנסת · 119 ערים בארץ ובעולם**.

---

## 1. שער
- כותרת ראשית: **JEWISH ON THE WAY**
- כתובית: "אפליקציה חכמה למטיילים יהודים בעולם"
- "פרויקט גמר — הנדסת תוכנה"
- "Daniel — AI / Machine Learning · Meryl — Cyber / Security"
- "[שם המכללה] · יוני 2026"

## 2. מוטיבציה: הגדרת הבעיה
(שלוש כותרות מודגשות + הסבר)
- **מידע יהודי מפוזר** — מידע על מסעדות כשרות, בתי כנסת, מניינים ואירוח שבת מפוזר בין אתרים, קהילות ומפות — אין מקור אחד מרכזי ואמין.
- **חיפוש תלוי במשתנים רבים** — התוצאות משתנות לפי עיר, מדינה, מיקום GPS ושפה — חוויה לא עקבית.
- **אין זמן לבדיקה ידנית** — מטיילים בשטח צריכים מידע מיידי ומדויק; נדרש פתרון חכם ומהיר.

## 3. קהל יעד
- **מטיילים יהודים** — מחפשים שירותים דתיים, מסעדות כשרות ובתי כנסת בכל מקום.
- **ישראלים בחו"ל ושומרי כשרות** — אוכל כשר ומניינים בכל עיר.
- **משפחות ומבקרי קהילות** — אירוח שבת וחיבור לקהילה ובתי חב"ד.

## 4. פתרון: מה הפרויקט עושה
- **ריכוז שירותים יהודיים** — ממשק אחד נוח, בלי לחפש במספר אתרים.
- **חיפוש מגוון ומתקדם** — מסעדות, בתי כנסת, מניינים, אירוח — לפי טקסט חופשי, GPS, עיר ומדינה.
- **AI Classification & Backend** — ה-Backend מנתח את הבקשה, מפעיל מודל AI לסיווג כוונה (TF-IDF + Naive Bayes), ומחזיר תוצאות **מדורגות לפי רלוונטיות ומרחק**.
  *(הערה: אל תכתוב "מותאמות אישית" — אין פרסונליזציה.)*

## 5. יכולות מרכזיות (1/2)
- 🔍 **Smart AI Search** — חיפוש בשפה חופשית בעברית, מודל AI שנבנה לפרויקט. הבנת טקסט, סיווג כוונה, תוצאות מדורגות ומדויקות.
- 📍 **GPS Search** — חיפוש לפי מיקום ומרחק עם PostGIS distance functions. תמיכה בעיר, מדינה ו-GPS.
- 🍽️ **Kosher Restaurants** — מאגר מסעדות עם סינון לפי רמת כשרות, מיקום ומרחק.
  *(הערה: אל תבטיח "חיפוש באנגלית" — האנגלית חלשה.)*

## 6. יכולות מרכזיות (2/2)
- 🏛️ **Synagogues** — בתי כנסת לפי נוסח (אשכנז/ספרד/תימן ועוד), סינון לפי GPS/עיר/מדינה, שעות תפילה ופרטי קשר.
- 🤝 **Minyans** — חיפוש מניינים קרובים, הרשמה דרך האפליקציה, ניהול ע"י מארגנים עם **עדכונים בזמן אמת (WebSockets)**.
- 🕯️ **Shabbat Hosting** — בקשות אירוח, הצעות מארחים, וצ׳אט פרטי בין אורח למארח.

## 7. PROJECT EPICS (1/3) — מספור רץ!
1. **User Management & Authentication** — הרשמה, התחברות, פרופיל והרשאות · JWT + Refresh Tokens
2. **Smart AI Search** — הבנת טקסט חופשי וסיווג כוונה · TF-IDF + Naive Bayes, דיוק 82%–86%
3. **Kosher Restaurants** — ניהול מסעדות, כשרות וסינונים · חיפוש לפי GPS, עיר ומדינה

## 8. PROJECT EPICS (2/3)
4. **Synagogues & Minyans** — בתי כנסת לפי נוסח, מניינים והרשמה · סינון לפי נוסח ומיקום
5. **Shabbat Hosting** — בקשות אירוח, הצעות וצ׳אט פרטי · חיבור מארחים-אורחים
6. **Location & Distance Engine** — GPS וחישובי מרחק · מנוע מבוסס PostGIS

## 9. PROJECT EPICS (3/3)
7. **Data Management** — הצעות משתמשים, דיווחים ואזור Admin · ניהול תוכן וממשק ניהול
8. **Mobile User Experience** — React Native + Expo · ניווט נוח, תמיכה בעברית

## 10. System Architecture (כדיאגרמת זרימה אנכית עם חצים)
```
Mobile App (React Native + Expo)
        ↓ REST API
Controllers (NestJS) → Guards (JWT / Authorization)
        ↓
Services (Business Logic + AI Search)
        ↓ TypeORM
PostgreSQL + PostGIS (Storage · Geolocation · Distance)
```
- **AI Model — TF-IDF + Naive Bayes**: מחובר ל-Services, מסווג intent ל-4 קטגוריות (restaurant / synagogue / minyan / hosting). דיוק ~82%–86%. נבנה מאפס, ללא ChatGPT בזמן חיפוש.

## 11. Backend Architecture
- **Modules** — ארגון קוד לפי תחומים: Auth, User, Search, Restaurant, Synagogue, Minyan, Hosting. כל מודול עצמאי.
- **Controllers & Services & DTOs** — Controllers מטפלים בבקשות HTTP, Services מכילים לוגיקה עסקית + AI + חישובי מרחק, DTOs מאמתים קלט.
- **Guards** — JWT Authentication, Role-Based Authorization (User/Admin), Rate Limiting.

## 12. Database Architecture
- **PostgreSQL** — אחסון רלציוני. Entities: Users, Restaurants, Synagogues, Minyans, Hosting.
- **PostGIS + Geospatial Queries** — חישובי מרחק, חיפוש לפי GPS/עיר/מדינה/מרחק במטרים.
- **TypeORM** — מיפוי Entities לטבלאות, Migrations, Relations, Repository Pattern.

## 13. Technology Stack
- **📱 Mobile:** React Native · Expo · TypeScript
- **⚙️ Backend:** NestJS · Node.js · TypeScript · REST API
- **🗄️ Database:** PostgreSQL · PostGIS · TypeORM

## 14. Technology Stack (2/2)
- **🤖 AI & ML:** TF-IDF (טקסט→וקטורים) · Naive Bayes (סיווג כוונה) · **שני מודלים מאפס — Intent + Denomination Classification** · דיוק 82%–86% · Text Preprocessing
- **🔒 Security:** JWT + Refresh Token · Bcrypt · DTO Validation + Guards · Rate Limiting (anti brute-force)
- **🛠️ Tools & Deployment:** Git & GitHub · VPS · Environment Variables

## 15. Smart Search Flow
- תהליך: User Query → Text Preprocessing → AI Classification → Destination Detection → Filters → Ranking → Results
- דוגמאות:
  - "פיצה בבית שמש" → city + restaurant
  - "בית כנסת קרוב" → GPS + synagogue
  - "מסעדה בתאילנד" → country + restaurant

## 16. מודל AI מותאם — DANIEL (מסלול AI)
**עקרונות:**
- נבנה מאפס לפרויקט — ללא ChatGPT בזמן חיפוש
- TF-IDF ממיר טקסט לוקטורים לפי תדירות ומשקל מילים
- **שני מודלים:** סיווג כוונה (restaurant/synagogue/minyan/hosting) + סיווג נוסח (אשכנז/ספרד/חב"ד/תימן)

**הערכת ביצועים:**
- חלוקת Train / Validation / Test (70/15/15) — בדיקה על נתונים שלא נראו
- מדדים: Precision, Recall, F1-Score לכל קטגוריה
- **Test = 82.6% · Validation = 85.3%** (held-out)

**דוגמאות Intent:** "פיצה בבית שמש"→restaurant · "בית כנסת קרוב"→synagogue · "מניין שחרית"→minyan · "אירוח שבת בפריז"→hosting

## 17. Security & Load Testing — MERYL (מסלול סייבר)
**אבטחת מידע וניהול Sessions:**
- JWT + Refresh Token (נשמר כ-hash, תוקף 7 ימים)
- Bcrypt לסיסמאות (10 rounds + salt)
- אימות מייל בהרשמה (קוד 6 ספרות, hash, 15 דק')
- Guards להגנה על נקודות קצה (JWT + Admin RBAC)

**הגנה על קלט ותקשורת:**
- DTO Validation (whitelist + forbidNonWhitelisted)
- Parameterized Queries — הגנה מ-SQL Injection
- Security Headers — HSTS, X-Frame-Options, nosniff, CORS whitelist

**Rate Limiting & ניטור:**
- Rate Limiting — 500/דקה גלובלי, 5/דקה ב-Auth (anti brute-force)
- Audit Logging — תיעוד אירועי אבטחה

**בדיקות עומס (k6):**
- 60 VUs בו-זמנית · ~20 req/s
- בקשות שנענו: median ≈ 390ms
- ה-Rate Limiter תפס את ההצפה והחזיר HTTP 429 מעל 500/דקה לכל IP — **הגנת DoS פעלה בפועל תחת עומס**

## 18. למה הפרויקט תואם למסלולים
- **AI / Machine Learning:** פיתוח מודל ML מהיסוד · TF-IDF + Naive Bayes · סיווג כוונה והערכת ביצועים
- **Cyber / Security:** JWT + Bcrypt · Guards + Rate Limiting · הגנה מ-SQL Injection · Security Headers · בדיקות עומס
- **Full-Stack:** Mobile + Backend + Database · REST API · Testing (Unit + Integration) · Deployment מלא

## 19. Testing & Quality (שקף חדש)
- **16 חבילות בדיקה** — Unit + Integration (Jest)
- כיסוי: Auth, Restaurants, AI Classifier, Minyans, Guards
- בדיקות ייעודיות למודל ה-AI ולשכבת האבטחה
- בדיקות עומס עם k6

## 20. Data Collection — איסוף נתונים אוטומטי (שקף חדש)
- Web Scraping אוטומטי עם **Playwright** (דפדפן headless)
- מקורות סמכותיים: הרבנות הראשית, מועצות דתיות עירוניות, Google Maps
- תהליך: **Scrape → Normalize → Structured JSON → Geocoding → Bulk Import**
- כך נאספו אלפי רשומות ב-119 ערים — בלתי אפשרי ידנית

## 21. הדגמה חיה (Live Demo)
1. פתיחת האפליקציה במכשיר אמיתי דרך Expo Go
2. חיפוש: "בית כנסת קרוב"
3. חיפוש: "פיצה בבית שמש"
4. חיפוש מדינה: "מסעדה בתאילנד"
5. פתיחת פרטי מקום ומידע מלא
6. מניין / אירוח / צ׳אט — אם יש זמן
- גיבוי: אם אין רשת — וידאו מוקלט / APK מותקן מראש

## 22. תודה רבה
- "תודה רבה" + "שאלות?"
- Jewish On The Way · Daniel — AI / Machine Learning · Meryl — Cyber / Security

---

### הנחיות עיצוב כלליות
- ערכת כחול עקבית (כהה לרקעים, בהיר לטקסט/הדגשות).
- כל מונח אנגלי שלם ולא הפוך; עברית מיושרת לימין.
- אייקונים וקטוריים של Canva (לא אמוג'י דגלים שמתרסקים).
- שקפים עם אותה כותרת ממוספרים (1/2), (1/3) וכו'.
- צילומי מסך **אופציונליים** — יש הדגמה חיה אחרי המצגת, אז העדף טקסט נקי, דיאגרמות ואייקונים.
