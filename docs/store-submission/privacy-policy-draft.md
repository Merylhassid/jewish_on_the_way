# Jewish On The Way — טיוטת מדיניות פרטיות / Privacy Policy Draft

> **סטטוס:** טיוטה לבדיקה בלבד — אין לפרסם עדיין.  
> **תאריך הכנה:** 19 ביולי 2026  
> הגרסה העברית והגרסה האנגלית נועדו להיות זהות במשמעותן. במקרה של פער לא מכוון, יש לתקן את שתי הגרסאות לפני הפרסום.

## תנאים שחובה להשלים לפני פרסום המדיניות

- [ ] להפעיל HTTPS בשרת הייצור ולעדכן את כתובת ה-API באפליקציה.
- [x] להסיר כתובות אימייל גלויות וטוקן איפוס מלוגי `MailService` ו-`AuthService`.
- [ ] להגדיר בפריסת השרת `pm2-logrotate` כך שלוגים ייצאו מהמחזור לאחר תקופת השמירה שהוגדרה.
- [x] לקבוע 365 ימי שמירה ולממש מחיקה אוטומטית מלאה של רשומות `search_feedback` ישנות.
- [ ] בזמן הפריסה: להגדיר `SEARCH_FEEDBACK_RETENTION_DAYS=365`, להריץ את migration האינדקס ולהפעיל את גרסת הבקאנד החדשה.
- [x] להכין מקומית דף דו-לשוני וזרימת אימות באימייל לבקשת מחיקת חשבון ללא האפליקציה.
- [ ] בזמן הפריסה: להריץ את migration של `account_deletion_requests`, להגדיר `PUBLIC_WEB_URL`, לאפשר CORS מהדומיין ולהעלות את הדף ל-`https://jewishontheway.com/delete-account`.
- [ ] לוודא שקישור למדיניות מופיע באפליקציה, ב-Google Play Console וב-App Store Connect.
- [ ] לוודא שטפסי Google Data Safety ו-Apple App Privacy תואמים למדיניות הסופית.

---

# מדיניות הפרטיות של Jewish On The Way

**עודכן לאחרונה: 19 ביולי 2026**

Jewish On The Way (להלן: **“האפליקציה”**, **“השירות”** או **“אנחנו”**) מכבדת את פרטיות המשתמשים. מדיניות זו מסבירה איזה מידע נאסף כאשר משתמשים באפליקציה, מדוע אנו משתמשים בו, עם מי הוא עשוי להיות משותף, כמה זמן הוא נשמר וכיצד ניתן לבקש גישה אליו או מחיקה שלו.

לשאלות בנושא פרטיות ניתן לפנות אלינו בכתובת: **jewishontheway@gmail.com**.

## 1. המידע שאנו אוספים

### 1.1 פרטי חשבון ואימות

בעת הרשמה או שימוש בחשבון אנו עשויים לעבד:

- שם פרטי ושם משפחה;
- כתובת אימייל ומזהה משתמש פנימי;
- סיסמה כשהיא שמורה באמצעות גיבוב חד-כיווני (hash), ולא כסיסמה גלויה;
- קודים וטוקנים זמניים לצורך אימות אימייל, התחברות ואיפוס סיסמה;
- תמונת פרופיל, אם המשתמש בוחר להעלות תמונה.

גרסה 1.0 אינה משתמשת ב-Google Sign-In ואינה אוספת אסימוני Push. אם יכולות אלו יופעלו בעתיד, המדיניות וטפסי החנויות יעודכנו לפני הפעלתן.

### 1.2 העדפות משתמש

המשתמש יכול לבחור העדפת כשרות לצורך התאמת תוצאות. העדפה זו עשויה להעיד על אמונה או אורח חיים דתי ולכן אנו מתייחסים אליה כאל מידע רגיש. מסירת ההעדפה אינה חובה וניתן לשנות או להסיר אותה מהפרופיל.

### 1.3 מיקום

בהסכמת המשתמש, האפליקציה ניגשת למיקום מדויק או משוער **רק בזמן השימוש באפליקציה** לצורך:

- הצגת מסעדות, בתי כנסת ומניינים קרובים;
- חישוב מרחקים והצגת מפה;
- הפעלת המצפן לכיוון ירושלים;
- השלמת חיפוש המבוסס על “קרוב אליי”.

האפליקציה אינה מבקשת הרשאת מיקום ברקע ואינה משתמשת במיקום לצורכי פרסום או מעקב. גרסה 1.0 אינה שולחת מיקום ל-Hebcal. ניתן לסרב להרשאת המיקום, אך חלק מהיכולות המבוססות על קרבה או מצפן לא יפעלו.

### 1.4 תוכן ופעילות שהמשתמש יוצר

בהתאם לאופן השימוש בשירות, אנו עשויים לשמור:

- פוסטים, תגובות, הודעות, תמונות, סימוני “אהבתי” ותוכן קהילתי;
- מועדפים ורשימת משתמשים חסומים;
- ביקורות, דיווחים על מקומות והצעות להוספת מסעדה או בית כנסת;
- פרטי מניינים והרשמה למניינים;
- הצעות אירוח, בקשות אירוח, צרכי אירוח ושיחות פרטיות הקשורות לאירוח;
- פניות לתמיכה, כולל שם, אימייל, נושא ותוכן הפנייה.

תוכן שמפורסם באזור קהילתי עשוי להיות גלוי למשתמשים אחרים. הודעות פרטיות ותוכן אירוח מוצגים רק לצדדים הרלוונטיים ולמנהלי השירות כאשר הדבר נחוץ לתמיכה, בטיחות, טיפול בדיווח או אכיפת הכללים.

אין להזין באזורים ציבוריים, בחיפושים או בהודעות מידע אישי שאינו נחוץ, כגון מספר זהות, מידע פיננסי או מידע רפואי.

### 1.5 חיפושים ונתוני שיפור השירות

אנו עשויים לשמור את הטקסט שהוזן בחיפוש החכם, הסיווג שהמערכת הסיקה ממנו (לדוגמה: מסעדה, בית כנסת, מניין או אירוח), יעד שזוהה, העדפות חיפוש כגון סוג אוכל או כשרות, התוצאה שנבחרה ונתונים טכניים כמו זמן עיבוד ומקור הסיווג.

רשומות החיפוש אינן נשמרות בטבלת החיפוש יחד עם שם, כתובת אימייל או מזהה המשתמש. עם זאת, טקסט חופשי שהמשתמש עצמו מקליד עלול להכיל מידע אישי; לכן מומלץ שלא להזין מידע אישי או רגיש בשדה החיפוש.

### 1.6 נתוני אבטחה ותפעול

אנו שומרים אירועי אבטחה ותפעול הנחוצים להגנה על החשבונות, לאיתור שימוש לרעה, אבחון תקלות ושמירה על יציבות השירות. אירועים רגילים מזוהים באמצעות מזהה משתמש כאשר קיים. ניסיונות התחברות או איפוס שאינם משויכים לחשבון עשויים להישמר באמצעות טביעת HMAC פסאודונימית של כתובת האימייל, ולא באמצעות כתובת האימייל הגלויה.

## 2. כיצד אנו משתמשים במידע

אנו משתמשים במידע לצורך:

- יצירה, אימות, אבטחה וניהול של חשבונות;
- אספקת תכונות האפליקציה והתאמת תוצאות לבקשת המשתמש;
- הצגת מידע ושירותים יהודיים לפי יעד או מיקום;
- הפעלת אזורי קהילה, מניינים ואירוח;
- שליחת הודעות שירות כגון אימות כתובת אימייל ואיפוס סיסמה;
- מענה לפניות, טיפול בדיווחים ומניעת פגיעה או שימוש לרעה;
- שיפור החיפוש, הביצועים, האמינות וחוויית המשתמש;
- עמידה בדרישות חוקיות ואכיפת תנאי השירות.

איננו מוכרים מידע אישי, איננו מציגים פרסומות מותאמות ואיננו משתמשים במידע לצורך מעקב פרסומי בין אפליקציות או אתרים.

## 3. ספקי שירות ושיתוף מידע

אנו משתפים מידע רק במידה הנדרשת להפעלת השירות, עם הגורמים הבאים:

- **ספקי אחסון ותשתית:** אחסון מסד הנתונים, ה-API ולוגי השרת.
- **Cloudinary:** אחסון ואספקה של תמונות פרופיל ותמונות שהועלו לתוכן הקהילתי.
- **ספק שירות הדואר האלקטרוני המוגדר במערכת:** שליחת קודי אימות, קישורי איפוס סיסמה, הודעות שירות והעברת פניות או דיווחים לצוות.
- **Anthropic:** חלק מדגימות החיפוש החכם עשוי להישלח לעיבוד באמצעות מודל שפה לצורך הבנת החיפוש ושיפורו. הבקשה אינה מצרפת במכוון שם, כתובת אימייל או מזהה משתמש, אך טקסט שהמשתמש הקליד בעצמו עשוי להכיל מידע שהוא בחר להזין.
- **אפליקציות מפה או ניווט חיצוניות:** כאשר המשתמש בוחר לפתוח ניווט, היעד מועבר לאפליקציה החיצונית שנבחרה, והמשך הטיפול כפוף למדיניות שלה.
- **רשויות או גורמים משפטיים:** כאשר הדבר נדרש לפי דין, צו תקף, הגנה על זכויות או בטיחות, או חקירת שימוש לרעה.

ספקי השירות רשאים לעבד מידע רק לצורך מתן השירותים הרלוונטיים ובהתאם להסכמים ולמדיניות שלהם. מידע יכול להיות מעובד במדינות שונות, שבהן דיני הפרטיות עשויים להיות שונים מהדין במדינת המשתמש.

## 4. אבטחת מידע

אנו נוקטים אמצעים טכניים וארגוניים סבירים להגנת המידע, ובכלל זה:

- העברת מידע בין האפליקציה לשרת הייצור באמצעות HTTPS;
- שמירת סיסמאות כ-hash ולא כטקסט גלוי;
- שימוש בטוקנים מוגבלים בזמן לצורכי אימות ואיפוס;
- הגבלת גישה מנהלית למידע;
- שימוש בלוגי אבטחה פסאודונימיים ובמחזור אוטומטי של לוגים.

אין מערכת המאובטחת באופן מוחלט, ולכן איננו יכולים להבטיח שמידע לעולם לא ייחשף, יאבד או ייעשה בו שימוש בלתי מורשה.

## 5. שמירת מידע

- פרטי חשבון ותוכן המשויך לחשבון נשמרים כל עוד החשבון פעיל או כל עוד הם נחוצים להפעלת השירות.
- טקסטי חיפוש ונתוני משוב על החיפוש נשמרים עד 12 חודשים לצורך שיפור החיפוש, ולאחר מכן נמחקים או עוברים אנונימיזציה.
- לוגי אבטחה פסאודונימיים נשמרים עד 90 יום לצורכי אבטחה ומניעת שימוש לרעה.
- טוקנים וקודי אימות זמניים פוקעים בהתאם למטרה שלשמה נוצרו.
- מידע עשוי להישמר לתקופה ארוכה יותר רק כאשר קיימת חובה חוקית, צורך בטיפול במחלוקת או צורך מהותי באבטחה ומניעת הונאה.

## 6. מחיקת חשבון ומידע

ניתן לבקש מחיקת חשבון:

1. מתוך האפליקציה: **פרופיל ← מחיקת חשבון**; או
2. באמצעות הדף הציבורי: **https://jewishontheway.com/delete-account**.

מחיקת החשבון מסירה את החשבון ואת המידע המשויך אליו ממערכות הפעילות, לרבות פרטי הפרופיל, מועדפים, ביקורות ודיווחים, פניות, תוכן קהילתי, נתוני מניינים ואירוח, הודעות ותמונות שהועלו. מחיקת פוסט עשויה להסיר גם תגובות שנכתבו עליו, משום שהן חלק מאותו שרשור.

עותקים שיוריים עשויים להישאר לזמן מוגבל במערכות גיבוי או אצל ספקי תשתית עד למחזור המחיקה הרגיל שלהם. מידע שאנו נדרשים לשמור לפי דין או לצורך אבטחה עשוי להישמר רק לתקופה ולמטרה הנדרשות.

## 7. זכויות ובחירות המשתמש

בהתאם לדין החל, ניתן לבקש:

- לעיין במידע אישי שאנו מחזיקים;
- לתקן מידע לא מדויק דרך הפרופיל או בפנייה אלינו;
- למחוק את החשבון והמידע המשויך אליו;
- לבטל הרשאת מיקום בהגדרות המכשיר;
- להתנגד לעיבוד מסוים או לבקש הגבלת עיבוד, כאשר הדין מעניק זכות זו;
- לקבל מידע נוסף על ספקים או העברות מידע.

ניתן לשלוח בקשה אל **jewishontheway@gmail.com**. ייתכן שנבקש פרטים הנחוצים לאימות זהות המבקש לפני מסירת מידע או ביצוע פעולה בחשבון.

## 8. פרטיות ילדים

השירות אינו מיועד לילדים מתחת לגיל 13 ואיננו אוספים ביודעין מידע אישי מילדים מתחת לגיל זה. אם נודע לנו שמידע כזה נאסף, נפעל למחיקתו. הורה או אפוטרופוס יכול לפנות אלינו בכתובת הדוא״ל המופיעה במדיניות.

## 9. שינויים במדיניות

אנו עשויים לעדכן מדיניות זו בעקבות שינוי באפליקציה, בספקי השירות או בדרישות הדין והחנויות. תאריך העדכון האחרון יוצג בראש המדיניות. כאשר שינוי מהותי משפיע על אופן הטיפול במידע, נמסור הודעה מתאימה באפליקציה או באמצעי סביר אחר.

## 10. יצירת קשר

לשאלות, בקשות או תלונות בנושא פרטיות:

**Jewish On The Way**  
**דוא״ל: jewishontheway@gmail.com**

---

# Jewish On The Way Privacy Policy

**Last updated: July 19, 2026**

Jewish On The Way (the **“App,” “Service,” “we,” “us,”** or **“our”**) respects your privacy. This Privacy Policy explains what information is collected when you use the App, why we use it, with whom it may be shared, how long it is retained, and how you may request access to or deletion of your information.

For privacy questions, contact us at **jewishontheway@gmail.com**.

## 1. Information We Collect

### 1.1 Account and authentication information

When you register or use an account, we may process:

- your first and last name;
- your email address and an internal user identifier;
- your password in one-way hashed form, not as readable text;
- temporary codes and tokens used for email verification, authentication, and password reset; and
- a profile image, if you choose to upload one.

Version 1.0 does not use Google Sign-In and does not collect push notification tokens. If these capabilities are enabled in the future, this Policy and the applicable store disclosures will be updated before they are activated.

### 1.2 User preferences

You may choose a kashrut preference to personalize results. This preference may indicate religious beliefs or practices, so we treat it as sensitive information. Providing it is optional, and you may change or remove it from your profile.

### 1.3 Location

With your permission, the App accesses precise or approximate location **only while you are using the App** to:

- show nearby restaurants, synagogues, and minyans;
- calculate distances and display maps;
- operate the prayer-direction compass toward Jerusalem; and
- complete “near me” searches.

The App does not request background location and does not use location for advertising or tracking. Version 1.0 does not send location to Hebcal. You may deny or revoke location permission, but proximity and compass features may then be unavailable.

### 1.4 Content and activity you provide

Depending on how you use the Service, we may store:

- posts, comments, messages, images, likes, and community content;
- favorites and blocked-user lists;
- reviews, place reports, and restaurant or synagogue suggestions;
- minyan information and registrations;
- hosting offers, hosting needs, hosting requests, and private hosting conversations; and
- support inquiries, including your name, email address, subject, and message.

Content posted in a community area may be visible to other users. Private messages and hosting content are shown only to the relevant participants and to Service administrators when necessary for support, safety, report handling, or rule enforcement.

Do not enter unnecessary personal information—such as government identifiers, financial information, or health information—in public areas, searches, or messages.

### 1.5 Searches and service-improvement data

We may retain the text entered into smart search, classifications inferred from it (for example, restaurant, synagogue, minyan, or hosting), a detected destination, search preferences such as food type or kashrut, a selected result, and technical details such as processing time and classification source.

Search records are not stored in the search-feedback table together with your name, email address, or user identifier. However, free text that you enter may itself contain personal information. You should therefore avoid entering personal or sensitive information in search queries.

### 1.6 Security and operational data

We retain security and operational events needed to protect accounts, detect abuse, diagnose failures, and maintain Service reliability. Ordinary account events are identified by an internal user identifier where available. Login or reset attempts that cannot be associated with an account may be recorded using a pseudonymous HMAC fingerprint of the email address rather than the readable email address.

## 2. How We Use Information

We use information to:

- create, verify, secure, and administer accounts;
- provide App features and tailor results to your request;
- show Jewish information and services based on a destination or location;
- operate community, minyan, and hosting features;
- send service messages such as email verification and password-reset messages;
- respond to requests, review reports, and prevent harm or abuse;
- improve search, performance, reliability, and user experience; and
- comply with legal obligations and enforce our terms.

We do not sell personal information, serve personalized advertising, or use information for cross-app or cross-site advertising tracking.

## 3. Service Providers and Sharing

We share information only as needed to operate the Service, including with:

- **Hosting and infrastructure providers:** to host the database, API, and server logs.
- **Cloudinary:** to store and deliver profile images and images uploaded to community content.
- **The email service provider configured for the Service:** to send verification codes, password-reset links, service messages, and forward support inquiries or reports to our team.
- **Anthropic:** a sample of smart-search queries may be processed by a language model to understand and improve search. We do not intentionally attach your name, email address, or user identifier to the request, but text you enter may contain information you choose to include.
- **External map or navigation applications:** when you choose to open navigation, the selected destination is sent to that application, and its handling is governed by its own privacy policy.
- **Authorities or legal recipients:** when required by applicable law, a valid legal request, protection of rights or safety, or investigation of abuse.

Service providers may process information only to provide the relevant services and under their applicable agreements and policies. Information may be processed in countries whose privacy laws differ from those in your country.

## 4. Data Security

We use reasonable technical and organizational measures designed to protect information, including:

- transmitting information between the App and the production server using HTTPS;
- storing passwords as hashes rather than readable text;
- using time-limited authentication and reset tokens;
- limiting administrative access to information; and
- using pseudonymous security logs and automated log rotation.

No system is completely secure, and we cannot guarantee that information will never be disclosed, lost, or accessed without authorization.

## 5. Data Retention

- Account information and account-related content are retained while the account is active or as needed to provide the Service.
- Search text and search-feedback data are retained for up to 12 months to improve search and are then deleted or anonymized.
- Pseudonymous security logs are retained for up to 90 days for security and abuse prevention.
- Temporary verification codes and tokens expire according to the purpose for which they were created.
- Information may be retained longer only where required by law, needed to resolve a dispute, or materially necessary for security or fraud prevention.

## 6. Account and Data Deletion

You may request account deletion:

1. in the App under **Profile → Delete Account**; or
2. through **https://jewishontheway.com/delete-account**.

Deleting your account removes the account and associated information from active systems, including profile information, favorites, reviews and reports, support inquiries, community content, minyan and hosting data, messages, and uploaded images. Deleting a post may also remove replies posted to that thread because they form part of the same conversation.

Residual copies may remain temporarily in backups or service-provider systems until their normal deletion cycle is completed. Information that must be retained by law or for security may be retained only for the required purpose and period.

## 7. Your Rights and Choices

Depending on applicable law, you may request to:

- access personal information we hold about you;
- correct inaccurate information through your profile or by contacting us;
- delete your account and associated information;
- revoke location permission through your device settings;
- object to or restrict certain processing where the law provides that right; and
- receive further information about service providers or data transfers.

Send requests to **jewishontheway@gmail.com**. We may ask for information reasonably necessary to verify your identity before disclosing information or acting on an account.

## 8. Children's Privacy

The Service is not directed to children under 13, and we do not knowingly collect personal information from children under 13. If we learn that such information has been collected, we will take steps to delete it. A parent or guardian may contact us using the email address in this Policy.

## 9. Changes to This Policy

We may update this Policy when the App, our providers, or legal and store requirements change. The “Last updated” date will appear at the top. If a material change affects how information is handled, we will provide an appropriate notice in the App or by another reasonable method.

## 10. Contact Us

For privacy questions, requests, or complaints:

**Jewish On The Way**  
**Email: jewishontheway@gmail.com**
