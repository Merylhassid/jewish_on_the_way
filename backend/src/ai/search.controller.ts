/**
 * SearchController
 * ================
 * Endpoint: POST /search
 *
 * Pipeline של שני מודלים:
 *   Model 1 (ClassifierService)      → קטגוריה (restaurant/synagogue/minyan/hosting)
 *   Model 2 (DenominationClassifier) → נוסח    (ashkenaz/sfarad/chabad/teimanim)
 *                                       רלוונטי רק כשקטגוריה = synagogue/minyan
 */

import { Body, Controller, Get, Logger, Optional, Post, Query } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, MaxLength, MinLength } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassifierService } from './classifier.service';
import { DenominationClassifierService } from './denomination-classifier.service';
import { Destination } from '../destination.entity';
import { SearchFeedback } from './search-feedback.entity';
import { DestinationIndexService } from './destination-index.service';
import { QueryParserService } from './query-parser.service';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';

// Re-export pure helpers so existing imports (e.g. in tests) continue to work
export {
  normalizeDestinationText,
  buildDestinationCandidates,
  detectCountryInText,
} from './destination-index.service';

import {
  buildDestinationCandidates,
  detectCountryInText,
  DESTINATION_STOP_WORDS,
  levenshtein,
  normalizeDestinationText,
} from './destination-index.service';
import { lookupFoodRelationMatch } from '../restaurants/food-relations';

class SearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  text!: string;

  @IsOptional()
  @IsNumber()
  destinationId?: number;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}

// מילות מפתח לסוג מסעדה וכשרות
const RESTAURANT_TYPE_KEYWORDS: Record<string, string> = {
  'בשרי':'meat','בשרית':'meat','בשר':'meat','meat':'meat',
  'חלבי':'dairy','חלבית':'dairy','חלב':'dairy','dairy':'dairy','milky':'dairy',
  'פרווה':'parve','פרוה':'parve','parve':'parve','pareve':'parve',
  // Hebrew food terms → type
  'המבורגר':'meat','בורגר':'meat','שווארמה':'meat','סטייק':'meat',
  'שניצל':'meat','קבב':'meat','אסאדו':'meat','עוף':'meat','מנגל':'meat',
  'פיצה':'dairy','פסטה':'dairy','קפה':'dairy','גלידה':'dairy',
  'סושי':'parve','דגים':'parve','פלאפל':'parve','חומוס':'parve','טבעוני':'parve',
  // English food terms → type
  'burger':'meat','hamburger':'meat','steak':'meat','grill':'meat','shawarma':'meat','chicken':'meat',
  'pizza':'dairy','pasta':'dairy','cafe':'dairy','coffee':'dairy',
  'sushi':'parve','fish':'parve','falafel':'parve','hummus':'parve','vegan':'parve',
};

// Hebrew terms that must route to restaurant — food items + explicit category words
// (ML model misclassifies "מסעדה ב[city with בית]" as synagogue because of the "בית" prefix)
const HEBREW_FOOD_TERMS = new Set([
  // Specific food items
  'פיצה','המבורגר','בורגר','שווארמה','סושי','קפה','גלידה',
  'פלאפל','חומוס','סטייק','שניצל','דגים','פסטה','קבב','אסאדו',
  'בורקס','וופל','לאזניה','עוף','מנגל',
  'שוקולד','ממתקים','מתוקים','עוגיות','מאפה','מאפים','קרואסון','בייגל','סנדוויץ','נודלס',
  'חלה','פיתה','לחם','גבינה','יוגורט','שקשוקה','חביתה','אומלט',
  'ריזוטו','ניוקי','קארי','ראמן','פוקה','טאקו','בוריטו','נאן',
  'מרק','תבשיל','אורז','קינוח','קינוחים','מנה','מנות','ארוחות',
  // Generic food/meal words
  'בשר','סלט','עוגה','אוכל','לאכול','ארוחה','ארוחת','מטבח',
  // Dietary types
  'טבעוני','טבעונית','צמחוני','צמחונית','גלוטן',
  // Restaurant type keywords
  'בשרי','בשרית','חלבי','חלבית','פרווה','פרוה',
  // Restaurant category words
  'מסעדה','מסעדת','מסעדות',
  // Common typos / informal variants
  'פיצריה','שוארמה','המברגר','שניצלון','בורגרים','פלאפלים','סטייקהאוס','שינצל',
  // Bakery — query terms (not just name patterns)
  'מאפייה','מאפיה','מאפיית',
  // Missing food query terms
  'קציצות','קציצה','פריקסה','בגט','יין',
  // Additional dishes + cuisines found missing in the 1000-query audit.
  // Being a food term both routes to restaurant AND excludes the word from being treated
  // as an (unresolvable) destination → no false "destination_not_found".
  'לזניה','פרגית','פרגיות','אנטריקוט','קובה','מעורב','קוסקוס','מגדרה',
  'גחנון','מלאווח','מלבי','כנאפה','בקלאווה','קלאווה','סביח','לאפה',
  'פנקייק','פנקייקים','טוסט','טוסטים','קרפ','קרפים','ופל',
  'איטלקי','אסייתי','סיני','יפני','תאילנדי','מקסיקני','אמריקאי','צרפתי','טורקי','לבנוני','עיראקי','מזרחי','אירופאי',
]);

// English food/restaurant terms the ML model may misclassify
const ENGLISH_FOOD_TERMS = new Set([
  'burger','hamburger','steak','pizza','sushi','grill','bbq','shawarma','kebab',
  'falafel','hummus','chicken','pasta','cafe','coffee','bakery','fish','vegan',
  'salad','restaurant','food','dairy','meat','pareve',
  'eat','dinner','breakfast','lunch','brunch','vegetarian','schnitzel','waffle',
  'kosher','ice','seafood','noodles','spaghetti','lasagna','risotto',
  'bagel','sandwich','dessert','cookie','croissant','donut','taco','burrito',
  'ramen','curry','soup','sushi','chocolate','cake','asian','italian','chinese',
  'thai','indian','japanese','mediterranean','gourmet','bistro','deli','gelato',
]);

function containsFoodTerm(text: string): boolean {
  const lower = text.toLowerCase();
  if ((lower.match(/[א-ת]+/g) ?? []).some((w: string) => HEBREW_FOOD_TERMS.has(w) || Boolean(lookupFoodRelationMatch(w)))) return true;
  if ((lower.match(/[a-z]+/g) ?? []).some((w: string) => ENGLISH_FOOD_TERMS.has(w) || Boolean(lookupFoodRelationMatch(w)))) return true;
  return false;
}

// Force synagogue only when "בית כנסת" is written explicitly.
// Denomination words alone (ספרדי, חב"ד) should not override the ML model —
// "מניין שחרית ספרדי" is still a minyan, the model handles denomination context.
function containsSynagogueExplicitTerm(text: string): boolean {
  if (/בית\s+גנסת/.test(text)) return true;
  if (/בית\s+כנס(?:ת)?/.test(text)) return true;
  if (/בתי\s+כנסת/.test(text) || /בתי\s+כנסיות/.test(text)) return true;
  if (/בית\s+כנסת/.test(text)) return true;
  if (/בית\s+חב(?:["׳']?ד|ד)/.test(text) || /בתי\s+חב/.test(text)) return true; // בית חב"ד / בית חבד
  if (/\b(?:synagogue|synagoge|synagog|shul|chabad)\b/i.test(text)) return true;
  return false;
}

// ── Minyan / prayer intent ────────────────────────────────────────────────
// The ML model tends to misclassify minyan queries as restaurant, and there was
// no explicit override for "מניין" (only for "בית כנסת"). Two tiers:
//   strong = the word מניין/minyan itself; weak = a prayer-time word.
function hasStrongMinyanTerm(text: string): boolean {
  if (/(?:^|[\s,.;:!?])(?:מניין|מנין|מניינים|מנינים)(?:$|[\s,.;:!?])/.test(text)) return true;
  if (/\b(?:minyan|minyn|minyen)\b/i.test(text)) return true;
  return false;
}
function hasPrayerTimeTerm(text: string): boolean {
  if (/(?:^|[\s,.;:!?])(?:שחרית|מנחה|מעריב|ערבית|מוסף|ותיקין|תפילה|תפילת)(?:$|[\s,.;:!?])/.test(text)) return true;
  if (/(?:^|[\s,.;:!?])נץ(?:$|[\s,.;:!?])/.test(text)) return true;
  if (/\b(?:shacharit|shaharit|mincha|maariv|arvit|davening|pray|prayer)\b/i.test(text)) return true;
  return false;
}
function containsMinyanTerm(text: string): boolean {
  return hasStrongMinyanTerm(text) || hasPrayerTimeTerm(text);
}
// "בית כנסת עם מניין" → the minyan is a feature of the place → keep it a synagogue.
function minyanIsModifier(text: string): boolean {
  return /עם\s+מניין|ובו\s+מניין|יש\s+(?:בו\s+)?מניין|with\s+(?:a\s+)?minyan/i.test(text);
}

// ── near-me guardrail ─────────────────────────────────────────────────────
// EXACT markers only. "קרוב" alone is NOT near-me ("קרוב למלון"/"קרוב לבית חבד" are not GPS).
export function hasNearMeMarker(text: string): boolean {
  const lower = text.toLowerCase();
  if (/(?:^|[\s,.;:!?])(?:לידי|פה|כאן)(?:$|[\s,.;:!?])/.test(text)) return true;
  if (/קרוב\s+אל[יי]+/.test(text)) return true;              // קרוב אלי / קרוב אליי
  if (/באזור\s+שלי/.test(text)) return true;
  if (/\b(?:near\s+me|around\s+me|nearby|close\s+to\s+me)\b/.test(lower)) return true;
  return false;
}

// Remove a "current location" declaration so an explicit target destination wins over it:
// "אני בתל אביב אבל רוצה חומוס בבית שמש" → resolve "בית שמש", not "תל אביב".
export function stripCurrentLocation(text: string): string {
  return text
    .replace(/(?:^|\s)אני\s+(?:נמצאת?\s+|נמצאים\s+)?[בל]\S.*?(?=\s+(?:אבל|אך|ו?רוצה|ו?מחפשת?|ו?צריכ|מעוניינ|,)|$)/g, ' ')
    .replace(/\bi(?:'m| am)\s+in\s+.+?(?=\s+but\b|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Remove near-me markers before destination resolution so they can't fuzzy-match a city
// (e.g. "כאן" → "קאן"/Cannes, "לידי" → "לוד"/Lod). The nearMe flag still drives GPS.
export function stripNearMe(text: string): string {
  return text
    .replace(/(?:^|\s)(?:לידי|פה|כאן)(?=$|\s|[,.;:!?])/g, ' ')
    .replace(/קרוב\s+אל[יי]+/g, ' ')
    .replace(/באזור\s+שלי/g, ' ')
    .replace(/ליד\s+הבית/g, ' ')
    .replace(/\b(?:near\s+me|around\s+me|nearby|close\s+to\s+me)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const KASHRUT_KEYWORDS: Record<string, string> = {
  'מהדרין':'mehadrin','mehadrin':'mehadrin',
  'בדץ':'badatz','badatz':'badatz',
  'רבנות':'rabbinate','rabbinate':'rabbinate',
};

// Whitelist-based typo correction for high-value food terms only.
// Only very safe, common Hebrew keyboard mistakes are included.
// Controlled typo dictionary (he + en). Deterministic — no free correction.
const TYPO_MAP: Record<string, string> = {
  // hebrew
  'כנתס': 'כנסת', 'כסנת': 'כנסת', 'גנסת': 'כנסת', 'ליהנ': 'לינה',
  'קפא': 'קפה', 'פסתה': 'פסטה', 'סושיי': 'סושי', 'גליד': 'גלידה',
  'חמס': 'חומוס', 'חומו': 'חומוס', 'פיש': 'דגים', 'שוארמה': 'שווארמה', 'שאורמה': 'שווארמה',
  'המברגר': 'המבורגר', 'שינצל': 'שניצל', 'פלפל': 'פלאפל', 'פיצא': 'פיצה', 'פסה': 'פסטה', 'ביגל': 'בייגל',
  'מסעד': 'מסעדה', 'שניצ': 'שניצל', 'פנקיק': 'פנקייק', 'בייג': 'בייגל', 'צחמוני': 'צמחוני',
  'וטב': 'טוב', 'מומל': 'מומלץ', 'אבזור': 'באזור', 'שרחית': 'שחרית', 'יתמן': 'תימן', 'חלי': 'חלבי',
  'יבת': 'בית', 'שוקול': 'שוקולד', 'מלואוח': 'מלאווח', 'קואסון': 'קרואסון', 'רומנט': 'רומנטי', 'קרו': 'קרוב',
  // english
  'synagoge': 'synagogue', 'synagog': 'synagogue', 'minyn': 'minyan', 'minyen': 'minyan',
  'hambuger': 'hamburger', 'humus': 'hummus', 'shwarma': 'shawarma', 'felafel': 'falafel',
  'pizzeria': 'pizza', 'piza': 'pizza', 'sushii': 'sushi',
};
// Anchors for a conservative distance-1 fuzzy (Hebrew, length >= 5 only).
const FUZZY_ANCHORS = ['פיצה','המבורגר','שווארמה','פלאפל','חומוס','סושי','שניצל','פסטה','גלידה','שקשוקה','לזניה','מסעדה','מניין','שחרית','ערבית','אירוח'];

function normalizeTypos(text: string): string {
  let t = text
    .replace(/([א-ת])['׳]([א-ת])/g, '$1$2') // ג׳חנון → גחנון (geresh inside a Hebrew word)
    .replace(/(^|[\s])פיצ(?=$|[\s,.;:!?])/g, '$1פיצה')
    .replace(/(^|[\s])פיצמ([\s]|$)/g, '$1פיצה$2')
    .replace(/(^|[\s])פיצנ([\s]|$)/g, '$1פיצה$2')
    .replace(/(^|[\s])המבןרגר(?=$|[\s,.;:!?])/g, '$1המבורגר')
    .replace(/(^|[\s])המבורג(?=$|[\s,.;:!?])/g, '$1המבורגר')
    .replace(/(^|[\s])סוש(?=$|[\s,.;:!?])/g, '$1סושי')
    .replace(/(^|[\s])בפעולה(?=$|[\s,.;:!?])/g, '$1בעפולה')
    .replace(/(^|[\s])לפעולה(?=$|[\s,.;:!?])/g, '$1לעפולה');
  // explicit typo map (word-wise, he + en)
  t = t.replace(/[א-ת]+|[a-zA-Z]+/g, (w) => TYPO_MAP[w.toLowerCase()] ?? TYPO_MAP[w] ?? w);
  // conservative fuzzy: Hebrew words length >= 5, exactly 1 edit from a domain anchor
  t = t.replace(/[א-ת]{5,}/g, (w) => {
    if (HEBREW_FOOD_TERMS.has(w)) return w;
    for (const a of FUZZY_ANCHORS) {
      if (Math.abs(a.length - w.length) <= 1 && levenshtein(w, a) === 1) return a;
    }
    return w;
  });
  return t;
}

// Hosting signal: explicit words OR (שבת + hosting verb)
function containsHostingSignal(text: string): boolean {
  const lower = text.toLowerCase();
  if (/(?:^|[\s])(?:אירוח|הארחה|לינה|להתארח|להתאר|מתארח|מתארחת|מתארחים|מתארחות|מארח|מארחת|מארחים|מארחות)(?:$|[\s,.;:!?])/.test(lower)) return true;
  if (/שב[תט]|בשת|לשבת|בשבת/.test(lower) && /יארח|יארחו|שיארח|שיארחו|אארח|נארח|להתארח|להתאר|מתארח|מארח/.test(lower)) return true;
  if (/\b(?:hosting|host\s+family|shabbat\s+host)/.test(lower)) return true;
  return false;
}

// Strong Shabbat-hosting phrases. Checked BEFORE the food override because these
// contain the food word "ארוחת" (which would otherwise route them to restaurant).
// Guarded so an explicit restaurant query ("מסעדה לארוחת שבת") still wins as food.
function containsShabbatHostingPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  if (/מסעד|restaurant/.test(lower)) return false;
  // "ארוחת שבת" and its typos ("ארוחת שב", "ארוחת לי שבת", "ארוחת בשת")
  if (/ארוח[הת]/.test(lower) && /(?:^|\s)(?:שבת|שב|בשת|לשבת|בשבת)(?:$|\s)/.test(lower)) return true;
  if (/סעוד(?:ה|ת)\s+(?:שליש|שבת)/.test(lower)) return true;
  if (/ליל\s+שבת/.test(lower) && /(אירוח|מארח|להתארח|משפח|ארוח|סעוד)/.test(lower)) return true;
  if (/אצל\s+משפחה|משפחה\s+מארחת|מקום\s+לשבת/.test(lower)) return true;
  if (/\bshabbat\s+(?:hosting|meal|dinner)\b|\bhost\s+family\b|where\s+to\s+stay\s+for\s+shabbat/.test(lower)) return true;
  return false;
}

// ── position of the first keyword of each intent (for "head word wins") ──────
function synagogueFirstIdx(text: string): number {
  const m = /בית\s+גנסת|בית\s+כנס|בתי\s+כנס|בית\s+חב|בתי\s+חב|synagogue|synagoge|synagog|shul|chabad/i.exec(text);
  return m ? m.index : Infinity;
}
function minyanFirstIdx(text: string): number {
  const m = /(?:^|[\s,.;:!?])(?:מניין|מנין|מניינים|מנינים|שחרית|מנחה|מעריב|ערבית|מוסף|ותיקין|תפילה|תפילת|נץ)(?:$|[\s,.;:!?])|\b(?:minyan|minyn|minyen|shacharit|shaharit|mincha|maariv|arvit|davening|pray|prayer)\b/i.exec(text);
  return m ? m.index : Infinity;
}
function foodFirstIdx(text: string): number {
  const lower = text.toLowerCase();
  const words = lower.match(/[א-ת]+|[a-z]+/g) ?? [];
  let scan = 0;
  for (const w of words) {
    const at = lower.indexOf(w, scan);
    scan = at + w.length;
    // Exact food sets only — the fuzzy food-relation match spuriously matches non-food
    // words (city/hosting tokens like "גת"/"שמונה") and would hijack the head position.
    // Food typos are handled deterministically by normalizeTypos/TYPO_MAP instead.
    if (HEBREW_FOOD_TERMS.has(w) || ENGLISH_FOOD_TERMS.has(w)) return at;
  }
  return Infinity;
}

// Unified intent decision. Backbone = Codex "intent priority", but the food/minyan/
// synagogue conflict is resolved by **head word** (whichever appears first wins), so
// "מניין ליד מסעדה" → minyan while "מסעדה ליד מניין" → restaurant.
export function decideCategory<T extends { category?: string; emoji?: string }>(text: string, mlResult: T): T {
  if (containsShabbatHostingPhrase(text)) return { ...mlResult, category: 'hosting', emoji: '🏠' };
  const syn = containsSynagogueExplicitTerm(text);
  const minyanish = containsMinyanTerm(text);
  // "בית כנסת עם מניין" — the minyan is a feature of the place → synagogue.
  if (syn && minyanish && minyanIsModifier(text)) return { ...mlResult, category: 'synagogue', emoji: '🕍' };

  const cands: Array<[string, string, number]> = [];
  const fp = foodFirstIdx(text);            if (fp !== Infinity)      cands.push(['restaurant', '🍽️', fp]);
  const mp = minyanish ? minyanFirstIdx(text) : Infinity; if (mp !== Infinity) cands.push(['minyan', '🙏', mp]);
  const sp = syn ? synagogueFirstIdx(text) : Infinity;    if (sp !== Infinity) cands.push(['synagogue', '🕍', sp]);
  if (cands.length) {
    cands.sort((a, b) => a[2] - b[2]); // earliest keyword = the head intent
    const [category, emoji] = cands[0];
    return { ...mlResult, category, emoji };
  }
  if (containsHostingSignal(text)) return { ...mlResult, category: 'hosting', emoji: '🏠' };
  return mlResult;
}
export function hasExplicitIntent(text: string): boolean {
  // EXACT food only (foodFirstIdx) — not the fuzzy food-relation match, which false-matches
  // bare destinations ("מרקש"→"מרק"/soup) and would wrongly block the destination-only guardrail.
  return containsShabbatHostingPhrase(text) || foodFirstIdx(text) !== Infinity || containsMinyanTerm(text)
    || containsSynagogueExplicitTerm(text) || containsHostingSignal(text);
}

// Conflicting intents joined by "או"/"or" (e.g. "בית כנסת או מסעדה") → don't guess, ask to clarify.
export function isAmbiguousIntent(text: string): boolean {
  if (!/(?:^|[\s])או(?:$|[\s])/.test(text) && !/\bor\b/i.test(text)) return false;
  let n = 0;
  if (containsFoodTerm(text)) n++;
  if (containsSynagogueExplicitTerm(text)) n++;
  if (containsMinyanTerm(text)) n++;
  if (containsHostingSignal(text) || containsShabbatHostingPhrase(text)) n++;
  return n >= 2;
}

function extractRestaurantFilters(text: string): { type: string | null; kashrut: string | null } {
  const lower = text.toLowerCase();
  let type: string | null = null;
  let kashrut: string | null = null;
  for (const [kw, val] of Object.entries(RESTAURANT_TYPE_KEYWORDS)) {
    if (lower.includes(kw)) { type = val; break; }
  }
  if (!type) {
    const relation = lookupFoodRelationMatch(lower)?.relation;
    if (relation?.fallbackType) type = relation.fallbackType === 'pareve' ? 'parve' : relation.fallbackType;
  }
  for (const [kw, val] of Object.entries(KASHRUT_KEYWORDS)) {
    if (lower.includes(kw)) { kashrut = val; break; }
  }
  return { type, kashrut };
}

const SFARAD_DENOMINATION_PATTERNS = [
  /(?:^|[\s,.;:!?])(?:ב|ל|ה)?נוסח\s+ספרד(?:$|[\s,.;:!?])/,
  /(?:^|[\s,.;:!?])ספרדי(?:$|[\s,.;:!?])/,
  /(?:^|[\s,.;:!?])ספרדית(?:$|[\s,.;:!?])/,
  /(?:^|[\s,.;:!?])ספרדים(?:$|[\s,.;:!?])/,
  /(?:^|[\s,.;:!?])ספרדיות(?:$|[\s,.;:!?])/,
];

function hasSfaradDenominationSignal(text: string): boolean {
  return SFARAD_DENOMINATION_PATTERNS.some((pattern) => pattern.test(text));
}

function hasExplicitSpainLocation(text: string): boolean {
  return /(?:^|[\s,.;:!?])(?:ב|ל)ספרד(?:$|[\s,.;:!?])/.test(text);
}

function isSfaradDenominationCandidate(candidate: string): boolean {
  return candidate === 'ספרדי' || candidate === 'ספרדית' || candidate === 'נוסח ספרד';
}

function isExplicitDestinationCandidate(candidate: string): boolean {
  if (!candidate || DESTINATION_STOP_WORDS.has(candidate) || isSfaradDenominationCandidate(candidate)) return false;
  // A Hebrew-prefixed filler word ("בנוסח" → "נוסח") is not a real destination
  if (/^[בלמה][א-ת]{2,}$/.test(candidate) && DESTINATION_STOP_WORDS.has(candidate.slice(1))) return false;
  if (candidate.includes(' ')) {
    const words = candidate.split(' ');
    if (words.some(isSfaradDenominationCandidate)) return false;
    if (words.every(w => DESTINATION_STOP_WORDS.has(w))) return false;
  }
  if (/[א-ת]/.test(candidate)) return candidate.replace(/\s/g, '').length >= 3;
  return candidate.length >= 3;
}

function isSearchIntentCandidate(candidate: string): boolean {
  if (candidate === 'בית' || candidate === 'כנס' || candidate === 'כנסת' || candidate === 'גנסת') return true;
  // EXACT food only — fuzzy would skip real destinations ("מרקש"→"מרק"/soup) in the resolver.
  return foodFirstIdx(candidate) !== Infinity || containsSynagogueExplicitTerm(candidate)
    || containsHostingSignal(candidate) || containsMinyanTerm(candidate); // מוסף/נץ/ותיקין etc. aren't places
}

interface DestinationResolution {
  destination: Destination | null;
  explicitMention: boolean;
  matched?: string; // the candidate string that resolved (for "bare destination" checks)
}

// Filler words used ONLY inside the destination-only guardrail (NOT global stop-words, so they
// never weaken intent detection). Lets "יעד ניו יורק" / "מידע על טורונטו" / "מה יש לעשות בX"
// reduce to just the place. Intent queries ("מה יש לאכול בX") are caught earlier by hasExplicitIntent.
const DESTINATION_FILLER = new Set([
  'יעד', 'מידע', 'על', 'מה', 'יש', 'לעשות', 'לבקר', 'לראות',
  'info', 'about', 'destination', 'things', 'to', 'do', 'see', 'visit',
]);

interface RouteOptions {
  expandNearby?: boolean;
  useUserGps?: boolean;
  searchQuery?: string;
}

interface ShadowLlmUsage {
  day: string;
  attempts: number;
}

@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);
  private readonly shadowSampleRate: number;
  private readonly shadowLlmDailyCap: number;
  private readonly shadowLlmUsage: ShadowLlmUsage = { day: this.todayKey(), attempts: 0 };

  constructor(
    private readonly classifier: ClassifierService,
    private readonly denomClassifier: DenominationClassifierService,
    private readonly indexService: DestinationIndexService,
    @InjectRepository(Destination)
    private readonly destRepo: Repository<Destination>,
    @InjectRepository(SearchFeedback)
    private readonly feedbackRepo: Repository<SearchFeedback>,
    @Optional()
    private readonly queryParser?: QueryParserService,
    @Optional()
    private readonly config?: ConfigService,
  ) {
    this.shadowSampleRate = this.clampNumber(
      Number(this.config?.get<string>('SMART_SEARCH_SHADOW_SAMPLE') ?? process.env.SMART_SEARCH_SHADOW_SAMPLE ?? 0.1),
      0,
      1,
    );
    this.shadowLlmDailyCap = Math.max(
      0,
      Number(this.config?.get<string>('SMART_SEARCH_LLM_DAILY_CAP') ?? process.env.SMART_SEARCH_LLM_DAILY_CAP ?? 50),
    );
  }

  @Get('classify')
  classifyText(@Query('text') text: string) {
    if (!text?.trim()) return { category: null, emoji: null, denomination: null, confidence: 0 };
    const normalized = normalizeTypos(text);
    const mlResult = this.classifier.classify(normalized);
    const result = decideCategory(normalized, mlResult);
    if (!hasExplicitIntent(normalized) && result.confidence < 0.45) {
      return { category: null, emoji: null, denomination: null, confidence: result.confidence };
    }
    let denomination: string | null = null;
    let denomEmoji: string = '';
    let denomLabel: string = '';
    if (result.category === 'synagogue' || result.category === 'minyan') {
      const denomResult = this.denomClassifier.classify(text);
      if (denomResult.denomination) {
        denomination = denomResult.denomination;
        denomEmoji   = denomResult.emoji;
        denomLabel   = this.denomClassifier.getHebrewLabel(denomination);
      }
    }
    return { category: result.category, emoji: result.emoji, denomination, denomEmoji, denomLabel, confidence: result.confidence };
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async search(@Body() dto: SearchDto) {
    const { destinationId } = dto;
    // Normalise typos before any processing
    const text = normalizeTypos(dto.text);

    // ── שלב 1: Model 1 — סיווג קטגוריה ────────────────
    const mlResult = this.classifier.classify(text);

    // Intent override — deterministic rules beat the ML model (head-word wins).
    const result = decideCategory(text, mlResult);

    // Conflicting intents ("בית כנסת או מסעדה") → ask to clarify instead of guessing.
    if (isAmbiguousIntent(text)) {
      return {
        category: 'unknown',
        emoji: '❓',
        error: 'ambiguous',
        message: 'לא בטוח מה חיפשת — מסעדה, בית כנסת, מניין או אירוח? נסו לנסח מחדש.',
        confidence: result.confidence,
      };
    }

    // ── Destination-only guardrail ──────────────────────────────────────────
    // A query with NO explicit intent is a place lookup — do NOT trust the ML category
    // (it may confidently mis-classify a bare city like "מרקש"/"בני ברק"/"בית שמש" as
    // minyan/synagogue/restaurant). Runs regardless of confidence. Explicit-intent queries
    // ("מניין במרקש", "מסעדה בבית שמש") skip this block entirely and are unaffected.
    if (!hasExplicitIntent(text)) {
      // Meaningful words of the query (drop generic stop-words + destination-lookup fillers).
      const meaningfulWords = normalizeDestinationText(text)
        .split(' ')
        .filter((w) => w && !DESTINATION_STOP_WORDS.has(w) && !DESTINATION_FILLER.has(w));

      // City-level alias — fire ONLY if the query is JUST the destination (nothing meaningful
      // remains beyond the matched alias). This prevents hijacking queries whose intent we
      // didn't recognize (e.g. "stay with family in Beit Shemesh" → stays hosting, not destination).
      const destOnlyResolution = this.resolveDestinationFromText(text);
      if (destOnlyResolution.destination && destOnlyResolution.matched) {
        const aliasWords = new Set(destOnlyResolution.matched.split(' '));
        const bareDestination = meaningfulWords.every((w) => aliasWords.has(w));
        if (bareDestination) {
          const d = destOnlyResolution.destination;
          this.recordSearchFeedback(text, { detectedKeyword: 'destination_only' });
          return {
            category: 'destination',
            emoji: '📍',
            confidence: result.confidence,
            route: `/destination/${d.id}`,
            destinationId: d.id,
            detectedCity: d.city ?? null,
            gpsUsed: false,
          };
        }
      }
      // Country-level (e.g. "מרוקו", "תאילנד") — only if the query is JUST the country, and it's a
      // real parent destination. "נוסח ספרד" is NOT Spain (detectCountryInText excludes the nusach).
      const countryEng = detectCountryInText(text);
      if (countryEng) {
        const bareCountry = meaningfulWords.every((w) => detectCountryInText(w) === countryEng);
        if (bareCountry) {
          const parentDest = await this.findParentDestinationByCountry(countryEng);
          if (parentDest) {
            this.recordSearchFeedback(text, { detectedKeyword: 'destination_only' });
            return {
              category: 'destination',
              emoji: '📍',
              confidence: result.confidence,
              route: this.getCountryRoute('destination', parentDest.id),
              destinationId: parentDest.id,
              detectedCity: parentDest.city ?? parentDest.country,
              gpsUsed: false,
            };
          }
        }
      }
      // Not a bare destination: keep the original low-confidence clarify; otherwise fall through
      // to the normal flow (ML category + city/GPS resolution) — same as before the guardrail.
      if (result.confidence < 0.45) {
        return { error: 'low_confidence', message: 'לא הצלחתי להבין מה אתה מחפש. נסה לכתוב למשל: "מסעדה כשרה בתל אביב"', confidence: result.confidence };
      }
    }

    // ── שלב 2: Model 2 — סיווג נוסח (רק לבתי כנסת/מניין) ──
    let denomination: string | null = null;
    let denomEmoji:   string        = '';
    let denomLabel:   string        = '';

    if (result.category === 'synagogue' || result.category === 'minyan') {
      const denomResult = this.denomClassifier.classify(text);
      if (denomResult.denomination) {
        denomination = denomResult.denomination;
        denomEmoji   = denomResult.emoji;
        denomLabel   = this.denomClassifier.getHebrewLabel(denomination);
      }
    }

    // ── שלב 3: חילוץ פילטרים למסעדות ─────────────────
    const { type: restaurantType, kashrut: restaurantKashrut } =
      result.category === 'restaurant' ? extractRestaurantFilters(text) : { type: null, kashrut: null };

    // ── שלב 4: חיפוש עיר ──────────────────────────────
    if (destinationId) {
      this.recordSearchFeedback(text, { detectedKeyword: result.category });
      const hasUserGps = dto.lat != null && dto.lng != null;
      return {
        ...result,
        route: this.getRoute(result.category, destinationId, denomination, restaurantType, restaurantKashrut, {
          expandNearby: result.category === 'synagogue',
          useUserGps: (result.category === 'synagogue' || result.category === 'restaurant') && hasUserGps,
          searchQuery: result.category === 'restaurant' ? text : undefined,
        }),
        destinationId,
        denomination,
        denomEmoji,
        denomLabel,
        restaurantType,
        restaurantKashrut,
      };
    }

    const nearMe = hasNearMeMarker(text);
    // strip "אני נמצא ב..." (current location) and near-me markers so an explicit target
    // wins and near-me words don't fuzzy-match a city ("כאן"→Cannes, "לידי"→Lod).
    const destText = stripNearMe(stripCurrentLocation(text));
    const destinationResolution = await this.resolveDestinationFromText(destText);
    let foundDest = destinationResolution.destination;
    let gpsUsed = false;

    // "ספרד" / "נוסח ספרד" (incl. "בנוסח ספרד") = the Sfarad *nusach*, NOT Spain the country —
    // unless the user explicitly wrote "בספרד"/"לספרד". Only a bare country mention routes to Spain.
    const sfaradAsDenomination =
      hasSfaradDenominationSignal(text.toLowerCase()) && !hasExplicitSpainLocation(text.toLowerCase());

    if (!foundDest) {
      const countryEng = detectCountryInText(destText);
      if (countryEng && !(countryEng === 'Spain' && sfaradAsDenomination)) {
        const parentDest = await this.findParentDestinationByCountry(countryEng);
        if (parentDest) {
          this.recordSearchFeedback(text, { detectedKeyword: result.category });
          const route = this.getCountryRoute(result.category, parentDest.id, denomination, restaurantType, restaurantKashrut);
          return {
            ...result,
            route,
            destinationId: parentDest.id,
            detectedCity:  parentDest.city ?? parentDest.country,
            gpsUsed:       false,
            denomination, denomEmoji, denomLabel,
            restaurantType, restaurantKashrut,
          };
        }
      } else {
        foundDest = this.indexService.fuzzyMatch(
          buildDestinationCandidates(destText).filter((c) => !(sfaradAsDenomination && c.includes('ספרד'))),
        );
        // The ML model already identified the category. If no city was found in the index,
        // GPS is the right fallback only when the user did not explicitly ask for an
        // unresolved destination. If they typed a destination-like place, fail closed
        // instead of showing local results from the user's current GPS position.
        // near-me forces GPS even if a leftover word looked like an explicit destination
        const allowGpsFallback = nearMe || !destinationResolution.explicitMention;
        if (!foundDest && allowGpsFallback && dto.lat != null && dto.lng != null) {
          foundDest = await this.findNearestDestination(dto.lat, dto.lng);
          if (foundDest) gpsUsed = true;
        }
      }
    }

    // near-me but no GPS available → ask for location, don't fail closed or guess randomly
    if (!foundDest && nearMe && (dto.lat == null || dto.lng == null)) {
      return {
        ...result,
        error: 'location_required',
        message: 'כדי לחפש לידך צריך הרשאת מיקום, או שתכתוב שם עיר.',
        route: null,
        destinationId: undefined,
        detectedCity: null,
        gpsUsed: false,
        denomination,
        denomEmoji,
        denomLabel,
        restaurantType,
        restaurantKashrut,
      };
    }

    // Fail closed only for an explicit place-name that didn't resolve (e.g. "פיצה בעיר-לא-קיימת").
    // near-me is handled above (GPS / location_required), so it never fails closed here.
    if (!foundDest && destinationResolution.explicitMention && !nearMe) {
      return {
        ...result,
        error: 'destination_not_found',
        message: 'לא מצאתי את היעד שביקשת. נסה לכתוב את שם העיר בצורה אחרת.',
        route: null,
        destinationId: undefined,
        detectedCity: null,
        gpsUsed: false,
        denomination,
        denomEmoji,
        denomLabel,
        restaurantType,
        restaurantKashrut,
      };
    }

    if (foundDest) this.recordSearchFeedback(text, { detectedKeyword: result.category });
    return {
      ...result,
      route:         this.getRoute(result.category, foundDest?.id, denomination, restaurantType, restaurantKashrut, {
        expandNearby: result.category === 'synagogue',
        useUserGps: (result.category === 'synagogue' || result.category === 'restaurant') && dto.lat != null && dto.lng != null,
        searchQuery: result.category === 'restaurant' ? text : undefined,
      }),
      destinationId: foundDest?.id,
      detectedCity:  foundDest?.city ?? null,
      gpsUsed,
      denomination,
      denomEmoji,
      denomLabel,
      restaurantType,
      restaurantKashrut,
    };
  }

  private recordSearchFeedback(query: string, data: Partial<SearchFeedback> = {}): void {
    const feedback = this.feedbackRepo.create({ ...data, query });
    void Promise.resolve(this.feedbackRepo.save(feedback))
      .then((saved) => {
        if (saved?.id) return this.runParserShadow(query, saved.id);
        return undefined;
      })
      .catch((error) => this.logger.warn(`Failed to save search feedback: ${(error as Error).message}`));
  }

  private async runParserShadow(query: string, feedbackId: number): Promise<void> {
    if (!this.queryParser) return;
    if (!this.shouldSampleShadow()) return;
    try {
      const allowLlm = this.canAttemptShadowLlm();
      const result = await this.queryParser.parse(query, { allowLlm });
      if (result.source === 'llm' || result.source === 'fallback') {
        this.recordShadowLlmAttempt();
      }
      const resolvedDestination = result.parsed.destinationText
        ? this.resolveDestinationFromText(result.parsed.destinationText).destination
        : null;
      await this.feedbackRepo.update(feedbackId, {
        parsedJson: result.parsed as any,
        parserVersion: this.queryParser.version,
        resolvedDestinationId: resolvedDestination?.id ?? null,
        modelName: result.modelName,
        latencyMs: result.latencyMs,
        source: result.source,
      });
    } catch (error) {
      this.logger.warn(`Shadow parser failed: ${(error as Error).message}`);
    }
  }

  private shouldSampleShadow(): boolean {
    if (this.shadowSampleRate <= 0) return false;
    if (this.shadowSampleRate >= 1) return true;
    return Math.random() < this.shadowSampleRate;
  }

  private canAttemptShadowLlm(): boolean {
    this.rollShadowLlmDayIfNeeded();
    return this.shadowLlmDailyCap > 0 && this.shadowLlmUsage.attempts < this.shadowLlmDailyCap;
  }

  private recordShadowLlmAttempt(): void {
    this.rollShadowLlmDayIfNeeded();
    this.shadowLlmUsage.attempts += 1;
  }

  private rollShadowLlmDayIfNeeded(): void {
    const today = this.todayKey();
    if (this.shadowLlmUsage.day === today) return;
    this.shadowLlmUsage.day = today;
    this.shadowLlmUsage.attempts = 0;
  }

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private clampNumber(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  // ── חיפוש parent destination לפי שם מדינה ──────────
  private async findParentDestinationByCountry(countryEng: string): Promise<Destination | null> {
    const rows = await this.destRepo.query(
      `SELECT id, city, country FROM destinations WHERE country ILIKE $1 AND parent_id IS NULL LIMIT 1`,
      [`%${countryEng}%`],
    );
    if (!rows.length) return null;
    return this.destRepo.findOne({ where: { id: rows[0].id } });
  }

  // ── חיפוש יעד בתוך הטקסט — משתמש באינדקס השמור במטמון ─
  private resolveDestinationFromText(text: string): DestinationResolution {
    const candidates = buildDestinationCandidates(text);
    const aliasIndex = this.indexService.getIndex();

    // Try longer candidates first so "קריית גת" wins over "קריית"
    const sorted = [...candidates].sort((a, b) => b.length - a.length);
    for (const candidate of sorted) {
      if (isSearchIntentCandidate(candidate)) continue;
      if (candidate === 'ספרד' && hasSfaradDenominationSignal(text.toLowerCase()) && !hasExplicitSpainLocation(text.toLowerCase())) {
        continue;
      }
      const destination = aliasIndex.get(candidate);
      if (destination) {
        return { destination, explicitMention: true, matched: candidate };
      }
    }

    const sfaradAsDenomination =
      hasSfaradDenominationSignal(text.toLowerCase()) && !hasExplicitSpainLocation(text.toLowerCase());
    return {
      destination: null,
      // A candidate counts as an explicit destination only if it appears as a WHOLE WORD in
      // the query — this drops prefix-stripped ghosts ("לזניה"→"זניה", "מלבי"→"לבי") and
      // multi-word pair noise, while still catching a real "בקזבלנקה".
      explicitMention: (() => {
        const textWords = new Set(normalizeDestinationText(text).split(' '));
        return candidates.some(
          (candidate) =>
            textWords.has(candidate) &&
            isExplicitDestinationCandidate(candidate) &&
            !isSearchIntentCandidate(candidate) &&
            !(sfaradAsDenomination && candidate.includes('ספרד')),
        );
      })(),
    };
  }

  // ── חיפוש destination הכי קרוב לפי GPS ────────────
  private async findNearestDestination(lat: number, lng: number): Promise<Destination | null> {
    const MAX_METERS = 100_000;
    const rows = await this.destRepo.query(
      `SELECT id FROM destinations
       WHERE parent_id IS NOT NULL
         AND ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) < $3
       ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
       LIMIT 1`,
      [lng, lat, MAX_METERS],
    );
    if (!rows.length) return null;
    return this.destRepo.findOne({ where: { id: rows[0].id } });
  }

  // ── נתיב ברמת מדינה ────────────────────────────────
  private getCountryRoute(category: string, parentId: number, denomination?: string | null, restaurantType?: string | null, restaurantKashrut?: string | null): string {
    switch (category) {
      case 'restaurant': {
        const params = new URLSearchParams({ fromParent: 'true' });
        if (restaurantType)    params.set('type',    restaurantType);
        return `/restaurants/${parentId}?${params.toString()}`;
      }
      case 'synagogue':
      case 'minyan': {
        const params = new URLSearchParams({ fromParent: 'true' });
        if (denomination) params.set('denomination', denomination);
        return `/synagogues/${parentId}?${params.toString()}`;
      }
      case 'hosting':
        return `/destination/${parentId}/subdestinations`;
      default:
        return `/destination/${parentId}/subdestinations`;
    }
  }

  // ── בניית נתיב ניווט ───────────────────────────────
  private getRoute(
    category: string,
    destinationId?: number,
    denomination?: string | null,
    restaurantType?: string | null,
    restaurantKashrut?: string | null,
    options: RouteOptions = {},
  ): string | null {
    if (!destinationId) return null;
    const denomParam = denomination ? `?denomination=${denomination}` : '';

    switch (category) {
      case 'restaurant': {
        const params = new URLSearchParams();
        if (restaurantType)    params.set('type',    restaurantType);
        if (options.useUserGps) params.set('useUserGps', 'true');
        if (options.searchQuery) params.set('q', options.searchQuery);
        const qs = params.toString();
        return `/restaurants/${destinationId}${qs ? `?${qs}` : ''}`;
      }
      case 'synagogue': {
        const params = new URLSearchParams();
        if (denomination) params.set('denomination', denomination);
        if (options.expandNearby) params.set('expandNearby', 'true');
        if (options.useUserGps) params.set('useUserGps', 'true');
        const qs = params.toString();
        return `/synagogues/${destinationId}${qs ? `?${qs}` : ''}`;
      }
      case 'minyan':     return `/minyans/${destinationId}${denomParam}`;
      case 'hosting':    return `/hosting/${destinationId}`;
      default:           return '/';
    }
  }
}
