import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { ClassifierService } from './classifier.service';
import { DenominationClassifierService } from './denomination-classifier.service';
import {
  buildDestinationCandidates,
  detectCountryInText,
  normalizeDestinationText,
} from './destination-index.service';
import { DestinationIndexService } from './destination-index.service';
import { SearchClassifierService } from './search-classifier.service';
import {
  Denomination,
  emptyParsedQuery,
  HostingMealOrStay,
  KashrutLevel,
  ParsedQuery,
  PriceLevel,
  QueryParserResult,
  RestaurantType,
  SearchCategory,
} from './parsed-query.types';
import { SearchParserSource } from './search-feedback.entity';
import { lookupFoodRelation } from '../restaurants/food-relations';

interface CacheEntry {
  expiresAt: number;
  result: QueryParserResult;
}

interface ParseOptions {
  allowLlm?: boolean;
  forceLlm?: boolean;
  bypassCache?: boolean;
}

const PARSER_VERSION = 'shadow-v1';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

const CATEGORY_VALUES = ['restaurant', 'synagogue', 'minyan', 'hosting', 'destination', 'unknown'] as const;
const RESTAURANT_TYPE_VALUES = ['meat', 'dairy', 'pareve'] as const;
const KASHRUT_VALUES = ['rabbinate', 'mehadrin', 'badatz'] as const;
const PRICE_VALUES = ['cheap', 'moderate', 'expensive'] as const;
const DENOMINATION_VALUES = ['ashkenaz', 'sfarad', 'chabad', 'teimanim'] as const;
const HOSTING_VALUES = ['meal', 'stay', 'either'] as const;

const FOOD_QUERY_MAP: [RegExp, string][] = [
  [/פיצ(?:ה|ריה)|pizza|pizzeria/i, 'pizza'],
  [/סושי|sushi/i, 'sushi'],
  [/המבורגר|המברגר|בורגר|burger|hamburger/i, 'burger'],
  [/גלידה|ice.?cream|gelato/i, 'ice cream'],
  [/חומוס|hummus/i, 'hummus'],
  [/פסטה|pasta/i, 'pasta'],
  [/קפה|cafe|coffee/i, 'cafe'],
  [/פלאפל|falafel/i, 'falafel'],
  [/שווארמה|שוארמה|shawarma/i, 'shawarma'],
];

const HOSTING_SIGNALS = [
  /ארוחת\s+שבת|סעודת\s+שבת/i,
  /(?:^|[\s])(?:אירוח|הארחה|לינה|להתארח|מתארח|מתארחת|מתארחים|מתארחות|מארח|מארחת|מארחים|מארחות)(?:$|[\s,.;:!?])/i,
  /\b(hosting|host|hosted|stay with|shabbat meal|shabbos meal)\b/i,
];

const MINYAN_SIGNALS = [/מניין|מנין|שחרית|מנחה|ערבית/i, /\bminyan\b/i];
const SYNAGOGUE_SIGNALS = [/בית\s+כנסת|בתי\s+כנסת|בתי\s+כנסיות/i, /\b(synagogue|shul)\b/i];
const RESTAURANT_SIGNALS = [
  /מסעד(?:ה|ת|ות)|לאכול|אוכל|ארוח(?:ה|ת)|פיצה|פיצריה|סושי|בורגר|המבורגר|חומוס|גלידה|קפה|פלאפל/i,
  /\b(restaurant|restaurants|eat|food|pizza|sushi|burger|dairy|meat|kosher)\b/i,
];
const NEAR_ME_SIGNALS = [
  /לידי|לידיי|קרוב אלי|קרוב אליי|קרובה אלי|קרובה אליי/i,
  /\b(near me|nearby|around me)\b/i,
];

const TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'category',
    'categoryConfidence',
    'destinationText',
    'explicitDestination',
    'useCurrentLocation',
    'queryText',
    'restaurant',
    'synagogue',
    'hosting',
  ],
  properties: {
    category: { type: 'string', enum: CATEGORY_VALUES },
    categoryConfidence: { type: 'number', minimum: 0, maximum: 1 },
    destinationText: { type: ['string', 'null'] },
    explicitDestination: { type: 'boolean' },
    useCurrentLocation: { type: 'boolean' },
    queryText: { type: ['string', 'null'] },
    restaurant: {
      type: 'object',
      additionalProperties: false,
      required: ['dish', 'cuisine', 'type', 'kashrut', 'priceLevel'],
      properties: {
        dish: { type: ['string', 'null'] },
        cuisine: { type: ['string', 'null'] },
        type: { type: ['string', 'null'], enum: [...RESTAURANT_TYPE_VALUES, null] },
        kashrut: { type: ['string', 'null'], enum: [...KASHRUT_VALUES, null] },
        priceLevel: { type: ['string', 'null'], enum: [...PRICE_VALUES, null] },
      },
    },
    synagogue: {
      type: 'object',
      additionalProperties: false,
      required: ['denomination'],
      properties: {
        denomination: { type: ['string', 'null'], enum: [...DENOMINATION_VALUES, null] },
      },
    },
    hosting: {
      type: 'object',
      additionalProperties: false,
      required: ['shabbat', 'mealOrStay'],
      properties: {
        shabbat: { type: ['boolean', 'null'] },
        mealOrStay: { type: ['string', 'null'], enum: [...HOSTING_VALUES, null] },
      },
    },
  },
};

@Injectable()
export class QueryParserService {
  private readonly logger = new Logger(QueryParserService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly client: Anthropic | null;
  private readonly modelName: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly classifier: ClassifierService,
    private readonly restaurantClassifier: SearchClassifierService,
    private readonly denominationClassifier: DenominationClassifierService,
    private readonly config: ConfigService,
    private readonly destinationIndex: DestinationIndexService,
  ) {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY') ?? process.env.ANTHROPIC_API_KEY;
    this.modelName =
      this.config.get<string>('SMART_SEARCH_LLM_MODEL') ??
      this.config.get<string>('ANTHROPIC_MODEL') ??
      DEFAULT_MODEL;
    this.timeoutMs = Number(this.config.get<string>('SMART_SEARCH_LLM_TIMEOUT_MS') ?? 10000);
    this.client = apiKey ? new Anthropic({ apiKey, timeout: this.timeoutMs }) : null;
  }

  async parse(text: string, opts: ParseOptions = {}): Promise<QueryParserResult> {
    const started = Date.now();
    const normalizedText = this.normalizeTypos(text);
    const cacheKey = this.normalizeCacheKey(normalizedText);
    const cached = opts.bypassCache ? null : this.getCache(cacheKey);
    if (cached) {
      return {
        ...cached,
        source: 'cache',
        latencyMs: Date.now() - started,
      };
    }

    const fast = await this.parseFast(normalizedText);
    const allowLlm = opts.allowLlm ?? true;
    if (!allowLlm || !this.client || (!opts.forceLlm && !this.shouldUseLlm(normalizedText, fast.parsed))) {
      const result = { ...fast, latencyMs: Date.now() - started };
      if (!opts.bypassCache) this.setCache(cacheKey, result);
      return result;
    }

    try {
      const parsed = await this.parseWithLlm(normalizedText);
      const result: QueryParserResult = {
        parsed,
        source: 'llm',
        modelName: this.modelName,
        latencyMs: Date.now() - started,
      };
      if (!opts.bypassCache) this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      this.logger.warn(`LLM query parse failed, falling back: ${(error as Error).message}`);
      const fallback: QueryParserResult = {
        ...fast,
        source: 'fallback',
        latencyMs: Date.now() - started,
      };
      if (!opts.bypassCache) this.setCache(cacheKey, fallback);
      return fallback;
    }
  }

  get version(): string {
    return PARSER_VERSION;
  }

  private async parseFast(text: string): Promise<QueryParserResult> {
    const parsed = emptyParsedQuery();
    const classification = this.classifier.classify(text);
    const restaurantParts = await this.restaurantClassifier.classify(text);
    const dish = this.detectDish(text);
    const relation = dish ? lookupFoodRelation(dish) : undefined;
    const destinationText = this.resolveDestinationText(text);
    const denomination = this.denominationClassifier.classify(text).denomination;

    parsed.categoryConfidence = classification.confidence;
    parsed.destinationText = destinationText;
    parsed.explicitDestination = destinationText !== null;
    parsed.useCurrentLocation = !parsed.explicitDestination && this.hasSignal(text, NEAR_ME_SIGNALS);
    parsed.queryText = restaurantParts.keyword ?? null;
    parsed.restaurant.dish = dish;
    parsed.restaurant.type = this.normalizeRestaurantType(restaurantParts.type ?? relation?.fallbackType);
    parsed.restaurant.kashrut = this.normalizeKashrut(restaurantParts.kashrut);
    parsed.restaurant.priceLevel = this.detectPriceLevel(text);
    parsed.synagogue.denomination = this.normalizeDenomination(denomination);
    parsed.hosting.shabbat = /שבת|shabbat|shabbos/i.test(text) ? true : null;
    parsed.hosting.mealOrStay = this.detectMealOrStay(text);
    parsed.category = this.chooseCategory(text, classification.category, Boolean(dish), parsed.explicitDestination);

    return {
      parsed,
      source: 'fast',
      modelName: 'local-fast-parser',
      latencyMs: 0,
    };
  }

  private async parseWithLlm(text: string): Promise<ParsedQuery> {
    if (!this.client) throw new Error('ANTHROPIC_API_KEY is not configured');
    const messagePromise = this.client.messages.create({
      model: this.modelName,
      max_tokens: 700,
      temperature: 0,
      system:
        'You translate Jewish travel search queries into a strict JSON tool call. ' +
        'Return only fields in the schema. Do not invent destination IDs. ' +
        'destinationText is raw text only when the user explicitly mentions a destination.',
      messages: [
        {
          role: 'user',
          content:
            'Parse this search query. Hebrew, English, typos, and mixed language are expected.\n\n' +
            `Query: ${text}`,
        },
      ],
      tools: [
        {
          name: 'parse_query',
          description: 'Return the structured ParsedQuery object for the search query.',
          input_schema: TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'parse_query' },
    } as any);

    const message = await this.withTimeout(messagePromise, this.timeoutMs);
    const toolUse = (message.content as any[]).find((block) => block?.type === 'tool_use' && block?.name === 'parse_query');
    if (!toolUse?.input) throw new Error('LLM did not return parse_query tool input');
    return this.postProcessParsedQuery(this.validateParsedQuery(toolUse.input));
  }

  private postProcessParsedQuery(parsed: ParsedQuery): ParsedQuery {
    const dish = parsed.restaurant.dish ? this.detectDish(parsed.restaurant.dish) ?? parsed.restaurant.dish : null;
    const relation = dish ? lookupFoodRelation(dish) : undefined;
    return {
      ...parsed,
      restaurant: {
        ...parsed.restaurant,
        dish,
        type: parsed.restaurant.type ?? this.normalizeRestaurantType(relation?.fallbackType),
      },
    };
  }

  private validateParsedQuery(value: unknown): ParsedQuery {
    const obj = this.asObject(value, 'parsed query');
    const parsed = emptyParsedQuery();
    parsed.category = this.enumValue(obj.category, CATEGORY_VALUES, 'category');
    parsed.categoryConfidence = this.numberRange(obj.categoryConfidence, 0, 1, 'categoryConfidence');
    parsed.destinationText = this.nullableString(obj.destinationText, 'destinationText');
    parsed.explicitDestination = this.booleanValue(obj.explicitDestination, 'explicitDestination');
    parsed.useCurrentLocation = this.booleanValue(obj.useCurrentLocation, 'useCurrentLocation');
    parsed.queryText = this.nullableString(obj.queryText, 'queryText');

    const restaurant = this.asObject(obj.restaurant, 'restaurant');
    parsed.restaurant.dish = this.nullableString(restaurant.dish, 'restaurant.dish');
    parsed.restaurant.cuisine = this.nullableString(restaurant.cuisine, 'restaurant.cuisine');
    parsed.restaurant.type = this.nullableEnum(restaurant.type, RESTAURANT_TYPE_VALUES, 'restaurant.type');
    parsed.restaurant.kashrut = this.nullableEnum(restaurant.kashrut, KASHRUT_VALUES, 'restaurant.kashrut');
    parsed.restaurant.priceLevel = this.nullableEnum(restaurant.priceLevel, PRICE_VALUES, 'restaurant.priceLevel');

    const synagogue = this.asObject(obj.synagogue, 'synagogue');
    parsed.synagogue.denomination = this.nullableEnum(synagogue.denomination, DENOMINATION_VALUES, 'synagogue.denomination');

    const hosting = this.asObject(obj.hosting, 'hosting');
    parsed.hosting.shabbat = this.nullableBoolean(hosting.shabbat, 'hosting.shabbat');
    parsed.hosting.mealOrStay = this.nullableEnum(hosting.mealOrStay, HOSTING_VALUES, 'hosting.mealOrStay');

    return parsed;
  }

  private shouldUseLlm(text: string, fast: ParsedQuery): boolean {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > 3) return true;
    if (fast.categoryConfidence < 0.72) return true;
    if (fast.category === 'unknown') return true;
    return fast.explicitDestination && fast.queryText !== null && fast.categoryConfidence < 0.85;
  }

  private chooseCategory(
    text: string,
    modelCategory: string,
    hasDish: boolean,
    hasDestination: boolean,
  ): SearchCategory {
    if (this.hasSignal(text, HOSTING_SIGNALS)) return 'hosting';
    if (this.hasSignal(text, MINYAN_SIGNALS)) return 'minyan';
    if (this.hasSignal(text, SYNAGOGUE_SIGNALS)) return 'synagogue';
    if (hasDish || this.hasSignal(text, RESTAURANT_SIGNALS)) return 'restaurant';
    if (/מקווה|mikvah|mikveh/i.test(text)) return hasDestination ? 'destination' : 'unknown';
    if (this.isCategory(modelCategory)) return modelCategory;
    return hasDestination ? 'destination' : 'unknown';
  }

  private resolveDestinationText(text: string): string | null {
    const candidates = buildDestinationCandidates(text).sort((a, b) => b.length - a.length);
    const aliasIndex = this.destinationIndex.getIndex();
    for (const candidate of candidates) {
      const destination = aliasIndex.get(candidate);
      if (destination) return destination.nameHe ?? destination.city ?? destination.name;
    }
    const fuzzy = this.destinationIndex.fuzzyMatch(candidates);
    if (fuzzy) return fuzzy.nameHe ?? fuzzy.city ?? fuzzy.name;
    return detectCountryInText(text);
  }

  private normalizeTypos(text: string): string {
    return text
      .replace(/(^|[\s])פיצמ([\s]|$)/g, '$1פיצה$2')
      .replace(/(^|[\s])פיצנ([\s]|$)/g, '$1פיצה$2')
      .replace(/(^|[\s])בפעולה(?=$|[\s,.;:!?])/g, '$1בעפולה')
      .replace(/(^|[\s])לפעולה(?=$|[\s,.;:!?])/g, '$1לעפולה')
      .replace(/(^|[\s])בירשלים(?=$|[\s,.;:!?])/g, '$1בירושלים')
      .replace(/(^|[\s])לירשלים(?=$|[\s,.;:!?])/g, '$1לירושלים');
  }

  private normalizeCacheKey(text: string): string {
    return normalizeDestinationText(text)
      .normalize('NFKD')
      .replace(/[\u0591-\u05C7]/g, '')
      .replace(/[׳'״"]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private detectDish(text: string): string | null {
    for (const [pattern, dish] of FOOD_QUERY_MAP) {
      if (pattern.test(text)) return dish;
    }
    return null;
  }

  private detectPriceLevel(text: string): PriceLevel | null {
    if (/זול|זולה|cheap|budget/i.test(text)) return 'cheap';
    if (/יוקרתי|יוקרתית|expensive|luxury/i.test(text)) return 'expensive';
    return null;
  }

  private detectMealOrStay(text: string): HostingMealOrStay | null {
    if (/ארוח(?:ה|ת)|סעודה|meal/i.test(text)) return 'meal';
    if (/לינה|לישון|stay|sleep/i.test(text)) return 'stay';
    if (this.hasSignal(text, HOSTING_SIGNALS)) return 'either';
    return null;
  }

  private hasSignal(text: string, signals: RegExp[]): boolean {
    return signals.some((signal) => signal.test(text));
  }

  private normalizeRestaurantType(type: string | undefined): RestaurantType | null {
    if (type === 'meat' || type === 'dairy' || type === 'pareve') return type;
    if (type === 'parve') return 'pareve';
    return null;
  }

  private normalizeKashrut(kashrut: string | undefined): KashrutLevel | null {
    if (kashrut === 'rabbinate' || kashrut === 'mehadrin' || kashrut === 'badatz') return kashrut;
    return null;
  }

  private normalizeDenomination(denomination: string | null): Denomination | null {
    if (this.isOneOf(denomination, DENOMINATION_VALUES)) return denomination;
    return null;
  }

  private isCategory(value: string): value is SearchCategory {
    return this.isOneOf(value, CATEGORY_VALUES);
  }

  private getCache(key: string): QueryParserResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.result;
  }

  private setCache(key: string, result: QueryParserResult): void {
    if (!key) return;
    if (this.cache.size >= CACHE_MAX) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      result,
    });
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`LLM timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private asObject(value: unknown, field: string): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${field} must be an object`);
    }
    return value as Record<string, unknown>;
  }

  private nullableString(value: unknown, field: string): string | null {
    if (value === null) return null;
    if (typeof value === 'string') return value.trim() || null;
    throw new Error(`${field} must be string or null`);
  }

  private booleanValue(value: unknown, field: string): boolean {
    if (typeof value === 'boolean') return value;
    throw new Error(`${field} must be boolean`);
  }

  private nullableBoolean(value: unknown, field: string): boolean | null {
    if (value === null) return null;
    if (typeof value === 'boolean') return value;
    throw new Error(`${field} must be boolean or null`);
  }

  private numberRange(value: unknown, min: number, max: number, field: string): number {
    if (typeof value !== 'number' || Number.isNaN(value) || value < min || value > max) {
      throw new Error(`${field} must be a number between ${min} and ${max}`);
    }
    return value;
  }

  private enumValue<T extends readonly string[]>(value: unknown, values: T, field: string): T[number] {
    if (this.isOneOf(value, values)) return value;
    throw new Error(`${field} has invalid value`);
  }

  private nullableEnum<T extends readonly string[]>(value: unknown, values: T, field: string): T[number] | null {
    if (value === null) return null;
    if (this.isOneOf(value, values)) return value;
    throw new Error(`${field} has invalid value`);
  }

  private isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
    return typeof value === 'string' && (values as readonly string[]).includes(value);
  }
}
