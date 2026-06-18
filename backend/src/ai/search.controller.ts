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
} from './destination-index.service';

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
  'בשר','סלט','עוגה','אוכל','ארוחה','ארוחת','מטבח',
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
  'thai','indian','japanese','mediterranean','gourmet','bistro','deli',
]);

function containsFoodTerm(text: string): boolean {
  const lower = text.toLowerCase();
  if ((lower.match(/[א-ת]+/g) ?? []).some((w: string) => HEBREW_FOOD_TERMS.has(w))) return true;
  if ((lower.match(/[a-z]+/g) ?? []).some((w: string) => ENGLISH_FOOD_TERMS.has(w))) return true;
  return false;
}

// Force synagogue only when "בית כנסת" is written explicitly.
// Denomination words alone (ספרדי, חב"ד) should not override the ML model —
// "מניין שחרית ספרדי" is still a minyan, the model handles denomination context.
function containsSynagogueExplicitTerm(text: string): boolean {
  if (/בתי\s+כנסת/.test(text) || /בתי\s+כנסיות/.test(text)) return true;
  if (/בית\s+כנסת/.test(text)) return true;
  return false;
}
const KASHRUT_KEYWORDS: Record<string, string> = {
  'מהדרין':'mehadrin','mehadrin':'mehadrin',
  'בדץ':'badatz','badatz':'badatz',
  'רבנות':'rabbinate','rabbinate':'rabbinate',
};

// Whitelist-based typo correction for high-value food terms only.
// Only very safe, common Hebrew keyboard mistakes are included.
function normalizeTypos(text: string): string {
  return text
    .replace(/(^|[\s])פיצמ([\s]|$)/g, '$1פיצה$2')
    .replace(/(^|[\s])פיצנ([\s]|$)/g, '$1פיצה$2')
    .replace(/(^|[\s])בפעולה(?=$|[\s,.;:!?])/g, '$1בעפולה')
    .replace(/(^|[\s])לפעולה(?=$|[\s,.;:!?])/g, '$1לעפולה');
}

// Hosting signal: explicit words OR (שבת + hosting verb)
function containsHostingSignal(text: string): boolean {
  const lower = text.toLowerCase();
  if (/(?:^|[\s])(?:אירוח|הארחה|לינה|להתארח|מתארח|מתארחת|מתארחים|מתארחות|מארח|מארחת|מארחים|מארחות)(?:$|[\s,.;:!?])/.test(lower)) return true;
  if (/שבת/.test(lower) && /יארח|יארחו|שיארח|שיארחו|אארח|נארח|להתארח|מתארח|מארח/.test(lower)) return true;
  return false;
}

function extractRestaurantFilters(text: string): { type: string | null; kashrut: string | null } {
  const lower = text.toLowerCase();
  let type: string | null = null;
  let kashrut: string | null = null;
  for (const [kw, val] of Object.entries(RESTAURANT_TYPE_KEYWORDS)) {
    if (lower.includes(kw)) { type = val; break; }
  }
  for (const [kw, val] of Object.entries(KASHRUT_KEYWORDS)) {
    if (lower.includes(kw)) { kashrut = val; break; }
  }
  return { type, kashrut };
}

const SFARAD_DENOMINATION_PATTERNS = [
  /(?:^|[\s,.;:!?])נוסח\s+ספרד(?:$|[\s,.;:!?])/,
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
  if (candidate.includes(' ')) {
    const words = candidate.split(' ');
    if (words.some(isSfaradDenominationCandidate)) return false;
    if (words.every(w => DESTINATION_STOP_WORDS.has(w))) return false;
  }
  if (/[א-ת]/.test(candidate)) return candidate.replace(/\s/g, '').length >= 3;
  return candidate.length >= 3;
}

interface DestinationResolution {
  destination: Destination | null;
  explicitMention: boolean;
}

interface RouteOptions {
  expandNearby?: boolean;
  useUserGps?: boolean;
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
    const foodOverride = containsFoodTerm(normalized);
    const synagoguePluralOverride = !foodOverride && containsSynagogueExplicitTerm(normalized);
    const hostingOverride = !foodOverride && !synagoguePluralOverride && containsHostingSignal(normalized);
    const result = foodOverride
      ? { ...mlResult, category: 'restaurant', emoji: '🍽️' }
      : synagoguePluralOverride
      ? { ...mlResult, category: 'synagogue', emoji: '🕍' }
      : hostingOverride
      ? { ...mlResult, category: 'hosting', emoji: '🏠' }
      : mlResult;
    if (!foodOverride && !synagoguePluralOverride && !hostingOverride && result.confidence < 0.45) {
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
  async search(@Body() dto: SearchDto) {
    const { destinationId } = dto;
    // Normalise typos before any processing
    const text = normalizeTypos(dto.text);

    // ── שלב 1: Model 1 — סיווג קטגוריה ────────────────
    const mlResult = this.classifier.classify(text);

    // Override ML when food/restaurant terms are present — prevents "בית" in city
    // names (בית שמש, בית שאן) from biasing the ML toward synagogue
    const hebrewFoodOverride = containsFoodTerm(text);
    const hebrewSynagogueOverride = !hebrewFoodOverride && containsSynagogueExplicitTerm(text);
    const hebrewHostingOverride = !hebrewFoodOverride && !hebrewSynagogueOverride && containsHostingSignal(text);
    const result = hebrewFoodOverride
      ? { ...mlResult, category: 'restaurant', emoji: '🍽️' }
      : hebrewSynagogueOverride
      ? { ...mlResult, category: 'synagogue', emoji: '🕍' }
      : hebrewHostingOverride
      ? { ...mlResult, category: 'hosting', emoji: '🏠' }
      : mlResult;

    if (!hebrewFoodOverride && !hebrewSynagogueOverride && !hebrewHostingOverride && result.confidence < 0.45) {
      // Before giving up: check if the text is a destination-only query (e.g. "מרקש", "קאן")
      const destOnlyResolution = this.resolveDestinationFromText(text);
      if (destOnlyResolution.destination) {
        const d = destOnlyResolution.destination;
        this.recordSearchFeedback(text, { detectedKeyword: 'destination_only' });
        return {
          category: 'destination',
          emoji: '📍',
          confidence: result.confidence,
          // resolveDestinationFromText only indexes city-level destinations (WHERE parent_id IS NOT NULL),
          // so all matches here are cities → go to city overview, not subdestinations picker.
          route: `/destination/${d.id}`,
          destinationId: d.id,
          detectedCity: d.city ?? null,
          gpsUsed: false,
        };
      }
      return { error: 'low_confidence', message: 'לא הצלחתי להבין מה אתה מחפש. נסה לכתוב למשל: "מסעדה כשרה בתל אביב"', confidence: result.confidence };
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
        }),
        destinationId,
        denomination,
        denomEmoji,
        denomLabel,
        restaurantType,
        restaurantKashrut,
      };
    }

    const destinationResolution = await this.resolveDestinationFromText(text);
    let foundDest = destinationResolution.destination;
    let gpsUsed = false;

    if (!foundDest) {
      const countryEng = detectCountryInText(text);
      if (countryEng) {
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
        foundDest = this.indexService.fuzzyMatch(buildDestinationCandidates(text));
        // The ML model already identified the category. If no city was found in the index,
        // GPS is the right fallback only when the user did not explicitly ask for an
        // unresolved destination. If they typed a destination-like place, fail closed
        // instead of showing local results from the user's current GPS position.
        const allowGpsFallback = !destinationResolution.explicitMention;
        if (!foundDest && allowGpsFallback && dto.lat != null && dto.lng != null) {
          foundDest = await this.findNearestDestination(dto.lat, dto.lng);
          if (foundDest) gpsUsed = true;
        }
      }
    }

    if (!foundDest && destinationResolution.explicitMention) {
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
      if (candidate === 'ספרד' && hasSfaradDenominationSignal(text.toLowerCase()) && !hasExplicitSpainLocation(text.toLowerCase())) {
        continue;
      }
      const destination = aliasIndex.get(candidate);
      if (destination) {
        return { destination, explicitMention: true };
      }
    }

    return {
      destination: null,
      explicitMention: candidates.some(isExplicitDestinationCandidate),
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
        if (restaurantKashrut) params.set('kashrut', restaurantKashrut);
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
        if (restaurantKashrut) params.set('kashrut', restaurantKashrut);
        if (options.useUserGps) params.set('useUserGps', 'true');
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
