# תוכנית עבודה — שדרוג החיפוש החכם ל-"Jewish On The Way"

> מסמך ביצוע עבור סוכן קוד (Claude Code). קרא את כל המסמך לפני שתתחיל.
> **עיקרון על:** ה-LLM הוא **מתרגם** משפה חופשית לחוזה חיפוש קשיח — לא מנוע, ולא מקבל החלטות על IDs/קיום ערים. מנוע החיפוש הקיים נשאר; הוא רק מקבל הוראות נקיות ומובנות.

---

## 0. רקע — הארכיטקטורה הקיימת (אל תשבור אותה)

| שכבה | קובץ | מה עושה היום |
|------|------|--------------|
| סיווג קטגוריה | `backend/src/ai/classifier.service.ts` | TF-IDF + Naive Bayes מאפס (`model.json`). מסלול מהיר. |
| חילוץ type/kashrut/keyword | `backend/src/ai/search-classifier.service.ts` | regex rule-based |
| הבנת מנה → tags | `backend/src/restaurants/food-relations.ts` | מילון ידני (keyword → searchTags) |
| זיהוי יעד | `backend/src/ai/destination-index.service.ts` | alias index + Levenshtein + GPS nearest |
| נקודת כניסה | `backend/src/ai/search.controller.ts` | `POST /search` (ניתוב) + `GET /restaurants/search` |
| מנוע חיפוש | `backend/src/restaurants/restaurants.service.ts` | `smartSearch()` — tiers + PostGIS + supplementOrigin/displayOrigin |
| לוג feedback | `backend/src/ai/search-feedback.entity.ts` | שמירת שאילתות + קליקים (לא בשימוש לדירוג) |

DB: PostgreSQL על Neon (תומך PostGIS + pgvector). Backend: NestJS, פורט 3001.

**עקרונות מנחים (לא לסטות מהם):**
1. ה-LLM מחזיר `destinationText` בלבד — **ה-resolver הקיים שלכם** הופך אותו ל-`destinationId`. ה-LLM לא ממציא IDs ולא מחליט שעיר קיימת.
2. **Fail closed:** אם המודל לא בטוח / נכשל / timeout — לא להביא תוצאות ממיקום אקראי. נופלים ל-fallback הקיים.
3. אל תמחק את ה-TF-IDF, את ה-regex, או את `food-relations` — הם הופכים לרשת ביטחון/מסלול מהיר.
4. **כלום לא עולה לפרודקשן בלי לעבור את ה-eval set.**
5. כל שינוי חייב לשמור על מעבר 144 הטסטים הקיימים (`npx jest`).

**Non-goals (לא בתוכנית הזו):** אפליקציית מובייל (החיפוש הוא backend; ה-app כבר שולח GPS וקורא `distanceMeters`). אין שינוי schema של תוצאות ה-API שה-app מקבל.

---

## 1. החוזה — סכמת ה-JSON המובנה

זהו הפלט היחיד שה-LLM Parser מחזיר. הגדר אותו כ-TypeScript type + zod schema לוולידציה.

```ts
interface ParsedQuery {
  category: 'restaurant' | 'synagogue' | 'minyan' | 'hosting' | 'destination' | 'unknown';
  categoryConfidence: number;          // 0..1 — אות חלש בלבד, לא gate (ראה §2)
  destinationText: string | null;      // טקסט גולמי של העיר/יעד; ה-resolver פותר אותו
  explicitDestination: boolean;        // המשתמש ציין יעד מפורש?
  useCurrentLocation: boolean;         // "לידי" / "near me" / אין יעד אך יש כוונת קרבה
  queryText: string | null;            // הטקסט הנקי לחיפוש שם (keyword), בלי עיר/סוג/כשרות
  restaurant: {
    dish: string | null;              // "pizza", "sushi"...
    cuisine: string | null;           // "italian", "asian"...
    type: 'meat' | 'dairy' | 'pareve' | null;
    kashrut: 'rabbinate' | 'mehadrin' | 'badatz' | null;
    priceLevel: 'cheap' | 'moderate' | 'expensive' | null;
  };
  synagogue: {
    denomination: 'ashkenaz' | 'sfarad' | 'chabad' | 'teimanim' | null;
  };
  hosting: {
    shabbat: boolean | null;
    mealOrStay: 'meal' | 'stay' | 'either' | null;
  };
}
```

**כללי קדימות (כדי למנוע סתירות):**
- אם `dish` קיים — הוא קובע; `cuisine` משני; `type` נגזר רק אם אין dish/cuisine.
- ה-LLM **לא** מיישב dish→type. ה-resolver/`food-relations` עושה זאת (pizza→dairy).
- `category='unknown'` ⇒ fail closed (אין תוצאות ממיקום אחר; להחזיר הודעת הבהרה).

**כללי הניתוב הקריטיים (אחרי הפענוח, בקוד שלכם — לא ב-LLM):**
- `explicitDestination=true` ⇒ מחפשים **רק** ביעד הזה (או בקרבתו דרך supplement). GPS משמש רק לתצוגת מרחקים (`displayOrigin`).
- `useCurrentLocation=true` ואין יעד ⇒ GPS מוצא יעד קרוב (`findNearestDestination` הקיים).
- שניהם קיימים ⇒ **היעד קובע תוצאות**, GPS רק מרחקים. (זה בדיוק העיקרון של `supplementOrigin`/`displayOrigin` שכבר קיים.)

---

## 2. בחירת ספק ומודל

- **מומלץ:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — מהיר, זול, מספיק חכם לסיווג. JSON קשיח דרך **tool-use** (`input_schema`).
- חלופות לגיטימיות: OpenAI Structured Outputs, Gemini. התכנון אגנוסטי לספק.
- **חובה בכל מקרה:**
  - `temperature = 0`
  - מנגנון פלט מובנה (tool-use / structured outputs) — לא regex על טקסט חופשי.
  - **ולידציה של הפלט מול ה-zod schema גם** כשה-API מבטיח מבנה (defense in depth).
  - `timeout` ~1500ms → נפילה ל-fallback.
  - מפתח API ב-`.env` בלבד (ראה §10 אבטחה).
- **categoryConfidence לא מכויל** — אל תגזור החלטות לפיו. גזור ביטחון מאותות חיצוניים: האם ה-resolver מצא יעד? האם ה-TF-IDF הסכים?

---

## פאזה 0 — תשתית מדידה (חובה ראשונה, לפני כל שינוי לוגיקה)

**מטרה:** סרגל מדידה. בלי זה אי אפשר לדעת אם משהו השתפר.

### 0.1 בניית eval set מדאטה אמיתי
- משוך מ-`SearchFeedback` את 200 השאילתות הנפוצות/מגוונות ביותר (`query` column). כולל המוזרות והשגיאות.
- צור `backend/src/ai/evals/search-eval.jsonl` — שורה לכל מקרה:
  ```jsonc
  {"query":"פיצה במיאמי","expected":{"category":"restaurant","destinationText":"מיאמי","explicitDestination":true,"restaurant":{"dish":"pizza","type":"dairy"}}}
  ```
- הוסף ידנית ~30 מקרי קצה: `להתארח בעפולה`, `מניין שחרית בפריז`, `בית כנסת חבד בלונדון`, `מסעדה בשרית זולה ליד הים בתל אביב`, `sushi near me`, `איפה אפשר לאכול`, `פיצריה בירשלים` (שגיאת כתיב), `שבת בלונדון`.
- שדות לבדיקה לכל מקרה: `category`, `explicitDestination`, `useCurrentLocation`, `destinationText` (אחרי resolve → destinationId), ושדות restaurant/synagogue רלוונטיים.

### 0.2 Runner
- `backend/src/ai/evals/run-eval.ts` — מריץ את כל המקרים דרך ה-parser, משווה שדה-שדה ל-expected, ומדפיס:
  - דיוק לכל שדה בנפרד (category accuracy, destination accuracy, type accuracy...).
  - רשימת הכשלונות עם diff.
  - ציון כולל.
- פקודה: `npm run eval:search`.

### 0.3 הרחבת טלמטריה
- הרחב את `SearchFeedback` (migration) בשדות: `parsedJson` (jsonb), `parserVersion` (text), `resolvedDestinationId` (int), `modelName` (text), `latencyMs` (int), `source` ('fast'|'llm'|'fallback'|'cache').
- ודא ש-`POST /restaurants/search/feedback` הקיים ממשיך לקשר קליק לשאילתה.

**Acceptance:** `npm run eval:search` רץ על המערכת הנוכחית ומדפיס baseline. הטלמטריה נשמרת ב-DB. 144 הטסטים עוברים.

---

## פאזה 1 — LLM Parser ב-Shadow Mode

**מטרה:** להריץ את ה-parser החדש **במקביל** לישן בפרודקשן בלי להשפיע על משתמשים.

### 1.1 השירות
- `backend/src/ai/query-parser.service.ts`:
  - `parse(text, opts): Promise<ParsedQuery>`
  - מסלול היברידי:
    1. **Cache** (LRU בזיכרון, key = normalized query) → אם hit, החזר.
    2. **fast path** — TF-IDF + regex הקיימים. אם הביטחון גבוה **ואין** אותות עמומים → בנה ParsedQuery ממנו, `source='fast'`.
    3. אחרת → **LLM** (Haiku, tool-use, schema, temp=0, timeout). ולידציה ב-zod. שמור ל-cache. `source='llm'`.
    4. אם ה-LLM נכשל/timeout/ולידציה נכשלה → **fallback** ל-fast path. `source='fallback'`.
  - נרמול cache key: lowercase, trim, collapse spaces, הסרת ניקוד/גרשיים (השתמש ב-`normalizeDestinationText` הקיים כבסיס).

### 1.2 אותות "צריך LLM" (החלף את היוריסטיקת ה-`ב`/`ליד`)
> אזהרה: **אל** תנתב לפי נוכחות האות `ב` — היא תחילית של חצי השפה (בתל אביב / בשרי / בוקר), רועשת מדי.
נתב ל-LLM אם מתקיים אחד:
- אורך השאילתה > 3 מילים.
- ה-TF-IDF החזיר confidence נמוך (סף לכיול לפי baseline).
- זוהה יעד-אך-עמום (fuzzy match גבולי).
- יש סתירה בין fast path ל-resolver.

### 1.3 Shadow wiring
- ב-`POST /search` הקיים: המשך להגיש מהמסלול הישן. **במקביל** (לא חוסם, `void ... .catch()`) הרץ את `query-parser` ושמור את הפלט + השוואה ל-DB (`parsedJson`, `parserVersion='shadow-v1'`).
- אל תשנה את ה-route/response שה-app מקבל בפאזה הזו.

**Acceptance:** ה-parser רץ ב-shadow על תנועה אמיתית. `npm run eval:search` על ה-parser החדש מראה דיוק ≥ baseline (יעד: category ≥95%, destination ≥97%, explicitDestination ≥98%). דוח השוואת shadow זמין. 144 טסטים עוברים. אין רגרסיית latency במסלול המשתמש (כי ה-LLM לא חוסם).

---

## פאזה 2 — החלפת ה-Parser ל-Live

**מטרה:** ברגע שה-eval + shadow נקיים — להפעיל את ה-parser החדש בפועל.

### 2.1 חיווט
- `POST /search` ו-`GET /restaurants/search` משתמשים ב-`query-parser.service` כמקור האמת.
- הזרם את `ParsedQuery` למנוע הקיים:
  - `destinationText` → `resolveDestinationFromText` / `fuzzyMatch` (הקיימים) → `destinationId`.
  - `restaurant.dish/cuisine` → `lookupFoodRelation` (הקיים) → tags.
  - `type`/`kashrut` → פרמטרים ל-`smartSearch`.
  - כללי הניתוב מ-§1 (explicitDestination / useCurrentLocation).
- שמור `parserVersion='v1'` בטלמטריה.

### 2.2 Feature flag + rollback
- דגל `SMART_SEARCH_PARSER` ב-`.env` (`legacy`|`v1`). ברירת מחדל `v1` רק אחרי ש-eval ירוק. אם משהו נשבר — להחזיר ל-`legacy` בלי deploy.

**Acceptance:** משתמשים אמיתיים על ה-parser החדש. "פיצה במיאמי" → תוצאות ממיאמי בלבד. "sushi near me" → GPS. fail-closed עובד על `unknown`. 144 טסטים + eval ירוקים.

---

## פאזה 3 — מילוי כיסוי ה-Tags (דאטה, לא אלגוריתם)

**מטרה:** הקפיצה הכי גדולה באיכות שכבה 2 — ~3,889 מסעדות לא מתויגות.

### 3.1 Job offline
- סקריפט `backend/scripts/enrich-restaurant-tags.ts`:
  - עובר על מסעדות עם `tags` ריק/חסר.
  - לכל מסעדה: קריאת LLM (batch, חסכוני) שמחזירה `{ tags[], cuisine, type, priceLevel, description }` לפי שם+כתובת+קטגוריה קיימת.
  - **merge בלי מחיקה** של תיוג קיים (כמו מדיניות התיוג הקיימת). רק תגים בטוחים.
  - rate-limit + resume (שמור התקדמות).
- הרץ idempotent; ניתן להריץ שוב על חדשות בלבד.

### 3.2 אינדקסים
- ודא: GIN על `tags`, GiST על `location` (PostGIS), והפעל `pg_trgm` + אינדקס trigram על `name` ל-ILIKE מטושטש.

**Acceptance:** אחוז המסעדות המתויגות עולה משמעותית. שאילתות "italian"/"בשרי זול" מחזירות יותר תוצאות רלוונטיות. eval מראה שיפור ב-recall.

---

## פאזה 4 — Ranking משוקלל + Feedback Loop

**מטרה:** לסדר תוצאות לפי התאמה אמיתית, לא רק מרחק. **בלי ML — נוסחה מכוילת ביד.**

### 4.1 ציון משוקלל
- ב-`smartSearch`, אחרי איסוף המועמדים, דרג לפי ציון משולב:
  ```
  score = w1*textRelevance + w2*proximity(user GPS) + w3*tagMatch + w4*clickScore - penalty(kashrut mismatch)
  ```
- `proximity` תמיד מ-`displayOrigin` (GPS המשתמש) — לא מהיעד.
- התחל במשקלים ידניים; כייל מול ה-eval.

### 4.2 שימוש ב-feedback הקיים
- `clickScore` = כמה פעמים מסעדה נלחצה בשאילתות דומות (מ-`SearchFeedback`). חישוב offline/מתעדכן תקופתית, לא בזמן אמת.

**Acceptance:** התוצאה הנלחצת ביותר היסטורית עולה בדירוג. eval עם מדד "click@1/click@3" משתפר. הסדר ההגיוני נשמר (מקומי לפני supplement).

---

## פאזה 5 (אופציונלי, אחרי ההשקה) — Embeddings / pgvector

> בצע **רק** אם ה-eval מראה פער אמיתי בשאילתות סמנטיות שפאזות 1–4 לא פתרו. אל תתחיל מכאן.

- הפעל `pgvector` ב-Neon. עמודת `embedding vector(N)` על `restaurants`.
- חשב embedding offline (שם+קטגוריה+tags+description). hybrid retrieval: שילוב cosine similarity + keyword/tag + PostGIS distance, ואז re-rank של פאזה 4.

**Acceptance:** שאילתות סמנטיות ("מקום רומנטי לדייט") מחזירות תוצאות טובות; eval מאשר שיפור מעל פאזה 4 לבדה.

---

## 6. אסטרטגיית טסטים
- **Unit:** `query-parser` עם LLM ממוק — קלט→ParsedQuery לכל קטגוריה, כללי קדימות, fail-closed, timeout→fallback.
- **Schema:** ולידציית zod דוחה פלט לא חוקי.
- **Regression:** כל 144 הטסטים הקיימים ממשיכים לעבור בכל פאזה.
- **Eval:** `npm run eval:search` הוא gate ל-merge בכל פאזה.
- **No-network בטסטים:** ממק את ה-LLM; אסור קריאת רשת אמיתית בטסטים.

## 7. Versioning
- כל פלט parser נשמר עם `parserVersion` + `modelName`. כששינוי prompt/schema — bump גרסה, הרץ replay על ה-eval, diff מול הגרסה הקודמת.

## 8. Cache & עלות
- LRU בזיכרון (התחלה), key = normalized query, TTL ארוך (כוונת חיפוש יציבה). Redis בהמשך אם צריך.
- יעד: 80%+ מהשאילתות נענות מ-cache/fast path → עלות LLM שברירית.
- ניטור: ספירת `source` (fast/llm/cache/fallback) + עלות מצטברת.

## 9. Rollout & Monitoring
- סדר: פאזה 0 → 1 (shadow) → השוואה → 2 (flag) → 3 → 4. כל מעבר מותנה ב-eval ירוק.
- ניטור פרודקשן: latency p95 של `/search`, שיעור fallback, שיעור `unknown`, עלות LLM יומית.
- Rollback: feature flag `SMART_SEARCH_PARSER=legacy` בלי deploy.

## 10. אבטחה (תנאי סף ל-App Store)
- מפתח LLM API ב-`.env` בלבד; ודא `.env` ב-`.gitignore`.
- **קריטי נפרד:** מחרוזת החיבור ל-Neon וסיסמת האדמין מופיעות כיום ב-`CLAUDE.md` שמקומיט ל-git → **לסובב (rotate) ולהוציא מהריפו** לפני פרודקשן.
- prompt injection: הפלט מוגבל לסכמה ואף פעם לא מורץ כקוד → בטוח. ולידציה תמיד.
- rate-limit על `/search` כדי למנוע ניצול עלות LLM.

---

## 11. Definition of Done
- [ ] eval set (200+ שאילתות אמיתיות) + runner + baseline.
- [ ] `query-parser.service` היברידי (cache→fast→LLM→fallback) עם zod + timeout.
- [ ] Shadow mode רץ ונמדד; דיוק ≥ יעדים.
- [ ] Parser live מאחורי feature flag; "פיצה במיאמי" לא מחזיר תוצאות מישראל.
- [ ] כללי explicitDestination/useCurrentLocation מיושמים; מרחקים תמיד מ-GPS המשתמש.
- [ ] tag coverage מולא (job offline) + אינדקסים (GIN/GiST/pg_trgm).
- [ ] ranking משוקלל משתמש ב-feedback; click@1/3 משתפר.
- [ ] 144 טסטים + eval ירוקים; טלמטריה + versioning פעילים.
- [ ] (אופציונלי) embeddings רק אם eval דרש.

---

### הערות ביצוע לסוכן
1. **אל תתחיל מקוד** — התחל מפאזה 0 (eval). בלי סרגל מדידה אין דרך לדעת אם שיפרת.
2. עבוד פאזה-פאזה; אל תקפוץ קדימה. כל פאזה עצמאית וניתנת ל-merge.
3. אל תמחק את ה-TF-IDF / regex / food-relations — הם fallback.
4. שמור על תאימות ה-API ל-app הקיים (אותם שדות תשובה).
5. הרץ `npx jest` ו-`npm run eval:search` לפני כל commit.
