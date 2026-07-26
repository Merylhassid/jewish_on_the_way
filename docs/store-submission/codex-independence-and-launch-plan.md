# תוכנית עצמאית מלאה — תשתית, Google Play ו־App Store

## Jewish On The Way

> **תאריך בדיקה ועדכון:** 26.07.2026  
> **החלטה אסטרטגית:** מפסיקים את שיתוף הפעולה עם המכללה. האפליקציה לא תוגש למארק, לא תפורסם מחשבונות המכללה ולא תישאר תלויה בשרת המכללה.  
> **מטרת המסמך:** להעביר את כל הנכסים לבעלות עצמאית, להקים תשתית פרודקשן, ולפרסם את גרסה 1.0 בחשבונות Google ו־Apple שלך.  
> **דרך העבודה:** עוברים משימה אחת בכל פעם. לפני שינוי, רכישה או פריסה — מסבירים, מציעים פתרון וממתינים לאישור.

---

## 1. תקציר מנהלים

### ההמלצה בקצרה

1. לפתוח מיד חשבון Google Play אישי, כי לחשבון אישי חדש יש מסלול בדיקה סגורה של 12 בודקים במשך 14 ימים.
2. לפתוח Apple Developer כ־Individual אם אין כרגע חברה רשומה שהיא ישות משפטית עם D‑U‑N‑S. ב־Apple שמך המשפטי יוצג כ־Seller.
3. להקים שרת Hetzner CX23 בבעלותך, באזור גרמניה, עבור ה־Backend בלבד.
4. להשאיר את PostgreSQL כשירות מנוהל ב־Neon, אבל להקים פרויקט Neon חדש בבעלותך באזור Frankfurt ולהעביר אליו את המסד הקיים.
5. לפרסם את האתר, מדיניות הפרטיות ודף מחיקת החשבון ב־Cloudflare Pages בחינם.
6. להחליף את כתובת האפליקציה מ־`http://49.12.189.108:3000` ל־`https://api.jewishontheway.com` רק אחרי שהשרת החדש עובד ונבדק.
7. להשלים את פערי החנויות: סינון תוכן פוגעני, תנאי שימוש/כללי קהילה, צילומי מסך במידות חנות, טפסי פרטיות, בדיקות פיזיות ו־Builds חתומים.

### עלות צפויה

| תרחיש | שנה ראשונה | לאחר שנה ראשונה |
|---|---:|---:|
| מינימום בטוח: שרת + חנויות, Neon/EAS/Cloudinary בחינם | כ־₪800–1,000 | כ־₪650–850 לשנה |
| מומלץ לפרודקשן: כולל Neon Launch ותקציב API קטן | כ־₪1,350–1,800 | כ־₪1,200–1,650 לשנה |
| גידול בתעבורה | לפי שימוש | Maps, Neon, Cloudinary ושרת גדלים בהדרגה |

החישובים מבוססים על שערים יציגים של בנק ישראל מ־24.07.2026: דולר ₪3.0620 ואירו ₪3.4863. חברת האשראי, מע״מ ושער ההמרה בפועל יכולים לשנות מעט את החיוב. [מקור: בנק ישראל](https://www.boi.org.il/en/economic-roles/financial-markets/exchange-rates/)

---

## 2. מצב הפרויקט שנבדק בפועל

| רכיב | מצב נוכחי | מסקנה |
|---|---|---|
| Expo/EAS | פרויקט קיים בבעלות `jewish-on-the-way`, עם `projectId` קבוע | נשאר ומשמש ל־Android ול־iOS |
| מזהי חבילה | `com.jewishontheway.app` בשתי הפלטפורמות | תקין; לא לשנות אחרי פרסום |
| גרסה | `1.0.0`, ‏Android `versionCode: 1`, ‏iOS `buildNumber: 1` | תקין ל־Build ראשון |
| Expo SDK | SDK 54 / React Native 0.81 | מכוון Android API 36 ומתאים לדרישה החדשה של Google |
| כתובת API | `http://49.12.189.108:3000` | חוסם פרודקשן; חייב לעבור ל־HTTPS בשרת החדש |
| Backend | NestJS + TypeORM + Socket.IO | יעבור לשרת העצמאי |
| מסד נתונים | Neon PostgreSQL 17.10, ‏PostGIS פעיל, SSL פעיל | הטכנולוגיה מתאימה; מומלץ פרויקט חדש בבעלותך וב־Frankfurt |
| גודל המסד | 38,830,080 bytes — כ־37MiB | קטן מאוד; Free מספיק טכנית כעת |
| תמונות | Cloudinary | אפשר להישאר במסלול החינמי ולעקוב אחרי שימוש |
| אתר ציבורי | Landing, Privacy ו־Delete Account מוכנים מקומית | לפרסם ב־Cloudflare Pages |
| Metadata | שם, תיאורים, קטגוריה ואימייל תמיכה מוכנים | להשתמש בקבצים הקיימים |
| גרפיקה | אייקונים ו־Feature Graphic מוכנים | עדיין צריך סט צילומי מסך סופי לכל חנות |
| מחיקת חשבון | קוד ודף ציבורי מוכנים מקומית | דורש migrations, פריסה ובדיקת פרודקשן |
| מצב אורח | קיים בקוד | טוב לבדיקת Apple; לבדוק מקצה לקצה |
| דיווח וחסימה | קיימים דיווחים, חסימת משתמשים ומסך Admin | טוב, אך לא נמצא סינון תוכן פוגעני לפני פרסום |
| תנאי שימוש | הקישור באתר מסומן „בקרוב” | צריך מסמך אמיתי לפני השקה בגלל קהילה ואירוח |

### דרישות פלטפורמה שכבר מתקיימות

- Expo SDK 54 מכוון ל־Android 16 / API 36. החל מ־31.08.2026 Google דורשת API 36 לאפליקציות חדשות ולעדכונים. [Google Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-GB_ALL), [Expo SDK 54](https://expo.dev/changelog/sdk-54)
- EAS Build יכול לקמפל ולחתום Android ו־iOS בענן, ולכן אין חובה להחזיק Mac או Xcode מקומי. [Expo Distribution](https://docs.expo.dev/distribution/introduction/)
- Apple דורשת מאז 28.04.2026 Build באמצעות Xcode 26 ו־iOS 26 SDK; EAS עבור SDK 54 משתמש בתמונת Build מתאימה, אך יש לאמת זאת ב־Build הסופי. [Apple Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/)

---

## 3. מפת הבעלות העצמאית

כל השירותים הבאים חייבים להיות רשומים על חשבון שאתה שולט בו, עם אימות דו־שלבי וקודי שחזור:

| נכס | בעלות רצויה | פעולה |
|---|---|---|
| הדומיין `jewishontheway.com` | שלך | לוודא אימייל שחזור, Auto‑Renew ו־2FA |
| DNS ו־Cloudflare Pages | שלך | לפתוח Cloudflare ולחבר את הדומיין |
| שרת Hetzner | שלך | חשבון חדש, כרטיס שלך, SSH key שלך |
| Neon | שלך | להקים Organization/Project חדש ולייבא נתונים |
| Cloudinary | שלך | לוודא בעלות ולהחליף מפתחות אם נמסרו למכללה |
| Expo/EAS | שלך | לוודא שאין חברי מכללה ב־Organization |
| Google Play Console | שלך | חשבון אישי עצמאי |
| Apple Developer/App Store Connect | שלך | חשבון Individual עצמאי |
| Google Cloud / Maps | שלך | Billing, API key, quotas ו־alerts |
| Anthropic | שלך | API key ותקציב שימוש |
| Gmail/SMTP | שלך | App Password חדש ו־2FA |
| Git repository | שלך | להסיר גישת מכללה ולסובב סודות |

### צ׳קליסט סיום השיתוף עם המכללה

- [ ] לוודא שלמכללה אין הרשאה ל־Git, Expo, Neon, Cloudinary, DNS או Google Cloud.
- [ ] להחליף את כל הסודות שהיו על שרת המכללה: DB, ‏JWT, ‏Audit HMAC, ‏Cloudinary, ‏Anthropic, ‏Google Maps ו־SMTP.
- [ ] לא למחוק את שרת המכללה לפני שהשרת החדש, המסד החדש והגיבוי אומתו.
- [ ] לאחר מעבר מוצלח: לבקש מחיקה/סגירה של קוד, `.env`, לוגים וגיבויים השייכים לפרויקט בשרת המכללה.
- [ ] לשמור הוכחה כתובה שהבקשה נשלחה, אך אין צורך להגיש למארק את חומרי החנויות.

---

## 4. שלב א׳ — פתיחת חשבונות החנויות

מומלץ לבצע שלב זה ראשון, במקביל להקמת התשתית, משום שאימות הזהות והבדיקה הסגורה של Google לוקחים זמן.

### 4.1 Google Play Console

#### סוג החשבון

אם אין כרגע חברה/עמותה שהיא ישות משפטית עם D‑U‑N‑S, לפתוח **Personal account**. חשבון Organization מיועד לעסק או ארגון ודורש D‑U‑N‑S. לשני הסוגים יש גישה לאותן יכולות Play Console. [בחירת סוג חשבון](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en)

#### עלות

- $25 חד־פעמי — כ־₪77 לפי שער הבדיקה.
- אין תשלום שנתי.
- אפליקציה חינמית ללא רכישות לא משלמת עמלת חנות.

[מקור Google: תהליך הרשמה ותשלום](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)

#### מסמכים ופרטים להכנה

- [ ] חשבון Google ייעודי עם 2FA.
- [ ] שם משפטי, כתובת ופרטי Google Payments תואמים למסמך.
- [ ] תעודת זהות/דרכון ממשלתי בתוקף.
- [ ] טלפון ואימייל מאומתים.
- [ ] אימייל מפתח ציבורי: `jewishontheway@gmail.com`.
- [ ] שם מפתח ציבורי: מומלץ `Jewish On The Way`.
- [ ] אתר ציבורי עובד: `https://jewishontheway.com`.
- [ ] מכשיר Android פיזי לצורך אימות החשבון דרך אפליקציית Play Console.

Google דורשת אימות זהות; לחשבונות אישיים השם והכתובת נלקחים מפרופיל התשלומים, ואימייל המפתח מוצג לציבור. [אימות זהות](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en), [אימות מכשיר](https://support.google.com/googleplay/android-developer/answer/14316361?hl=en)

#### בדיקה סגורה שחובה לתכנן

לחשבון Personal חדש:

1. להעלות AAB למסלול Closed testing.
2. לגייס לפחות **12 בודקים**.
3. כל 12 הבודקים חייבים להישאר Opt‑in במשך **14 ימים רצופים**.
4. לאסוף משוב ולתקן בעיות.
5. בסיום להגיש בקשה ל־Production access ולענות על שאלות לגבי הבדיקה.

[דרישת Google לחשבונות אישיים חדשים](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)

### 4.2 Apple Developer Program

#### סוג החשבון

אם אין חברה רשומה שהיא ישות משפטית נפרדת, לפתוח **Individual**:

- Apple Account עם שמך המשפטי ו־2FA.
- שמך המשפטי יוצג בחנות כ־Seller.
- שם האפליקציה עדיין יהיה Jewish On The Way.

Organization דורש ישות משפטית, סמכות לחתום בשמה, D‑U‑N‑S, אימייל בדומיין הארגון ואתר פעיל. עוסק יחיד/sole proprietor נרשם בדרך כלל כ־Individual. [Apple Enrollment](https://developer.apple.com/programs/enroll/)

#### עלות

- $99 בכל שנה — כ־₪303 לפי שער הבדיקה.
- אם לא מחדשים, לא ניתן להגיש עדכונים והפצת האפליקציה עלולה להיפגע.

#### מסמכים ופרטים להכנה

- [ ] Apple Account אישי עם שם משפטי מדויק.
- [ ] 2FA פעיל ומספר טלפון נגיש.
- [ ] תעודת זהות/דרכון וכתובת.
- [ ] אמצעי תשלום בינלאומי.
- [ ] קבלה ואישור של Apple Developer Program License Agreement.
- [ ] יצירת App Store Connect record עם Bundle ID ‏`com.jewishontheway.app`.
- [ ] בחירת DSA Trader Status לפני הפצה באיחוד האירופי.

> **DSA באירופה:** Apple מחייבת הצהרת Trader/Non‑Trader להפצה באיחוד האירופי. יש לענות אמת. Trader עשוי להידרש להציג פרטי קשר מאומתים לציבור. זו החלטה משפטית/עסקית; אם אין ודאות, אפשר בתחילת הדרך לא להפיץ במדינות האיחוד עד לבירור. [Apple DSA Requirement](https://developer.apple.com/news/upcoming-requirements/)

#### מה לא צריך כרגע

- אין צורך ב־Mac לצורך Build והעלאה כאשר משתמשים ב־EAS.
- אין צורך בחשבון בנק/טפסי מס לתשלום אם האפליקציה חינמית ואין IAP. אם נוסיף תשלום בעתיד, ייפתח שלב הסכמים, מס ובנקאות נוסף.

---

## 5. שלב ב׳ — מעבר לשרת עצמאי

### 5.1 ארכיטקטורה מומלצת

```text
אפליקציה מותקנת מהחנויות
            │
            ▼
https://api.jewishontheway.com
            │
     Cloudflare DNS / HTTPS
            │
            ▼
Hetzner CX23 — Nginx + NestJS + PM2
            │
            ├── Neon PostgreSQL/PostGIS — Frankfurt
            ├── Cloudinary — תמונות
            ├── Google Maps/Places
            ├── Anthropic — חיפוש חכם
            └── Gmail SMTP — מיילי מערכת

https://jewishontheway.com
            │
            ▼
Cloudflare Pages — Landing + Privacy + Delete Account + Terms
```

### 5.2 השרת המומלץ

**Hetzner CX23 באזור גרמניה**, x86, בערך 2 vCPU, ‏4GB RAM ו־40GB דיסק. המסד נשאר חיצוני ב־Neon, ולכן השרת מריץ בעיקר NestJS, ‏Socket.IO, ‏Nginx ו־PM2.

| רכיב | מחיר רשמי לפני מס/IPv4 | תקציב מעשי |
|---|---:|---:|
| CX23 | €5.49 לחודש | כ־₪19 |
| Primary IPv4 | חיוב נפרד | תקציב כ־₪2–3 |
| Hetzner Backups | 20% ממחיר השרת | כ־₪4 |
| סה״כ | בערך €7.1 | לתכנן ₪25–32 לחודש |

[מחירי Hetzner מיוני 2026](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), [תמחור Backups](https://docs.hetzner.com/cloud/billing/faq/)

### 5.3 הקמת השרת

- [ ] לפתוח חשבון Hetzner עם 2FA.
- [ ] ליצור SSH key במחשב ולשמור גיבוי מוצפן.
- [ ] להקים Ubuntu 24.04 LTS בגרמניה.
- [ ] ליצור משתמש Deployment שאינו root עם `sudo`.
- [ ] לבטל SSH באמצעות סיסמה ולאפשר מפתח בלבד.
- [ ] להגדיר UFW: פורטים 22, ‏80 ו־443 בלבד; פורט Node לא נחשף החוצה.
- [ ] להפעיל עדכוני אבטחה אוטומטיים ו־Fail2ban.
- [ ] להתקין Node.js LTS, ‏Nginx, ‏PM2 ו־Certbot.
- [ ] להעתיק את ה־Backend בלבד ולהריץ `npm ci`, ‏`npm run build`.
- [ ] ליצור `.env` ידנית בשרת עם הרשאות קובץ מצומצמות.
- [ ] להריץ migrations לפני הפעלת הגרסה החדשה.
- [ ] להפעיל PM2 עם restart אוטומטי לאחר reboot.
- [ ] להגדיר `pm2-logrotate`: שמירה עד 90 יום בהתאם למדיניות.
- [ ] להגדיר Nginx reverse proxy עם תמיכה ב־WebSocket.
- [ ] להוסיף Health Check ולהגדיר ניטור חיצוני.
- [ ] להפעיל Hetzner Backups ולבדוק בפועל שחזור.

### 5.4 DNS ו־HTTPS

- [ ] להעביר את Nameservers של הדומיין ל־Cloudflare.
- [ ] להעלות את `landing/` ל־Cloudflare Pages.
- [ ] לחבר `jewishontheway.com` ו־`www.jewishontheway.com` לאתר.
- [ ] ליצור רשומת `api.jewishontheway.com` ל־IP החדש.
- [ ] להתחיל עם DNS Only בזמן Certbot, ואז לבחור אם להפעיל Cloudflare Proxy.
- [ ] להפיק Let's Encrypt עבור `api.jewishontheway.com`.
- [ ] לבדוק חידוש אוטומטי של התעודה.
- [ ] לוודא שכל הקריאות הן HTTPS וכל חיבורי Socket.IO הם WSS.

Cloudflare Pages מאפשר חיבור דומיין מותאם אישית במסלול החינמי. [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/), [מגבלות Free](https://developers.cloudflare.com/pages/platform/limits/)

### 5.5 הפרדת כתובות פיתוח ופרודקשן

במקום כתובת קשיחה בתוך `mobile/src/api/client.ts`, יש לעבור למשתנה:

```text
EXPO_PUBLIC_API_URL=https://api.jewishontheway.com
```

- Preview יכול להצביע לסביבת בדיקה.
- Production מצביע רק ל־HTTPS הציבורי.
- אין להכניס סודות למשתני `EXPO_PUBLIC_*`; כתובת API ציבורית אינה סוד.
- לפני Build סופי לבדוק באמצעות `npx expo config --type public` איזו כתובת נארזת.

---

## 6. שלב ג׳ — מסד הנתונים Neon

### 6.1 תוצאת הבדיקה

בדיקה ישירה לקריאה בלבד ב־26.07.2026:

| בדיקה | תוצאה |
|---|---|
| מנוע | PostgreSQL 17.10 |
| PostGIS | פעיל |
| SSL | פעיל |
| גודל | כ־37MiB |
| מיקום לפי Endpoint | US East |
| התאמה ל־Free storage | כן; כ־7% בלבד מתוך 0.5GB |

### 6.2 האם Neon טוב לפרויקט?

כן. עדיף להשאיר את המסד בשירות מנוהל ולא להתקין PostgreSQL על אותו VPS:

- הפרדה בין נפילת Backend לבין המסד.
- Autoscaling, Connection Pooling ו־PostGIS.
- שחזור ו־Time Travel בהתאם למסלול.
- אפשרות לגדול בלי להעביר את האפליקציה או לשנות Bundle.

המסלול החינמי כולל 100 CU‑hours ו־0.5GB אחסון לפרויקט, עם חלון שחזור קצר של עד 6 שעות. Launch מחויב לפי שימוש; Neon מציגה הוצאה טיפוסית של $15 לחודש לעומס לסירוגין ו־1GB, עם חלון שחזור עד 7 ימים. [Neon Pricing](https://neon.com/pricing)

### 6.3 ההמלצה: פרויקט חדש ב־Frankfurt

לא להשאיר את הפרויקט הנוכחי „כמו שהוא” לטווח ארוך, משלוש סיבות:

1. צריך לוודא שהבעלות וה־Billing אינם קשורים למכללה.
2. הסיסמה הנוכחית מופיעה בקובצי Git ולכן נחשבת חשופה.
3. המסד ב־US East, בעוד ה־Backend יהיה בגרמניה; כל שאילתה עוברת אוקיינוס.

Neon תומכת ב־AWS Europe Frankfurt. [Neon regions/status](https://neon.com/docs/introduction/status)

#### תהליך מעבר בטוח

- [ ] לפתוח Neon Organization ופרויקט בבעלותך באזור Frankfurt.
- [ ] להפעיל PostGIS בפרויקט החדש.
- [ ] ליצור Role נפרד לאפליקציה עם סיסמה חדשה וחזקה.
- [ ] לעצור כתיבות לזמן קצר או להכריז חלון תחזוקה.
- [ ] ליצור `pg_dump` מוצפן מהמסד הקיים.
- [ ] לשחזר לפרויקט החדש באמצעות `pg_restore`.
- [ ] להריץ migrations חסרות.
- [ ] להשוות ספירת משתמשים, מסעדות, בתי כנסת, פוסטים, הודעות ו־migrations.
- [ ] לעדכן את `.env` המקומי והשרת החדש בלבד.
- [ ] לבצע Smoke Test מלא.
- [ ] לשמור את המסד הישן Read‑Only לזמן קצר ואז למחוק/לנתק אותו.

### 6.4 גיבויים

- [ ] ב־Closed Testing אפשר להישאר ב־Free.
- [ ] לפני פתיחת Production לבחור: Free עם סיכון לשחזור קצר, או Launch עם 7 ימי שחזור.
- [ ] בנוסף ל־Neon, ליצור `pg_dump` שבועי מוצפן ולשמור מחוץ ל־Neon.
- [ ] לבדוק שחזור בפועל למסד זמני; גיבוי שלא נבדק אינו גיבוי.
- [ ] להגדיר Budget/Autoscaling ceiling כדי למנוע הפתעת חיוב.

---

## 7. שלב ד׳ — אבטחה והיפרדות מלאה מהמכללה

### 7.1 סודות שחובה להחליף

משום שמנהל שרת המכללה יכול היה לקרוא את קובץ הסביבה, יש להחליף:

- [ ] Neon DB role/password — ייפתר באמצעות הפרויקט החדש.
- [ ] `JWT_SECRET`.
- [ ] `AUDIT_FINGERPRINT_SECRET`.
- [ ] Cloudinary API Secret.
- [ ] Anthropic API key.
- [ ] Google Places/Maps API key ולהגביל אותו.
- [ ] Gmail App Password של SMTP.
- [ ] כל Access Token או SSH key שנמצא על שרת המכללה.
- [ ] סיסמת חשבון הבדיקה לפני מסירתה לחנויות.

### 7.2 Git

- [ ] להסיר connection strings מ־`CLAUDE.md` ומכל סקריפט עזר.
- [ ] להעביר את כל הסקריפטים לקריאת `DB_*` מהסביבה.
- [ ] לוודא ש־`.env`, ‏credentials, keystore ו־service account JSON נמצאים ב־`.gitignore`.
- [ ] לסרוק את המאגר והיסטוריית Git לסודות.
- [ ] אם המאגר הועבר לגורמים חיצוניים: לאחר Rotation לשקול `git filter-repo`.
- [ ] להסיר Collaborators/Deploy Keys של המכללה.

> Rotation קודם לניקוי היסטוריה: ברגע שהסודות הישנים בוטלו, הופעתם בהיסטוריה כבר אינה מעניקה גישה.

### 7.3 הגנות שימוש ועלויות

- [ ] Rate limits ל־Auth, מחיקת חשבון, חיפוש AI, העלאות ודיווחים.
- [ ] Google Cloud budget alerts ו־quota יומי ל־Places.
- [ ] Anthropic spending limit ו־daily cap.
- [ ] Cloudinary upload limits, סוגי קבצים וגודל.
- [ ] ניטור CPU/RAM/דיסק/שגיאות 5xx ותוקף SSL.
- [ ] עדכון חודשי של תלויות אבטחה.

---

## 8. שלב ה׳ — השלמות מוצר וציות לפני Build

### 8.1 תוכן משתמשים: חסם חשוב ל־Apple

Apple דורשת מאפליקציות עם תוכן משתמשים:

- סינון תוכן פוגעני לפני/בזמן פרסום.
- מנגנון דיווח.
- תגובה בזמן לדיווחים.
- יכולת לחסום משתמשים פוגעניים.
- פרטי קשר ציבוריים.

[Apple App Review Guideline 1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)

בפרויקט כבר קיימים דיווח, חסימה ומסך Admin. לא נמצא מנגנון סינון תוכן פוגעני, ולכן:

- [ ] להוסיף סינון שרת לתוכן קהילה, תגובות, הודעות וטקסטי אירוח.
- [ ] לא להסתפק בסינון בצד האפליקציה — אפשר לעקוף אותו.
- [ ] להגדיר תור דיווחים וזמן תגובה תפעולי.
- [ ] לבדוק שמשתמש חסום אינו מופיע בפיד, באירוח ובצ׳אט לשני הצדדים.
- [ ] לתעד בהערות ל־Apple היכן נמצאים Report ו־Block.

### 8.2 מסמכים ציבוריים

- [x] טיוטת מדיניות פרטיות בעברית ובאנגלית קיימת.
- [x] דף מחיקת חשבון קיים מקומית.
- [ ] להשלים תנאי שימוש בעברית ובאנגלית.
- [ ] להשלים כללי קהילה ומדיניות תוכן.
- [ ] להוסיף סעיף אחריות ובטיחות לאירוח בין משתמשים.
- [ ] להחליף באתר את „תנאי שימוש (בקרוב)” בקישור פעיל.
- [ ] לפרסם את כל המסמכים ב־HTTPS.
- [ ] לוודא שהמדיניות תואמת בדיוק להתנהגות הקוד ולתשובות טפסי החנויות.

טיוטות אינן תחליף לייעוץ משפטי. בדיקה משפטית מקצועית היא אופציונלית אך מומלצת בגלל אירוח, תוכן משתמשים, מיקום ומידע דתי/כשרות; העלות נקבעת בהצעת מחיר ואינה כלולה בתקציב הבסיס.

### 8.3 פרטיות והרשאות

יש להצהיר באופן עקבי על:

- שם ואימייל.
- מיקום מדויק/משוער בזמן שימוש.
- תמונות פרופיל ותמונות תוכן.
- תוכן קהילה, תגובות, לייקים, מניינים, אירוח וצ׳אטים.
- העדפת כשרות כמידע דתי רגיש.
- חיפושים ומשוב חיפוש.
- העברת טקסט חיפוש ל־Anthropic.
- תמונות ל־Cloudinary.
- לוגי אבטחה פסאודונימיים עד 90 יום.
- מחיקת נתוני חיפוש לאחר 365 ימים.

### 8.4 חשבון ומחיקת נתונים

- [ ] לוודא שמחיקת חשבון קיימת מתוך האפליקציה.
- [ ] לפרסם `https://jewishontheway.com/delete-account`.
- [ ] להריץ migrations של מנגנון המחיקה.
- [ ] לבדוק משתמש ייעודי: יצירה → תוכן → תמונה → מחיקה → 401 לטוקן הישן.
- [ ] לבדוק שהנתונים נמחקו מ־DB ושמחיקת Cloudinary מתבצעת best effort.
- [ ] לוודא שדף המחיקה עובד גם ללא התקנת האפליקציה.

Apple מחייבת מחיקה בתוך האפליקציה כאשר קיימת יצירת חשבון. [Apple Guideline 5.1.1](https://developer.apple.com/app-store/review/guidelines/). Google דורשת קישור ציבורי למחיקת החשבון והנתונים. [Google Account Deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)

### 8.5 מצב אורח

מצב אורח כבר קיים. יש לבצע בדיקת מסכים:

- [ ] אורח יכול לחפש ולראות מסעדות, בתי כנסת, יעדים ומניינים בלי חשבון.
- [ ] קהילה ניתנת לקריאה בלבד.
- [ ] בפעולה אישית מופיעה בקשת התחברות ברורה.
- [ ] אירוח, כתיבה, תגובה, לייק, יצירת מניין ומועדפים מסונכרנים דורשים חשבון.
- [ ] אין לולאת ניווט או קריסת 401 בזמן אורח.

---

## 9. שלב ו׳ — אתר, Metadata וגרפיקה

### 9.1 כתובות ציבוריות

| שימוש | כתובת |
|---|---|
| אתר/Marketing URL | `https://jewishontheway.com` |
| Privacy Policy | `https://jewishontheway.com/privacy` |
| Account Deletion | `https://jewishontheway.com/delete-account` |
| Terms of Use | `https://jewishontheway.com/terms` |
| Community Guidelines | `https://jewishontheway.com/community-guidelines` |
| Support | האתר + `jewishontheway@gmail.com` |
| API | `https://api.jewishontheway.com` |

Apple דורשת Privacy Policy URL ו־Support URL אמיתי עם פרטי קשר. [Apple App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/), [Support URL](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)

### 9.2 חומרים שכבר מוכנים

- `docs/store-submission/app-metadata.md`
- `docs/store-submission/app-metadata.html`
- אייקון Apple ‏1024×1024.
- אייקון Google ‏512×512.
- Google Feature Graphic ‏1024×500.
- טיוטת Privacy.
- חשבון בדיקה — ללא שמירת הסיסמה ב־Git.

### 9.3 צילומי מסך

#### Apple

- 1–10 צילומים לכל גודל/שפה.
- להכין לפחות סט Portrait עבור iPhone ‏6.9″ במידה נתמכת, למשל 1290×2796 או 1320×2868.
- אין Alpha/Transparency.
- האפליקציה מוגדרת `supportsTablet: false`, לכן לא נדרש סט iPad.

[Apple Screenshot Specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

#### Google

- לפחות שני צילומי טלפון איכותיים; מומלץ 4–8.
- אייקון 512×512 ו־Feature Graphic ‏1024×500 כבר קיימים.
- להכין צילומים עקביים עם הגרסה האמיתית וללא פיצ׳רים שלא קיימים.

[Google Preview Assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)

#### מסכים מומלצים

1. מסך הבית וחיפוש יעד.
2. מסעדות כשרות וסינון.
3. בתי כנסת/מניינים.
4. קהילה יהודית ביעד.
5. אירוח שבת וחגים.
6. חיפוש חכם.
7. מצפן לירושלים.

---

## 10. שלב ז׳ — Build, חתימה ובדיקות

### 10.1 לפני Build

- [ ] ה־Backend החדש חי ב־HTTPS.
- [ ] המסד החדש פעיל ונבדק.
- [ ] כתובת Production אינה IP ואינה HTTP.
- [ ] כל migrations רצו.
- [ ] Privacy/Delete/Terms זמינים לציבור.
- [ ] סודות הוחלפו.
- [ ] בדיקות Backend כולן ירוקות.
- [ ] Mobile lint ו־Expo Doctor עוברים.
- [ ] אין הרשאות שאינן בשימוש.
- [ ] Guest, Auth, Password Reset, Upload, Delete, Report, Block, Chat ו־Hosting נבדקו.
- [ ] חשבון הבדיקה פעיל, יציב וללא 2FA/OTP.

### 10.2 Android

```bash
eas build --platform android --profile production
```

- EAS יפיק `.aab`.
- EAS יכול לנהל את Android keystore.
- להפעיל Google Play App Signing.
- לשמור גיבוי של credentials וקודי שחזור.
- לכל Build חדש להעלות `android.versionCode`.

### 10.3 iOS

```bash
eas build --platform ios --profile production
```

- לאחר אישור Apple Developer, EAS ייצור certificate ו־provisioning profile בחשבונך.
- EAS יפיק Build חתום ויכול להעלות אותו ל־App Store Connect.
- לכל Build חדש להעלות `ios.buildNumber`.
- אין צורך ב־Mac מקומי.

### 10.4 עלות EAS

- Free: מספיק למספר Builds מוגבל ובעדיפות תור נמוכה.
- Starter: $19 לחודש — כ־₪58 — כולל Build credits; אפשר לשדרג רק בחודש ההגשה ולחזור ל־Free.

[Expo Billing](https://docs.expo.dev/billing/faq/), [EAS Build/Submit](https://docs.expo.dev/eas/)

### 10.5 מטריצת בדיקות חובה

| תחום | Android | iOS |
|---|---:|---:|
| התקנה נקייה | [ ] | [ ] |
| מצב אורח | [ ] | [ ] |
| הרשמה/התחברות/יציאה | [ ] | [ ] |
| שכחתי סיסמה | [ ] | [ ] |
| מיקום: אישור/סירוב/שינוי בהגדרות | [ ] | [ ] |
| העלאת תמונה ומחיקתה | [ ] | [ ] |
| קהילה: צפייה/פרסום/דיווח/חסימה | [ ] | [ ] |
| מניינים וצ׳אט WSS | [ ] | [ ] |
| אירוח, בטיחות וצ׳אט | [ ] | [ ] |
| מחיקת חשבון | [ ] | [ ] |
| עברית RTL / אנגלית / צרפתית | [ ] | [ ] |
| רשת חלשה/מנותקת | [ ] | [ ] |
| קישורי Privacy/Delete/Terms | [ ] | [ ] |

---

## 11. שלב ח׳ — Google Play: מילוי והגשה

### 11.1 יצירת האפליקציה

- [ ] שם: Jewish On The Way.
- [ ] ברירת שפה: עברית; אפשר להוסיף English ו־French לאחר מכן.
- [ ] App, לא Game.
- [ ] Free.
- [ ] Package: `com.jewishontheway.app`.
- [ ] Developer name: Jewish On The Way.
- [ ] Support email/website/phone לפי הטופס.

### 11.2 Store Listing

- [ ] שם עד 30 תווים.
- [ ] Short description עד 80.
- [ ] Full description עד 4,000.
- [ ] App icon ‏512×512.
- [ ] Feature Graphic ‏1024×500.
- [ ] צילומי מסך.
- [ ] קטגוריה Travel & Local.
- [ ] Privacy Policy URL.

### 11.3 App Content ובירוקרטיה

- [ ] **Data Safety:** הצהרה מלאה על כל הנתונים וה־SDKs.
- [ ] **App Access:** פרטי חשבון בדיקה באנגלית, פעילים תמיד וללא OTP.
- [ ] **Ads:** No ads, כל עוד אין SDK פרסומות.
- [ ] **Content Rating:** שאלון IARC.
- [ ] **Target Audience:** לא לסמן Kids; לבחור קהל בהתאם לתוכן הקהילה והאירוח.
- [ ] **News, Government, Health, Financial Features, COVID:** לענות בהתאם — כרגע לא.
- [ ] **Location Permissions:** להסביר שמיקום משמש להצגת מרחקים/מקומות קרובים ומצפן.
- [ ] **Account Deletion URL:** הכתובת הציבורית.
- [ ] **Data deletion:** לאשר שניתן למחוק מתוך האפליקציה ומהאתר.

Google דורשת Data Safety מדויק, כולל איסוף על ידי SDKs של צד שלישי. [Google Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en). פרטי הבדיקה חייבים להיות זמינים, חוזרים ותקפים מכל מדינה. [Google App Access](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en)

### 11.4 מסלולי שחרור

1. Internal testing — בדיקה מהירה של AAB.
2. Closed testing — 12 בודקים/14 יום.
3. Production access application.
4. Production release ב־Staged rollout של 10%–20%.
5. מעקב Android Vitals, crashes, ANR ודיווחי משתמשים.
6. הרחבה ל־100% לאחר 2–3 ימים יציבים.

---

## 12. שלב ט׳ — App Store Connect: מילוי והגשה

### 12.1 יצירת App Record

- [ ] Name: Jewish On The Way.
- [ ] Primary language.
- [ ] Bundle ID: `com.jewishontheway.app`.
- [ ] SKU פנימי, למשל `jotw-ios-001`.
- [ ] Category: Travel, עם Secondary מתאים אם נדרש.
- [ ] Availability — לבחור מדינות ולהחליט לגבי EU/DSA.

### 12.2 Product Page

- [ ] Name עד 30.
- [ ] Subtitle עד 30.
- [ ] Description.
- [ ] Keywords עד 100 תווים.
- [ ] Support URL.
- [ ] Marketing URL.
- [ ] Privacy Policy URL.
- [ ] צילומי מסך.
- [ ] Copyright על שמך/הישות המשפטית.

[Apple App Information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information)

### 12.3 פרטיות וציות

- [ ] App Privacy / Nutrition Labels.
- [ ] Age Rating questionnaire.
- [ ] Encryption/Export Compliance.
- [ ] Content Rights.
- [ ] DSA Trader status.
- [ ] הצהרת שימוש ב־Location וב־Photos תואמת להרשאות.
- [ ] אין Tracking/Advertising Identifier אם אין שימוש בפועל.
- [ ] אם בעתיד מפעילים Google Sign‑In, להוסיף Sign in with Apple באותו עדכון.

Apple דורשת Privacy Policy URL והצהרה גם על שותפי צד שלישי. [Apple App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)

### 12.4 App Review Information

- [ ] שם, אימייל וטלפון ליצירת קשר.
- [ ] חשבון הבדיקה.
- [ ] Notes באנגלית שמסבירות:
  - האפליקציה מאפשרת Guest browsing.
  - היכן נמצאים Report ו־Block.
  - היכן נמצאת מחיקת החשבון.
  - כיצד לבדוק קהילה, מניינים ואירוח.
  - שאין תשלומים ואין פרסומות בגרסה 1.0.
- [ ] Backend וכל השירותים זמינים במשך כל הבדיקה.

Apple מבקשת Demo account או Demo mode ושירותי Backend פעילים בזמן הבדיקה. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

### 12.5 TestFlight ושחרור

1. להעלות Build ל־App Store Connect.
2. לבדוק Internal TestFlight.
3. להזמין מספר בודקי iPhone.
4. לתקן בעיות ולהעלות Build Number חדש.
5. לשלוח ל־App Review.
6. לבחור Manual Release.
7. לאחר אישור, לפרסם כשגם השרת והניטור מוכנים.

[TestFlight Overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview)

---

## 13. טבלת עלויות מלאה

### 13.1 חיובים הכרחיים

| רכיב | מחיר מטבע מקור | אומדן ₪ | תדירות |
|---|---:|---:|---|
| Google Play Console | $25 | כ־₪77 | חד־פעמי |
| Apple Developer | $99 | כ־₪303 | בכל שנה |
| Hetzner CX23 + IPv4 + Backup | כ־€7.1 | כ־₪25 לפני מס; לתכנן ₪30 | חודשי |
| דומיין | כ־$11.28 + ICANN לפי הרכישה | כ־₪35 | שנתי; כבר שולם לשנה הראשונה |
| SSL | $0 | ₪0 | Let's Encrypt |
| Cloudflare Pages/DNS | $0 | ₪0 | Free |

### 13.2 שירותים לפי שימוש

| רכיב | התחלה | מתי משלמים |
|---|---:|---|
| Neon | $0 | Launch טיפוסי כ־$15/חודש כאשר רוצים 7 ימי שחזור/יותר פעילות |
| Expo EAS | $0 | Starter $19 בחודש Build עמוס; אפשר חודש אחד בלבד |
| Cloudinary | $0, ‏25 credits | Plus $99/חודש רק אם חורגים משמעותית |
| Google Maps/Places | Pay‑as‑you‑go | Maps SDK ללא עלות; לרבים מה־SKUs יש 5,000–10,000 שימושים חינם בחודש |
| Anthropic Haiku 4.5 | לפי Tokens | $1 למיליון input ו־$5 למיליון output; בקאפ הנוכחי צפוי סכום קטן |
| Gmail SMTP | $0 | בעת גדילה מומלץ ספק Transactional Email בתשלום |
| ניטור | אפשר Free | תשלום רק אם צריך התראות/Retention מתקדם |

[Cloudinary Pricing](https://cloudinary.com/pricing), [Google Maps Pricing](https://developers.google.com/maps/billing-and-pricing/pricing), [Claude Haiku Pricing](https://platform.claude.com/docs/en/about-claude/models/overview), [Expo Pricing](https://docs.expo.dev/billing/faq/)

### 13.3 חישוב שנה ראשונה

#### מינימום

- Google: כ־₪77.
- Apple: כ־₪303.
- שרת וגיבוי: כ־₪300 לפני מס, לתכנן ₪360.
- דומיין: כ־₪35, כבר שולם.
- Neon, EAS, Cloudinary ו־API: Free/בתוך המכסות.

**חישוב רשמי לפני מס:** כ־₪715.  
**תקציב בטוח:** ₪800–1,000.

#### מומלץ לפרודקשן

- כל המינימום.
- Neon Launch טיפוסי: כ־₪46 לחודש / כ־₪551 בשנה.
- EAS Starter לחודש השקה אחד: כ־₪58, רק אם צריך.
- Buffer קטן ל־AI/Maps/Email: ₪10–30 בחודש, לפי שימוש.

**תקציב בטוח מומלץ:** כ־₪1,350–1,800 בשנה הראשונה.

### 13.4 מה לא כלול

- עורך דין למדיניות/תנאי שימוש — אופציונלי, לפי הצעת מחיר.
- הקמת חברה, הנהלת חשבונות ומיסוי — לא נדרש לאפליקציה חינמית אישית, אך יידרש אם תהפוך לפעילות עסקית.
- שיווק ממומן, מעצב, מכשירי בדיקה או תמיכה חיצונית.
- עמלות חנות על מכירות — כרגע ₪0 כי אין מכירות/IAP. אם תתווסף מונטיזציה, צריך תוכנית נפרדת.

---

## 14. סדר עבודה מומלץ

| # | משימה | מצב | משך משוער | עלות |
|---:|---|---|---:|---:|
| 1 | סגירת בעלות והרשאות מכללה + Inventory | הבא לביצוע | חצי יום | ₪0 |
| 2 | פתיחת Google Play + אימות | פתוח | 1–7 ימים | כ־₪77 |
| 3 | פתיחת Apple Developer | פתוח | 1–7 ימים | כ־₪303 |
| 4 | חשבון Cloudflare + פרסום האתר | פתוח | חצי יום | ₪0 |
| 5 | חשבון Hetzner והקשחת שרת | פתוח | יום | כ־₪30/חודש |
| 6 | Neon חדש Frankfurt + העברת DB | פתוח | חצי–יום | ₪0 בשלב הבדיקה |
| 7 | Rotation סודות וניקוי קוד | פתוח ודחוף | יום | ₪0 |
| 8 | פריסת Backend, migrations, HTTPS/WSS | פתוח | 1–2 ימים | כלול בשרת |
| 9 | Terms + Community Guidelines + סינון תוכן | חסם חנות | 1–3 ימים | ₪0 ללא עו״ד |
| 10 | בדיקות מקצה לקצה | פתוח | 2–4 ימים | ₪0 |
| 11 | צילומי מסך סופיים | פתוח | יום | ₪0 |
| 12 | Android AAB + Internal/Closed Test | פתוח | 14+ ימים | EAS Free |
| 13 | iOS Build + TestFlight | פתוח | 2–5 ימים | EAS Free |
| 14 | מילוי טפסי Google/Apple | פתוח | 1–3 ימים | ₪0 |
| 15 | הגשה, תיקוני Review ו־Staged Release | פתוח | 2–10 ימים | ₪0 |

### לוח זמנים ריאלי

- שבוע 1: חשבונות, Cloudflare, שרת ו־Neon.
- שבוע 2: אבטחה, פריסה, ציות ובדיקות.
- שבועות 3–4: Closed Testing בגוגל במקביל ל־TestFlight.
- שבוע 5: טפסים, הגשה ותיקוני Review.

**סה״כ:** כ־4–6 שבועות, בעיקר בגלל 14 ימי Google והאפשרות לדחיות/תיקונים.

---

## 15. תנאי Go/No‑Go לפני פרסום

לא שולחים Production עד שכל אלה ירוקים:

- [ ] חשבונות החנויות וה־Billing בבעלותך בלבד.
- [ ] API ציבורי ב־HTTPS, ללא תלות ב־IP המכללה.
- [ ] DB בבעלותך, גיבוי ושחזור שנבדקו.
- [ ] אין סודות תקפים ב־Git.
- [ ] Privacy, Delete Account, Terms ו־Community Guidelines ציבוריים.
- [ ] מחיקת חשבון נבדקה בפרודקשן.
- [ ] סינון, דיווח, חסימה ומודרציה עובדים.
- [ ] Demo account עובד ללא OTP.
- [ ] Data Safety ו־App Privacy תואמים לקוד.
- [ ] Android Closed Test הושלם.
- [ ] iOS TestFlight נבדק על iPhone אמיתי.
- [ ] כל הטסטים, lint ו־smoke tests עברו.
- [ ] ניטור, גיבויים ותקציבי API פעילים.
- [ ] אין טקסט שיווקי שמבטיח פיצ׳ר שאינו קיים.

---

## 16. המשימה הראשונה

### Inventory וסגירת בעלות — ללא רכישה

במשימה הראשונה נעבור יחד על רשימה קצרה:

1. באיזה אימייל נמצאים Domain, Expo, Neon, Cloudinary, Git ו־Google Cloud.
2. האם למכללה יש הרשאות לאחד מהם.
3. האם יש לך גישה מלאה ל־Neon Dashboard ול־Cloudinary Dashboard.
4. האם Git נמצא בחשבון שלך והאם המאגר Private.
5. נאסוף רשימת סודות שצריך לסובב — בלי להציג או לשמור את הערכים.

רק לאחר האישור והבדיקה הזו נעבור לרכישה הראשונה: **Google Play Console**, כדי להתחיל מוקדם את שעון האימות והבדיקה הסגורה.

---

## 17. מקורות רשמיים מרכזיים

- [Apple Developer enrollment and $99 annual fee](https://developer.apple.com/programs/enroll/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- [Apple 2026 SDK requirements](https://developer.apple.com/news/upcoming-requirements/)
- [Google Play registration](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
- [Google personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google identity verification](https://support.google.com/googleplay/android-developer/answer/10841920?hl=en)
- [Google Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Google Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-GB_ALL)
- [Expo EAS](https://docs.expo.dev/eas/)
- [Expo billing](https://docs.expo.dev/billing/faq/)
- [Hetzner 2026 pricing](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- [Neon pricing](https://neon.com/pricing)
- [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- [Cloudinary pricing](https://cloudinary.com/pricing)
- [Google Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Anthropic model pricing](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Bank of Israel exchange rates](https://www.boi.org.il/en/economic-roles/financial-markets/exchange-rates/)
