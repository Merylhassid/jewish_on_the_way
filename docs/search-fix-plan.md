# תוכנית עבודה — תיקון החיפוש (משולב Claude + Codex)

מבוסס על שני דוחות של 1000 שאילתות מול פרודקשן. מטרה: לחזק את המסלול הדטרמיניסטי (fast/legacy) **לפני** הפעלת LLM live.

## עקרונות
1. **בעל-בית יחיד** — כדי לא להתנגש על אותם קבצים.
2. **דטרמיניסטי קודם**, LLM אחר כך (הסכמת שני הדוחות).
3. כל שלב: `npx jest` נשאר ירוק (177+), הוספת טסטים, ואז מדידה מול 1000 השאלות.
4. **scoreboard אובייקטיבי:** להריץ 1000 לפני/אחרי ולמדוד Category/Destination/Result.
5. אין push לגיט (המשתמש בלבד); פריסה לשרת אחרי שהכל ירוק.

## מבנה-על: intent priority (backbone של Codex)
סדר הכרעה קשיח:
```
1. explicit food dish            → restaurant
2. explicit minyan / prayer      → minyan
3. explicit synagogue/chabad/shul→ synagogue
4. explicit hosting/family/shabbat-stay → hosting
5. destination only              → destination
6. conflicting / ambiguous       → unknown (בקשת הבהרה, לא ניחוש)
```
חריגים:
- "בית כנסת עם מניין" → **synagogue** (המקום הוא הראש).
- "מניין ... בבית כנסת" → **minyan** (התפילה היא הראש).

---

## שלבים

### שלב 0 — נעילת רגרסיות (קודם כל)
הוספת כל דוגמאות-הכשל משני הדוחות ל-`backend/src/ai/evals/search-eval.jsonl` + טסטים ב-`search.controller.spec.ts`.
נועלים את ההתנהגות הרצויה לפני שנוגעים בקוד.

### שלב 1 — Minyan intent (P0, ~74 מקרים) 🔴
- `search.controller.ts`: `containsMinyanExplicitTerm` — מניין/מנין/מניינים + שחרית/מנחה/ערבית/מוסף/נץ/ותיקין/תפילה + אנגלית (minyan/minyn/shacharit/mincha/maariv/prayer).
- שילוב ב-override לפי הסדר: food > minyan > synagogue > hosting.
- כלל "בית כנסת עם מניין" → synagogue.
- **אימות:** טסטים ל-12 שאילתות מניין (עברית+אנגלית+near-me).

### שלב 2 — near-me guardrail גלובלי + explicit-dest-wins (P0) 🔴
- מזהה near-me מורחב (עברית+אנגלית): לידי, קרוב אלי/אליי, קרוב, באזור/באזור שלי, ליד הבית, פה, כאן, near me, around me, nearby, close to me.
- **כלל:** אם יש near-me ואין יעד מפורש → GPS. אם אין GPS → הודעת "צריך מיקום", **לא** יעד אקראי ו**לא** fail-closed.
- **explicit destination wins:** אם נפתר יעד מפורש — הוא קובע; GPS רק למרחקים. (הבאג המקורי + ממצא Codex.)
- **אימות:** "פיצה קרוב אלי", "מנין לידי", "אני בתל אביב אבל רוצה חומוס בבית שמש".

### שלב 3 — Hosting intent (P1, ~28) 🟠
- הרחבת `containsHostingSignal`: ארוחת שבת, ליל שבת, סעודה שלישית, סעודת שבת, אצל משפחה, משפחה מארחת + אנגלית (shabbat hosting, host family, where to stay for shabbat, shabbat meal with family).
- זהירות: "ארוחת ערב" (לא-שבת) נשאר restaurant.
- **אימות:** "ארוחת שבת בחולון", "להתארח אצל משפחה", "shabbat hosting".

### שלב 4 — ריכוך fail-closed + כיסוי מילים (P2, ~107) 🟠
- אם קטגוריה זוהתה בביטחון ואין עיר → GPS/כללי במקום `destination_not_found`. fail-closed נשאר רק לשם-מקום מפורש שלא נפתר.
- הרחבת כיסוי מנות/מטבחים — עדיף **להזרים מ-`food-relations`** במקום רשימה כפולה (לזניה, מקסיקני, פרגית, אנטריקוט, קובה...).
- **אימות:** "מסעדה מקסיקני עם ילדים", "לזניה קרוב אליי" → restaurant, לא שגיאה.

### שלב 5 — synagogue בשאילתות מורכבות (P2) 🟠
- לוודא ש-synagogue ננעל גם עם: near-me, "עם מניין", chabad/shul/synagoge, ומשפטים באנגלית.
- **אימות:** "synagogue in Tel Aviv", "find chabad synagogue near me", "בית כנסת עם מניין בפראג".

### שלב 6 — typo/fuzzy רחב (P3) 🟡
- שכבת נורמליזציה לפני סיווג, עברית+אנגלית+קולינרי, עם Levenshtein מבוקר על מילוני domain (אוכל/תפילה/בית כנסת/אירוח). לתקן רק כשקרוב מאוד ותואם domain word.
- דוגמאות: synagoge→synagogue, minyn→minyan, hambuger→hamburger, humus→חומוס, שוארמה, קפא→קפה, פסתה→פסטה, סוש→סושי.

### שלב 7 — unknown/ambiguous fail-safe (P3) 🟡
- שאילתות סותרות ("בית כנסת או מסעדה", "להתארח או לאכול") → unknown/בקשת הבהרה במקום ניחוש בביטחון.

### שלב 8 — מדידה + פריסה
- `npx jest` ירוק, הרצת 1000 לפני/אחרי (בעדינות, למניעת rate-limit), יעד: Category 791→930+, Destination 851→950+.
- build נקי + פריסה לשרת + אימות marker.

### שלב 9 (נפרד, אחרי routing) — zero-results audit
רק אחרי ש-routing תקין: למדוד zero-results (268 אצל Codex) כדי להפריד **באג פילטרים** מ**חוסר דאטה**. לא לפני.

---

## סדר ביצוע בפועל
0 (טסטים) → 1 (מניין) → 2 (near-me+explicit-dest) → 3 (אירוח) → 5 (synagogue מורכב) → 4 (fail-closed+מילים) → 6 (typo) → 7 (ambiguous) → 8 (מדידה+פריסה) → 9 (zero-results, בהמשך).
