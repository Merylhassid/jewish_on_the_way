import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ClassifierService } from '../classifier.service';
import { DenominationClassifierService } from '../denomination-classifier.service';
import {
  buildDestinationAliasIndex,
  buildDestinationCandidates,
  detectCountryInText,
  levenshtein,
  normalizeDestinationText,
} from '../destination-index.service';
import { SearchClassifierService } from '../search-classifier.service';
import { Destination } from '../../destination.entity';
import { lookupFoodRelation } from '../../restaurants/food-relations';
import { QueryParserService } from '../query-parser.service';

type SearchCategory =
  | 'restaurant'
  | 'synagogue'
  | 'minyan'
  | 'hosting'
  | 'destination'
  | 'unknown';

interface ParsedEvalQuery {
  category: SearchCategory;
  categoryConfidence: number;
  destinationText: string | null;
  explicitDestination: boolean;
  useCurrentLocation: boolean;
  queryText: string | null;
  restaurant: {
    dish: string | null;
    cuisine: string | null;
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

interface EvalCase {
  query: string;
  expected: Partial<ParsedEvalQuery>;
}

interface FeedbackEvalRow {
  query: string;
  detected_type: string | null;
  detected_kashrut: string | null;
  detected_keyword: string | null;
  parsed_json: Partial<ParsedEvalQuery> | null;
}

interface FieldStat {
  pass: number;
  total: number;
}

interface EvalRunSummary {
  mode: string;
  stats: Map<string, FieldStat>;
  failedCases: string[];
  sourceCounts: Map<string, number>;
  results: EvalCaseResult[];
}

interface EvalCaseResult {
  testCase: EvalCase;
  parsed: ParsedEvalQuery;
  source: string;
  failures: string[];
}

const STATIC_DESTINATIONS = [
  destination(1, 'Miami', 'מיאמי', 'Miami', 'United States'),
  destination(2, 'Afula', 'עפולה', 'Afula', 'Israel'),
  destination(3, 'Jerusalem', 'ירושלים', 'Jerusalem', 'Israel'),
  destination(4, 'Tel Aviv', 'תל אביב', 'Tel Aviv', 'Israel'),
  destination(5, 'Paris', 'פריז', 'Paris', 'France'),
  destination(6, 'London', 'לונדון', 'London', 'United Kingdom'),
  destination(7, 'Paphos', 'פאפוס', 'Paphos', 'Cyprus'),
  destination(8, 'Kiryat Gat', 'קריית גת', 'Kiryat Gat', 'Israel'),
  destination(9, 'Beit Shemesh', 'בית שמש', 'Beit Shemesh', 'Israel'),
  destination(10, 'Rishon LeZion', 'ראשון לציון', 'Rishon LeZion', 'Israel'),
  destination(11, 'Bnei Brak', 'בני ברק', 'Bnei Brak', 'Israel'),
  destination(12, 'Netanya', 'נתניה', 'Netanya', 'Israel'),
  destination(13, 'Eilat', 'אילת', 'Eilat', 'Israel'),
  destination(14, 'Haifa', 'חיפה', 'Haifa', 'Israel'),
  destination(15, 'Tiberias', 'טבריה', 'Tiberias', 'Israel'),
  destination(16, 'Rome', 'רומא', 'Rome', 'Italy'),
  destination(17, 'Milan', 'מילאנו', 'Milan', 'Italy'),
  destination(18, 'Madrid', 'מדריד', 'Madrid', 'Spain'),
  destination(19, 'Barcelona', 'ברצלונה', 'Barcelona', 'Spain'),
  destination(20, 'Lisbon', 'ליסבון', 'Lisbon', 'Portugal'),
  destination(21, 'Athens', 'אתונה', 'Athens', 'Greece'),
  destination(22, 'Berlin', 'ברלין', 'Berlin', 'Germany'),
  destination(23, 'Vienna', 'וינה', 'Vienna', 'Austria'),
  destination(24, 'Prague', 'פראג', 'Prague', 'Czech Republic'),
  destination(25, 'Budapest', 'בודפשט', 'Budapest', 'Hungary'),
  destination(26, 'Dubai', 'דובאי', 'Dubai', 'UAE'),
  destination(27, 'Bangkok', 'בנגקוק', 'Bangkok', 'Thailand'),
  destination(28, 'Tokyo', 'טוקיו', 'Tokyo', 'Japan'),
  destination(29, 'New York', 'ניו יורק', 'New York', 'United States'),
  destination(30, 'Los Angeles', 'לוס אנג׳לס', 'Los Angeles', 'United States'),
  destination(31, 'Toronto', 'טורונטו', 'Toronto', 'Canada'),
  destination(32, 'Montreal', 'מונטריאול', 'Montreal', 'Canada'),
  destination(33, 'Amsterdam', 'אמסטרדם', 'Amsterdam', 'Netherlands'),
  destination(34, 'Antwerp', 'אנטוורפן', 'Antwerp', 'Belgium'),
  destination(35, 'Zurich', 'ציריך', 'Zurich', 'Switzerland'),
  destination(36, 'Geneva', 'ז׳נבה', 'Geneva', 'Switzerland'),
  destination(37, 'Marrakech', 'מרקש', 'Marrakech', 'Morocco'),
  destination(38, 'Casablanca', 'קזבלנקה', 'Casablanca', 'Morocco'),
] as Destination[];

const FOOD_QUERY_MAP: [RegExp, string][] = [
  [/פיצ(?:ה|ריה)|pizza|pizzeria/i, 'pizza'],
  [/סושי|sushi/i, 'sushi'],
  [/המבורגר|המברגר|בורגר|burger|hamburger/i, 'burger'],
  [/גלידה|ice.?cream|gelato/i, 'ice-cream'],
  [/חומוס|hummus/i, 'hummus'],
  [/פסטה|pasta/i, 'pasta'],
  [/קפה|cafe|coffee/i, 'cafe'],
  [/פלאפל|falafel/i, 'falafel'],
  [/שווארמה|שוארמה|shawarma/i, 'shawarma'],
];

const RESTAURANT_SIGNALS = [
  /מסעד(?:ה|ות)/i,
  /לאכול|אוכל|פיצה|פיצריה|סושי|בורגר|המבורגר|חומוס|גלידה|קפה|פלאפל/i,
  /\b(restaurant|restaurants|eat|food|pizza|sushi|burger|dairy|meat|kosher)\b/i,
];

const SYNAGOGUE_SIGNALS = [
  /בית כנסת|בתי כנסת|חב["״]?ד|ספרדי|אשכנז|תימני|נוסח/i,
  /\b(synagogue|shul|chabad)\b/i,
];

const MINYAN_SIGNALS = [/מניין|מנין|שחרית|מנחה|ערבית/i, /\bminyan\b/i];

const HOSTING_SIGNALS = [
  /להתארח|מתארח|אירוח|מארח|מארחים|ארוחת שבת|שבת/i,
  /\b(hosting|host|shabbat meal|shabbos meal)\b/i,
];

const NEAR_ME_SIGNALS = [
  /לידי|לידיי|קרוב אלי|קרוב אליי|קרובה אלי|קרובה אליי/i,
  /\b(near me|nearby|around me)\b/i,
];

function destination(
  id: number,
  name: string,
  nameHe: string,
  city: string,
  country: string,
): Partial<Destination> {
  return {
    id,
    name,
    nameHe,
    city,
    country,
  };
}

function normalizeTypos(text: string): string {
  return text
    .replace(/בפעולה/g, 'בעפולה')
    .replace(/לפעולה/g, 'לעפולה')
    .replace(/בירשלים/g, 'בירושלים')
    .replace(/לירשלים/g, 'לירושלים')
    .replace(/פיצמ/g, 'פיצה')
    .replace(/פיצנ/g, 'פיצה');
}

function hasSignal(text: string, signals: RegExp[]): boolean {
  return signals.some((signal) => signal.test(text));
}

function detectFoodDish(text: string): string | null {
  for (const [pattern, dish] of FOOD_QUERY_MAP) {
    if (pattern.test(text)) return dish;
  }
  return null;
}

function detectPriceLevel(text: string): 'cheap' | 'moderate' | 'expensive' | null {
  if (/זול|זולה|cheap|budget/i.test(text)) return 'cheap';
  if (/יוקרתי|יוקרתית|expensive|luxury/i.test(text)) return 'expensive';
  return null;
}

function detectMealOrStay(text: string): 'meal' | 'stay' | 'either' | null {
  if (/ארוח(?:ה|ת)|סעודה|meal/i.test(text)) return 'meal';
  if (/לינה|לישון|stay|sleep/i.test(text)) return 'stay';
  if (hasSignal(text, HOSTING_SIGNALS)) return 'either';
  return null;
}

function resolveDestination(
  text: string,
  aliasIndex: Map<string, Destination>,
): Destination | null {
  const candidates = buildDestinationCandidates(text);
  for (const candidate of candidates) {
    const direct = aliasIndex.get(candidate);
    if (direct) return direct;
  }

  const aliases = Array.from(aliasIndex.entries());
  for (const candidate of candidates) {
    if (candidate.length < 3) continue;
    const threshold = candidate.length <= 5 ? 1 : 2;
    for (const [alias, destination] of aliases) {
      if (Math.abs(alias.length - candidate.length) > threshold) continue;
      if (levenshtein(candidate, alias) <= threshold) return destination;
    }
  }

  const country = detectCountryInText(text);
  if (!country) return null;
  return STATIC_DESTINATIONS.find((destination) => destination.country === country) ?? null;
}

function displayDestination(destination: Destination | null): string | null {
  if (!destination) return null;
  return destination.nameHe ?? destination.city ?? destination.name;
}

async function parseLegacyBaseline(
  query: string,
  services: {
    classifier: ClassifierService;
    restaurantClassifier: SearchClassifierService;
    denominationClassifier: DenominationClassifierService;
    aliasIndex: Map<string, Destination>;
  },
): Promise<ParsedEvalQuery> {
  const text = normalizeTypos(query.trim());
  const destination = resolveDestination(text, services.aliasIndex);
  const restaurantParts = await services.restaurantClassifier.classify(text);
  const dish = detectFoodDish(text);
  const relation = dish ? lookupFoodRelation(dish) : undefined;
  const denomination = services.denominationClassifier.classify(text);

  let modelCategory: SearchCategory = 'unknown';
  let categoryConfidence = 0;
  try {
    const modelResult = services.classifier.classify(text);
    modelCategory = normalizeCategory(modelResult.category);
    categoryConfidence = modelResult.confidence;
  } catch {
    modelCategory = 'unknown';
  }

  const category = chooseCategory(text, modelCategory, Boolean(dish), Boolean(destination));

  return {
    category,
    categoryConfidence,
    destinationText: displayDestination(destination),
    explicitDestination: Boolean(destination),
    useCurrentLocation: !destination && hasSignal(text, NEAR_ME_SIGNALS),
    queryText: restaurantParts.keyword ?? null,
    restaurant: {
      dish,
      cuisine: null,
      type: normalizeRestaurantType(restaurantParts.type ?? relation?.fallbackType),
      kashrut: normalizeKashrut(restaurantParts.kashrut),
      priceLevel: detectPriceLevel(text),
    },
    synagogue: {
      denomination: normalizeDenomination(denomination.denomination),
    },
    hosting: {
      shabbat: /שבת|shabbat|shabbos/i.test(text) ? true : null,
      mealOrStay: detectMealOrStay(text),
    },
  };
}

function chooseCategory(
  text: string,
  modelCategory: SearchCategory,
  hasDish: boolean,
  hasDestination: boolean,
): SearchCategory {
  if (hasSignal(text, HOSTING_SIGNALS)) return 'hosting';
  if (hasSignal(text, MINYAN_SIGNALS)) return 'minyan';
  if (hasSignal(text, SYNAGOGUE_SIGNALS)) return 'synagogue';
  if (hasDish || hasSignal(text, RESTAURANT_SIGNALS)) return 'restaurant';
  if (modelCategory !== 'unknown') return modelCategory;
  return hasDestination ? 'destination' : 'unknown';
}

function normalizeCategory(category: string): SearchCategory {
  if (
    category === 'restaurant' ||
    category === 'synagogue' ||
    category === 'minyan' ||
    category === 'hosting'
  ) {
    return category;
  }
  return 'unknown';
}

function normalizeRestaurantType(type: string | undefined): 'meat' | 'dairy' | 'pareve' | null {
  if (type === 'meat' || type === 'dairy' || type === 'pareve') return type;
  return null;
}

function normalizeKashrut(kashrut: string | undefined): 'rabbinate' | 'mehadrin' | 'badatz' | null {
  if (kashrut === 'rabbinate' || kashrut === 'mehadrin' || kashrut === 'badatz') return kashrut;
  return null;
}

function normalizeDenomination(
  denomination: string | null,
): 'ashkenaz' | 'sfarad' | 'chabad' | 'teimanim' | null {
  if (
    denomination === 'ashkenaz' ||
    denomination === 'sfarad' ||
    denomination === 'chabad' ||
    denomination === 'teimanim'
  ) {
    return denomination;
  }
  return null;
}

function readEvalCases(filePath: string): EvalCase[] {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line) as EvalCase;
      } catch (error) {
        throw new Error(`Invalid JSONL at line ${index + 1}: ${(error as Error).message}`);
      }
    });
}

function comparePartial(
  expected: unknown,
  actual: unknown,
  pathName: string,
  stats: Map<string, FieldStat>,
  failures: string[],
): void {
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    for (const [key, expectedValue] of Object.entries(expected)) {
      const childPath = pathName ? `${pathName}.${key}` : key;
      const actualValue =
        actual !== null && typeof actual === 'object'
          ? (actual as Record<string, unknown>)[key]
          : undefined;
      comparePartial(expectedValue, actualValue, childPath, stats, failures);
    }
    return;
  }

  const stat = stats.get(pathName) ?? { pass: 0, total: 0 };
  stat.total += 1;
  const passed = valuesEqual(expected, actual, pathName);
  if (passed) {
    stat.pass += 1;
  } else {
    failures.push(`${pathName}: expected ${formatValue(expected)}, got ${formatValue(actual)}`);
  }
  stats.set(pathName, stat);
}

function valuesEqual(expected: unknown, actual: unknown, pathName: string): boolean {
  if (pathName.endsWith('destinationText') && typeof expected === 'string' && typeof actual === 'string') {
    return destinationTextEqual(expected, actual);
  }
  if (typeof expected === 'string' && typeof actual === 'string') {
    return normalizeComparable(expected) === normalizeComparable(actual);
  }
  return expected === actual;
}

function destinationTextEqual(expected: string, actual: string): boolean {
  const expectedNorm = normalizeDestinationText(expected);
  const actualNorm = normalizeDestinationText(actual);
  if (expectedNorm === actualNorm) return true;

  const expectedDestination = STATIC_DESTINATIONS.find((destination) =>
    [destination.name, destination.nameHe, destination.city].some((value) => normalizeDestinationText(value ?? '') === expectedNorm),
  );
  const actualDestination = STATIC_DESTINATIONS.find((destination) =>
    [destination.name, destination.nameHe, destination.city].some((value) => normalizeDestinationText(value ?? '') === actualNorm),
  );
  return Boolean(expectedDestination && actualDestination && expectedDestination.id === actualDestination.id);
}

function normalizeComparable(value: string): string {
  return value.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatValue(value: unknown): string {
  return JSON.stringify(value);
}

function printSummary(summary: EvalRunSummary, caseCount: number): void {
  let passed = 0;
  let total = 0;
  for (const stat of summary.stats.values()) {
    passed += stat.pass;
    total += stat.total;
  }

  console.log(`\nSearch eval: ${summary.mode}`);
  console.log(`Cases: ${caseCount}`);
  console.log(`Overall: ${passed}/${total} (${percent(passed, total)})\n`);

  console.log(
    `Sources: ${Array.from(summary.sourceCounts.entries())
      .map(([source, count]) => `${source}=${count}`)
      .join(', ') || 'none'}`,
  );
  console.log('');

  for (const [field, stat] of Array.from(summary.stats.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`${field}: ${stat.pass}/${stat.total} (${percent(stat.pass, stat.total)})`);
  }

  if (summary.failedCases.length > 0) {
    console.log(`\nFailures:`);
    for (const failure of summary.failedCases.slice(0, 30)) {
      console.log(failure);
    }
    if (summary.failedCases.length > 30) {
      console.log(`... ${summary.failedCases.length - 30} more failures omitted`);
    }
  }
}

function percent(pass: number, total: number): string {
  return total === 0 ? '0.0%' : `${((pass / total) * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
  const evalPath = path.join(__dirname, 'search-eval.jsonl');
  const staticCases = readEvalCases(evalPath);
  const dbCases =
    process.env.EVAL_SEARCH_DB_CASES === 'true'
      ? await loadDbEvalCases(Number(process.env.EVAL_SEARCH_DB_LIMIT ?? 200))
      : [];
  const allCases = [...staticCases, ...dbCases];
  const evalLimit = Number(process.env.EVAL_SEARCH_LIMIT ?? 0);
  const cases = evalLimit > 0 ? allCases.slice(0, evalLimit) : allCases;
  if (dbCases.length > 0) {
    console.log(`Loaded ${dbCases.length} real feedback eval cases from search_feedback.`);
  }
  const classifier = new ClassifierService();
  const denominationClassifier = new DenominationClassifierService();
  classifier.onModuleInit();
  denominationClassifier.onModuleInit();

  const services = {
    classifier,
    restaurantClassifier: new SearchClassifierService(),
    denominationClassifier,
    aliasIndex: buildDestinationAliasIndex(STATIC_DESTINATIONS),
  };
  const destinationIndex = {
    getIndex: () => services.aliasIndex,
    fuzzyMatch: (candidates: string[]) => {
      const aliases = Array.from(services.aliasIndex.entries());
      for (const candidate of candidates) {
        const threshold = candidate.length <= 5 ? 1 : 2;
        for (const [alias, destination] of aliases) {
          if (Math.abs(alias.length - candidate.length) > threshold) continue;
          if (levenshtein(candidate, alias) <= threshold) return destination;
        }
      }
      return null;
    },
  };
  const parser = new QueryParserService(
    classifier,
    services.restaurantClassifier,
    denominationClassifier,
    { get: (key: string) => process.env[key] } as any,
    destinationIndex as any,
  );

  const fastSummary = await runParserEval('fast-path', cases, async (query) =>
    parser.parse(query, { allowLlm: false, bypassCache: true }),
  );
  printSummary(fastSummary, cases.length);

  const shouldRunLlm = process.env.EVAL_SEARCH_LLM === 'true';
  if (!shouldRunLlm) {
    console.log('\nLLM eval skipped. Run with EVAL_SEARCH_LLM=true to measure Claude separately.');
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('\nLLM eval skipped. ANTHROPIC_API_KEY is missing after loading backend/.env.');
    return;
  }

  const llmParser = new QueryParserService(
    classifier,
    services.restaurantClassifier,
    denominationClassifier,
    { get: (key: string) => process.env[key] } as any,
    destinationIndex as any,
  );

  const llmCases =
    process.env.EVAL_SEARCH_FAST_FAILURES_ONLY === 'true'
      ? fastSummary.results
          .filter((result) => result.failures.length > 0)
          .slice(0, Number(process.env.EVAL_SEARCH_FAST_FAILURE_LIMIT ?? 20))
          .map((result) => result.testCase)
      : cases;

  if (process.env.EVAL_SEARCH_FAST_FAILURES_ONLY === 'true') {
    console.log(`\nRunning LLM only on ${llmCases.length} fast-path failures.`);
  }

  const llmSummary = await runParserEval('llm-forced', llmCases, async (query) =>
    llmParser.parse(query, { allowLlm: true, forceLlm: true, bypassCache: true }),
  );
  printSummary(llmSummary, llmCases.length);
  printFastVsLlmComparison(fastSummary, llmSummary, Number(process.env.EVAL_SEARCH_COMPARE_LIMIT ?? 30));
}

async function loadDbEvalCases(limit: number): Promise<EvalCase[]> {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'];
  if (required.some((key) => !process.env[key])) {
    console.log('DB eval cases skipped. Database env vars are missing.');
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Client } = require('pg');
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  try {
    const result = await client.query(
      `SELECT DISTINCT ON (query)
         query,
         "detectedType" AS detected_type,
         "detectedKashrut" AS detected_kashrut,
         "detectedKeyword" AS detected_keyword,
         parsed_json
       FROM search_feedback
       WHERE query IS NOT NULL AND btrim(query) <> ''
       ORDER BY query, created_at DESC
       LIMIT $1`,
      [limit],
    );
    return (result.rows as FeedbackEvalRow[])
      .map(feedbackRowToEvalCase)
      .filter((testCase): testCase is EvalCase => testCase !== null);
  } finally {
    await client.end();
  }
}

function feedbackRowToEvalCase(row: FeedbackEvalRow): EvalCase | null {
  const query = row.query?.trim();
  if (!query) return null;

  if (row.parsed_json && typeof row.parsed_json === 'object') {
    return {
      query,
      expected: pruneParsedJsonForEval(row.parsed_json),
    };
  }

  const expected: Partial<ParsedEvalQuery> = {};
  if (row.detected_keyword === 'destination_only') {
    expected.category = 'destination';
  } else if (
    row.detected_keyword === 'restaurant' ||
    row.detected_keyword === 'synagogue' ||
    row.detected_keyword === 'minyan' ||
    row.detected_keyword === 'hosting'
  ) {
    expected.category = row.detected_keyword;
  }

  if (row.detected_type || row.detected_kashrut) {
    expected.restaurant = {
      dish: null,
      cuisine: null,
      type: normalizeFeedbackRestaurantType(row.detected_type),
      kashrut: normalizeFeedbackKashrut(row.detected_kashrut),
      priceLevel: null,
    };
  }

  return Object.keys(expected).length > 0 ? { query, expected } : null;
}

function pruneParsedJsonForEval(parsed: Partial<ParsedEvalQuery>): Partial<ParsedEvalQuery> {
  return {
    category: parsed.category,
    destinationText: parsed.destinationText,
    explicitDestination: parsed.explicitDestination,
    useCurrentLocation: parsed.useCurrentLocation,
    restaurant: parsed.restaurant
      ? {
          dish: parsed.restaurant.dish ?? null,
          cuisine: parsed.restaurant.cuisine ?? null,
          type: parsed.restaurant.type ?? null,
          kashrut: parsed.restaurant.kashrut ?? null,
          priceLevel: parsed.restaurant.priceLevel ?? null,
        }
      : undefined,
    synagogue: parsed.synagogue
      ? {
          denomination: parsed.synagogue.denomination ?? null,
        }
      : undefined,
    hosting: parsed.hosting
      ? {
          shabbat: parsed.hosting.shabbat ?? null,
          mealOrStay: parsed.hosting.mealOrStay ?? null,
        }
      : undefined,
  };
}

function normalizeFeedbackRestaurantType(type: string | null): 'meat' | 'dairy' | 'pareve' | null {
  if (type === 'meat' || type === 'dairy' || type === 'pareve') return type;
  if (type === 'parve') return 'pareve';
  return null;
}

function normalizeFeedbackKashrut(kashrut: string | null): 'rabbinate' | 'mehadrin' | 'badatz' | null {
  if (kashrut === 'rabbinate' || kashrut === 'mehadrin' || kashrut === 'badatz') return kashrut;
  return null;
}

async function runParserEval(
  mode: string,
  cases: EvalCase[],
  parse: (query: string) => Promise<{ parsed: ParsedEvalQuery; source: string }>,
): Promise<EvalRunSummary> {
  const stats = new Map<string, FieldStat>();
  const failedCases: string[] = [];
  const sourceCounts = new Map<string, number>();
  const results: EvalCaseResult[] = [];

  for (const testCase of cases) {
    const result = await parse(testCase.query);
    sourceCounts.set(result.source, (sourceCounts.get(result.source) ?? 0) + 1);
    const actual = result.parsed;
    const failures: string[] = [];
    comparePartial(testCase.expected, actual, '', stats, failures);
    if (failures.length > 0) {
      failedCases.push(`- ${testCase.query}\n  ${failures.join('\n  ')}`);
    }
    results.push({
      testCase,
      parsed: actual,
      source: result.source,
      failures,
    });
  }

  return { mode, stats, failedCases, sourceCounts, results };
}

function printFastVsLlmComparison(
  fastSummary: EvalRunSummary,
  llmSummary: EvalRunSummary,
  limit: number,
): void {
  const fastByCase = new Map(fastSummary.results.map((result) => [caseKey(result.testCase), result]));
  let fastFailedLlmPassed = 0;
  let bothFailed = 0;
  let fastPassedLlmFailed = 0;
  let changed = 0;
  const rows: string[] = [];

  for (const llmResult of llmSummary.results) {
    const fastResult = fastByCase.get(caseKey(llmResult.testCase));
    if (!fastResult) continue;

    const fastPassed = fastResult.failures.length === 0;
    const llmPassed = llmResult.failures.length === 0;
    const fieldDiffs = compareParsedFields(fastResult.parsed, llmResult.parsed);
    if (fieldDiffs.length > 0) changed += 1;
    if (!fastPassed && llmPassed) fastFailedLlmPassed += 1;
    if (!fastPassed && !llmPassed) bothFailed += 1;
    if (fastPassed && !llmPassed) fastPassedLlmFailed += 1;

    if (rows.length < limit && (!fastPassed || !llmPassed || fieldDiffs.length > 0)) {
      rows.push(
        [
          `- ${llmResult.testCase.query}`,
          `  expected: ${compactExpected(llmResult.testCase.expected)}`,
          `  fast: ${compactParsed(fastResult.parsed)} source=${fastResult.source}`,
          fastResult.failures.length > 0 ? `  fast failures: ${fastResult.failures.join('; ')}` : '  fast failures: none',
          `  llm:  ${compactParsed(llmResult.parsed)} source=${llmResult.source}`,
          llmResult.failures.length > 0 ? `  llm failures: ${llmResult.failures.join('; ')}` : '  llm failures: none',
          fieldDiffs.length > 0 ? `  changed fields: ${fieldDiffs.join('; ')}` : '  changed fields: none',
        ].join('\n'),
      );
    }
  }

  console.log('\nFast vs LLM comparison');
  console.log(`Compared cases: ${llmSummary.results.length}`);
  console.log(`Fast failed, LLM passed: ${fastFailedLlmPassed}`);
  console.log(`Both failed: ${bothFailed}`);
  console.log(`Fast passed, LLM failed: ${fastPassedLlmFailed}`);
  console.log(`Parsed JSON changed: ${changed}`);
  if (rows.length > 0) {
    console.log('\nField-by-field samples:');
    for (const row of rows) console.log(row);
  }
}

function caseKey(testCase: EvalCase): string {
  return `${testCase.query}\n${JSON.stringify(testCase.expected)}`;
}

function compareParsedFields(fast: ParsedEvalQuery, llm: ParsedEvalQuery): string[] {
  const paths = [
    'category',
    'destinationText',
    'explicitDestination',
    'useCurrentLocation',
    'queryText',
    'restaurant.dish',
    'restaurant.cuisine',
    'restaurant.type',
    'restaurant.kashrut',
    'restaurant.priceLevel',
    'synagogue.denomination',
    'hosting.shabbat',
    'hosting.mealOrStay',
  ];
  return paths
    .map((pathName) => {
      const fastValue = getPath(fast, pathName);
      const llmValue = getPath(llm, pathName);
      return valuesEqual(fastValue, llmValue, pathName)
        ? null
        : `${pathName}: fast=${formatValue(fastValue)} llm=${formatValue(llmValue)}`;
    })
    .filter((value): value is string => value !== null);
}

function getPath(value: unknown, pathName: string): unknown {
  return pathName.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function compactExpected(expected: Partial<ParsedEvalQuery>): string {
  return JSON.stringify(expected);
}

function compactParsed(parsed: ParsedEvalQuery): string {
  return JSON.stringify({
    category: parsed.category,
    destinationText: parsed.destinationText,
    explicitDestination: parsed.explicitDestination,
    useCurrentLocation: parsed.useCurrentLocation,
    dish: parsed.restaurant.dish,
    type: parsed.restaurant.type,
    kashrut: parsed.restaurant.kashrut,
    denomination: parsed.synagogue.denomination,
    mealOrStay: parsed.hosting.mealOrStay,
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
