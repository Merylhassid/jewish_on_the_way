/**
 * test-restaurant-queries.js
 * Tests 500+ restaurant queries against production server.
 * Run from project root: node backend/test-restaurant-queries.js
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://49.12.189.108:3000';
const CONCURRENCY = 3;
const REQUEST_DELAY_MS = 200; // delay between requests to avoid throttling
const TEL_AVIV_LAT = 32.0853;
const TEL_AVIV_LNG = 34.7818;
const TEL_AVIV_DEST_ID = 348;
let AUTH_TOKEN = null; // Will be fetched at startup

// ── Query generation ────────────────────────────────────────────────────────

const CITIES = [
  'תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'נתניה', 'רמת גן', 'אשדוד', 'אשקלון',
  'פתח תקווה', 'ראשון לציון', 'רחובות', 'הרצליה', 'כפר סבא', 'בני ברק',
  'בית שמש', 'בית שאן', 'רעננה', 'הוד השרון', 'נס ציונה', 'לוד',
  'מודיעין', 'יבנה', 'יהוד', 'עפולה', 'טבריה',
];

const FOOD_ITEMS_HEB = [
  'פיצה', 'המבורגר', 'בורגר', 'שווארמה', 'סושי', 'קבב', 'שניצל', 'פסטה',
  'קפה', 'גלידה', 'חומוס', 'פלאפל', 'דגים', 'עוף', 'סטייק', 'מנגל',
  'בורקס', 'אסאדו', 'וופל', 'לאזניה', 'בשר', 'סלט', 'עוגה',
];

const FOOD_ITEMS_ENG = [
  'pizza', 'burger', 'hamburger', 'shawarma', 'sushi', 'kebab', 'schnitzel', 'pasta',
  'cafe', 'coffee', 'ice cream', 'hummus', 'falafel', 'fish', 'chicken', 'steak',
  'grill', 'bbq', 'vegan', 'salad', 'bakery',
];

const KASHRUT = ['מהדרין', 'בדץ', 'רבנות', 'mehadrin', 'badatz'];
const TYPES_HEB = ['בשרי', 'חלבי', 'פרווה', 'בשרית', 'חלבית'];
const DIETARY = ['טבעוני', 'צמחוני', 'ללא גלוטן', 'vegan', 'vegetarian', 'gluten free'];
const OCCASIONS = ['ארוחת שבת', 'ארוחת חג', 'ארוחת ערב', 'ארוחת צהריים', 'breakfast', 'dinner'];
const CUISINE_TYPES = ['יפני', 'איטלקי', 'מקסיקני', 'אסייתי', 'מזרחי', 'אמריקאי', 'ים תיכוני'];
const PREFIXES_HEB = ['מסעדה', 'אוכל', 'מקום לאכול', 'מחפש', 'איפה', 'יש'];
const SEARCH_TERMS_ENG = ['restaurant', 'food', 'eat', 'kosher restaurant', 'kosher food'];

// Slang / informal
const SLANG = [
  'אוכל טוב', 'מסעדה טובה', 'איפה אוכלים', 'מה לאכול', 'אוכל כשר',
  'מסעדה כשרה', 'מקום לאכול', 'אוכל טעים', 'מסעדה מומלצת',
];

// Typos / partial words
const TYPOS = [
  'פיצריה', 'שוארמה', 'בורגרים', 'סטייקהאוס', 'שינצל',
  'פיצה כשרה', 'בורגר כשר', 'שווארמה כשרה', 'סושי כשר',
  'המברגר', 'שניצלון', 'פלאפלים',
];

function generateQueries() {
  const queries = new Set();

  // Single food items (Hebrew)
  for (const food of FOOD_ITEMS_HEB) {
    queries.add(food);
    queries.add(`${food} כשר`);
    queries.add(`${food} כשרה`);
  }

  // Single food items (English)
  for (const food of FOOD_ITEMS_ENG) {
    queries.add(food);
    queries.add(`kosher ${food}`);
    queries.add(`${food} kosher`);
  }

  // Food + city (Hebrew)
  for (const food of FOOD_ITEMS_HEB) {
    for (const city of CITIES.slice(0, 10)) {
      queries.add(`${food} ב${city}`);
      queries.add(`${food} ${city}`);
    }
  }

  // Food + kashrut
  for (const food of FOOD_ITEMS_HEB.slice(0, 8)) {
    for (const k of KASHRUT) {
      queries.add(`${food} ${k}`);
    }
  }

  // Food + type
  for (const food of FOOD_ITEMS_HEB.slice(0, 10)) {
    for (const t of TYPES_HEB) {
      queries.add(`${food} ${t}`);
    }
  }

  // מסעדה + city
  for (const city of CITIES) {
    queries.add(`מסעדה ב${city}`);
    queries.add(`מסעדה כשרה ב${city}`);
    queries.add(`מסעדות ב${city}`);
    queries.add(`אוכל ב${city}`);
    queries.add(`אוכל כשר ב${city}`);
  }

  // Extra focus on "בית" cities
  const BEIT_CITIES = ['בית שמש', 'בית שאן'];
  for (const city of BEIT_CITIES) {
    for (const food of FOOD_ITEMS_HEB) {
      queries.add(`${food} ב${city}`);
      queries.add(`${food} ${city}`);
      queries.add(`מסעדה ב${city}`);
    }
    queries.add(`פיצה מהדרין ב${city}`);
    queries.add(`בשרי ב${city}`);
    queries.add(`חלבי ב${city}`);
    queries.add(`קפה ב${city}`);
  }

  // Dietary restrictions
  for (const d of DIETARY) {
    queries.add(d);
    for (const city of CITIES.slice(0, 5)) {
      queries.add(`${d} ב${city}`);
    }
  }

  // Occasions
  for (const occ of OCCASIONS) {
    queries.add(occ);
    for (const city of CITIES.slice(0, 5)) {
      queries.add(`${occ} ב${city}`);
    }
  }

  // Cuisine types
  for (const cuisine of CUISINE_TYPES) {
    queries.add(`מסעדה ${cuisine}`);
    queries.add(`אוכל ${cuisine}`);
    for (const city of CITIES.slice(0, 5)) {
      queries.add(`אוכל ${cuisine} ב${city}`);
    }
  }

  // Slang
  for (const s of SLANG) {
    queries.add(s);
    queries.add(`${s} בתל אביב`);
  }

  // Typos
  for (const t of TYPOS) {
    queries.add(t);
  }

  // Prefix + food
  for (const prefix of PREFIXES_HEB) {
    for (const food of FOOD_ITEMS_HEB.slice(0, 6)) {
      queries.add(`${prefix} ${food}`);
    }
  }

  // English search terms
  for (const term of SEARCH_TERMS_ENG) {
    queries.add(term);
    queries.add(`${term} tel aviv`);
    queries.add(`${term} jerusalem`);
    queries.add(`${term} haifa`);
  }

  // Kashrut alone
  for (const k of KASHRUT) {
    queries.add(k);
    queries.add(`מסעדה ${k}`);
  }

  // Type alone with city
  for (const t of TYPES_HEB) {
    queries.add(t);
    for (const city of CITIES.slice(0, 5)) {
      queries.add(`${t} ב${city}`);
    }
  }

  // Food + kashrut + city
  for (const food of ['פיצה', 'בורגר', 'שווארמה']) {
    for (const k of ['מהדרין', 'בדץ']) {
      for (const city of CITIES.slice(0, 6)) {
        queries.add(`${food} ${k} ב${city}`);
      }
    }
  }

  // Mixed Hebrew/English
  queries.add('pizza kosher');
  queries.add('burger mehadrin');
  queries.add('sushi tel aviv');
  queries.add('kosher pizza jerusalem');
  queries.add('restaurant near me');
  queries.add('מסעדה near me');

  // Multi-word natural language
  queries.add('אני מחפש מסעדה בשרית');
  queries.add('איפה יש פיצה טובה');
  queries.add('מחפש שווארמה כשרה');
  queries.add('יש איפה לאכול סושי');
  queries.add('מסעדה לארוחת שבת');
  queries.add('מחפש מקום לאכול בשרי');
  queries.add('פיצה חלבית מהדרין');
  queries.add('בשרי מהדרין בירושלים');
  queries.add('חלבי בתל אביב');
  queries.add('מסעדה טבעונית');
  queries.add('שווארמה בבית שמש');
  queries.add('פיצה בבית שאן');
  queries.add('בורגר בבית שמש');
  queries.add('מסעדה בבית שמש');
  queries.add('קפה בבית שאן');
  queries.add('אוכל בריא');
  queries.add('אוכל בריא בתל אביב');
  queries.add('מסעדה ים תיכונית');
  queries.add('מסעדה יפנית');
  queries.add('סושי כשר בתל אביב');
  queries.add('דגים בחיפה');
  queries.add('חומוס טוב');
  queries.add('פלאפל בירושלים');
  queries.add('שניצל עוף');
  queries.add('קבב בשרי');
  queries.add('גריל כשר');
  queries.add('מנגל כשר');

  return Array.from(queries);
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const lib = options.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error('Request timeout'));
    });
    if (body) req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postSearchWithRetry(text, lat, lng, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const body = JSON.stringify({ text, lat, lng });
    const url = new URL(`${BASE_URL}/search`);
    const res = await httpRequest({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, body);
    if (res.status === 429) {
      // Rate limited — wait and retry
      await sleep(2000 + attempt * 1000);
      continue;
    }
    return res;
  }
  return { status: 429, body: { error: 'rate_limited', message: 'Too many requests after retries' } };
}

function postSearch(text, lat, lng) {
  return postSearchWithRetry(text, lat, lng);
}

async function getRestaurantSearch(q, destinationId) {
  const path = `/restaurants/search?q=${encodeURIComponent(q)}&destinationId=${destinationId}`;
  const url = new URL(`${BASE_URL}${path}`);
  const headers = {};
  if (AUTH_TOKEN) headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await httpRequest({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers,
    });
    if (res.status === 429) {
      await sleep(2000 + attempt * 1000);
      continue;
    }
    return res;
  }
  return { status: 429, body: { error: 'rate_limited' } };
}

async function fetchAuthToken() {
  const body = JSON.stringify({ email: 'daniyehudai@gmail.com', password: 'daniel2109' });
  const url = new URL(`${BASE_URL}/auth/login`);
  const res = await httpRequest({
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || 80,
    path: '/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  return res.body?.access_token ?? null;
}

// ── Concurrency limiter ───────────────────────────────────────────────────────

async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      try {
        results[i] = await tasks[i]();
      } catch (e) {
        results[i] = { error: e.message };
      }
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching auth token...');
  AUTH_TOKEN = await fetchAuthToken();
  if (!AUTH_TOKEN) {
    console.warn('WARNING: Could not fetch auth token — restaurant search will return Unauthorized');
  } else {
    console.log('Auth token obtained.');
  }

  console.log('Generating queries...');
  const queries = generateQueries();
  console.log(`Generated ${queries.length} unique queries\n`);

  const homePassQueries = [];
  const homeFailures = { WRONG_CATEGORY: [], NO_CITY: [] };
  const searchPassCount = { count: 0 };
  const searchFailures = { NO_RESULTS: [] };

  console.log(`Testing ${queries.length} queries with concurrency=${CONCURRENCY}...`);
  console.log('Progress: . = 10 queries\n');

  let processed = 0;

  const tasks = queries.map((query, i) => async () => {
    // Step 1: Home screen flow
    let homeResult;
    try {
      const res = await postSearch(query, TEL_AVIV_LAT, TEL_AVIV_LNG);
      homeResult = res.body;
    } catch (e) {
      homeResult = { error: e.message };
    }

    processed++;
    if (processed % 10 === 0) process.stdout.write('.');
    if (processed % 100 === 0) process.stdout.write(` [${processed}]\n`);
    await sleep(REQUEST_DELAY_MS);

    const category = homeResult?.category;
    const detectedCity = homeResult?.detectedCity ?? homeResult?.destinationId ?? null;
    const homeError = homeResult?.error;

    // Skip rate-limited responses — don't count as failures
    if (homeResult?.statusCode === 429 || homeError === 'rate_limited') {
      return; // skip this query
    }

    const homePass = category === 'restaurant' && detectedCity !== null && detectedCity !== undefined;

    if (!homePass) {
      if (homeError || category !== 'restaurant') {
        homeFailures.WRONG_CATEGORY.push({
          query,
          category: category ?? homeError ?? 'unknown',
          confidence: homeResult?.confidence,
          raw: homeResult,
        });
      } else {
        // category is restaurant but no city
        homeFailures.NO_CITY.push({
          query,
          category,
          raw: homeResult,
        });
      }
      return;
    }

    homePassQueries.push(query);

    // Step 2: Restaurant search flow
    let searchResult;
    try {
      const res = await getRestaurantSearch(query, TEL_AVIV_DEST_ID);
      searchResult = res.body;
    } catch (e) {
      searchResult = { error: e.message };
    }

    const matchTier = searchResult?.matchTier;
    const total = searchResult?.total ?? 0;
    const searchPass = total > 0 && matchTier <= 3;

    if (searchPass) {
      searchPassCount.count++;
    } else {
      searchFailures.NO_RESULTS.push({
        query,
        total,
        matchTier,
        message: searchResult?.message,
        raw: searchResult,
      });
    }
  });

  await runWithConcurrency(tasks, CONCURRENCY);
  process.stdout.write('\n\n');

  // ── Summary ────────────────────────────────────────────────────────────────
  const totalQueries = queries.length;
  const homePass = homePassQueries.length;
  const homeFail = homeFailures.WRONG_CATEGORY.length + homeFailures.NO_CITY.length;
  const searchTested = homePassQueries.length;
  const searchPass = searchPassCount.count;
  const searchFail = searchFailures.NO_RESULTS.length;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Total queries tested:    ${totalQueries}`);
  console.log(`Home screen PASSes:      ${homePass}  (${((homePass/totalQueries)*100).toFixed(1)}%)`);
  console.log(`Home screen FAILs:       ${homeFail}  (${((homeFail/totalQueries)*100).toFixed(1)}%)`);
  console.log(`Restaurant search tested: ${searchTested}`);
  console.log(`Search PASSes:           ${searchPass}  (${searchTested > 0 ? ((searchPass/searchTested)*100).toFixed(1) : 0}%)`);
  console.log(`Search FAILs:            ${searchFail}  (${searchTested > 0 ? ((searchFail/searchTested)*100).toFixed(1) : 0}%)`);
  console.log('');

  if (homeFailures.WRONG_CATEGORY.length > 0) {
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`WRONG_CATEGORY (${homeFailures.WRONG_CATEGORY.length} failures):`);
    console.log('  category !== "restaurant" — returned category shown');
    console.log('');
    // Group by returned category
    const grouped = {};
    for (const f of homeFailures.WRONG_CATEGORY) {
      const k = String(f.category);
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(f.query);
    }
    for (const [cat, qs] of Object.entries(grouped)) {
      console.log(`  [${cat}]:`);
      for (const q of qs) {
        console.log(`    - "${q}"`);
      }
    }
    console.log('');
  }

  if (homeFailures.NO_CITY.length > 0) {
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`NO_CITY (${homeFailures.NO_CITY.length} failures):`);
    console.log('  category=restaurant but no city/destinationId returned (GPS should have resolved)');
    console.log('');
    for (const f of homeFailures.NO_CITY) {
      console.log(`  - "${f.query}"`);
    }
    console.log('');
  }

  if (searchFailures.NO_RESULTS.length > 0) {
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`NO_RESULTS (${searchFailures.NO_RESULTS.length} failures):`);
    console.log('  total=0 or matchTier=4');
    console.log('');
    for (const f of searchFailures.NO_RESULTS) {
      console.log(`  - "${f.query}" → tier=${f.matchTier}, total=${f.total}, msg="${f.message}"`);
    }
    console.log('');
  }

  if (homeFailures.WRONG_CATEGORY.length === 0 && homeFailures.NO_CITY.length === 0 && searchFailures.NO_RESULTS.length === 0) {
    console.log('All queries PASSED! No failures found.');
  }

  console.log('═══════════════════════════════════════════════════════════════');

  // Return structured for programmatic use
  return {
    totalQueries,
    homePass,
    homeFail,
    searchTested,
    searchPass,
    searchFail,
    failures: {
      WRONG_CATEGORY: homeFailures.WRONG_CATEGORY,
      NO_CITY: homeFailures.NO_CITY,
      NO_RESULTS: searchFailures.NO_RESULTS,
    },
  };
}

main().catch(console.error);
