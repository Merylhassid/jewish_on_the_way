/*
 * Generates and runs a 500-query benchmark for the application search flow.
 *
 * Usage:
 *   BENCH_EMAIL=... BENCH_PASSWORD=... BENCH_COUNT=1000 node docs/search-benchmark-500-runner.js --generate --run
 *
 * Outputs:
 *   docs/search-benchmark-<count>.json
 *   docs/search-benchmark-<count>.txt
 *   docs/search-benchmark-<count>-results.json
 *   docs/search-benchmark-<count>-report.md
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = process.env.BENCH_SERVER || 'http://49.12.189.108:3000';
const EMAIL = process.env.BENCH_EMAIL;
const PASSWORD = process.env.BENCH_PASSWORD;
const TARGET_COUNT = Number(process.env.BENCH_COUNT || 1000);
const RUN_START = Number(process.env.BENCH_START || 0);
const RUN_LIMIT = process.env.BENCH_LIMIT ? Number(process.env.BENCH_LIMIT) : null;

const OUT_JSON = path.join(ROOT, 'docs', `search-benchmark-${TARGET_COUNT}.json`);
const OUT_TXT = path.join(ROOT, 'docs', `search-benchmark-${TARGET_COUNT}.txt`);
const OUT_RESULTS = path.join(ROOT, 'docs', `search-benchmark-${TARGET_COUNT}-results.json`);
const OUT_REPORT = path.join(ROOT, 'docs', `search-benchmark-${TARGET_COUNT}-report.md`);

const TEL_AVIV_GPS = { lat: 32.0853, lng: 34.7818 };

function request(method, url, body, token) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const lib = parsed.protocol === 'https:' ? https : http;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = lib.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers,
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', (err) => resolve({ status: 0, body: { error: err.message } }));
    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ status: 0, body: { error: 'timeout' } });
    });
    if (data) req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login() {
  if (!EMAIL || !PASSWORD) {
    throw new Error('BENCH_EMAIL and BENCH_PASSWORD must be set.');
  }
  const res = await request('POST', `${SERVER}/auth/login`, { email: EMAIL, password: PASSWORD });
  if (res.status !== 200 || !res.body?.access_token) {
    throw new Error(`Login failed: status=${res.status}`);
  }
  return res.body.access_token;
}

async function fetchDestinations(token) {
  const res = await request('GET', `${SERVER}/destinations`, null, token);
  if (res.status !== 200 || !Array.isArray(res.body)) {
    throw new Error(`Failed to fetch destinations: status=${res.status}`);
  }
  const flat = [];
  for (const country of res.body) {
    for (const child of country.children || []) {
      flat.push({
        id: child.id,
        city: child.city || child.name,
        name: child.name,
        nameHe: child.nameHe || null,
        country: child.country,
      });
    }
  }
  return flat;
}

function labelOf(dest, preferHebrew) {
  return preferHebrew && dest.nameHe ? dest.nameHe : dest.city;
}

function prefixedHebrew(dest) {
  const label = labelOf(dest, true);
  return /[א-ת]/.test(label) ? `ב${label}` : `in ${label}`;
}

function buildBenchmark(destinations) {
  const byCity = new Map(destinations.map((d) => [d.city, d]));
  const afula = byCity.get('Afula') || destinations.find((d) => d.nameHe === 'עפולה') || destinations[0];
  const telAviv = byCity.get('Tel Aviv') || destinations.find((d) => d.id === 348) || destinations[0];

  const foreign = destinations.filter((d) => !['Israel'].includes(d.country));
  const israel = destinations.filter((d) => d.country === 'Israel');
  const mixedDests = [...foreign.slice(0, 25), ...israel.slice(0, 55)];
  const querySet = new Set();
  const queries = [];
  const targets = {
    restaurant: Math.floor(TARGET_COUNT * 0.5),
    synagogue: Math.floor(TARGET_COUNT * 0.25),
    minyan: Math.floor(TARGET_COUNT * 0.15),
    hosting: TARGET_COUNT - Math.floor(TARGET_COUNT * 0.5) - Math.floor(TARGET_COUNT * 0.25) - Math.floor(TARGET_COUNT * 0.15),
  };

  function add(category, query, dest, meta = {}) {
    if (queries.length >= TARGET_COUNT || querySet.has(query)) return;
    querySet.add(query);
    queries.push({
      id: `q${String(queries.length + 1).padStart(3, '0')}`,
      query,
      expectedCategory: category,
      expectedDestinationId: dest ? dest.id : null,
      expectedDestination: dest ? dest.city : 'GPS fallback',
      language: meta.language || (/[א-ת]/.test(query) && /[a-z]/i.test(query) ? 'mixed' : /[א-ת]/.test(query) ? 'hebrew' : 'english'),
      difficulty: meta.difficulty || 'medium',
      focus: meta.focus || category,
      shouldHaveResults: true,
      notes: meta.notes || '',
    });
  }

  const restaurantFoods = [
    'פיצה', 'המבורגר', 'בורגר', 'שווארמה', 'סושי', 'פסטה', 'קפה', 'גלידה',
    'חומוס', 'פלאפל', 'דגים', 'סטייק', 'בורקס', 'בורקס גבינה', 'בורקס תפוח אדמה',
    'מאפייה', 'ארוחת בוקר', 'סלט', 'וופל', 'לאזניה', 'אוכל טבעוני', 'שניצל',
  ];
  const restaurantTemplates = [
    (food, d) => `${food} ${prefixedHebrew(d)}`,
    (food, d) => `מחפש ${food} כשר ${prefixedHebrew(d)}`,
    (food, d) => `איפה אפשר לאכול ${food} ${prefixedHebrew(d)}?`,
    (food, d) => `${food} מהדרין ${prefixedHebrew(d)}`,
    (food, d) => `kosher ${food} in ${d.city}`,
    (food, d) => `${food} near me in ${d.city}`,
  ];
  for (let i = 0; queries.filter((q) => q.expectedCategory === 'restaurant').length < targets.restaurant; i++) {
    const food = restaurantFoods[i % restaurantFoods.length];
    const dest = mixedDests[i % mixedDests.length] || telAviv;
    const tmpl = restaurantTemplates[i % restaurantTemplates.length];
    add('restaurant', tmpl(food, dest), dest, {
      difficulty: food.includes(' ') || i % 5 === 0 ? 'hard' : 'medium',
      focus: food,
      notes: 'Restaurant query should route to restaurants and return non-empty restaurant results.',
    });
  }

  const synagoguePhrases = [
    'בית כנסת', 'בית כנסת ספרדי', 'בית כנסת ספרדית', 'נוסח ספרד',
    'בית כנסת חב"ד', 'בית כנסת חב״ד', 'בית כנסת חבד',
    'בית כנסת אשכנזי', 'קהילה יהודית', 'chabad house', 'synagogue',
    'sephardi synagogue', 'jewish community',
  ];
  for (let i = 0; queries.filter((q) => q.expectedCategory === 'synagogue').length < targets.synagogue; i++) {
    const phrase = synagoguePhrases[i % synagoguePhrases.length];
    const dest = mixedDests[(i * 3) % mixedDests.length] || telAviv;
    const q = /[א-ת]/.test(phrase)
      ? `${phrase} ${prefixedHebrew(dest)}`
      : `${phrase} in ${dest.city}`;
    add('synagogue', q, dest, {
      difficulty: /ספרד|חב/.test(q) ? 'hard' : 'medium',
      focus: phrase,
      notes: 'Synagogue query should route to synagogues; denomination phrases test Sfarad/Spain and Chabad normalization.',
    });
  }

  const minyanPhrases = [
    'מניין שחרית', 'מניין מנחה', 'מניין ערבית', 'צריך מניין לשחרית מחר',
    'איפה מתפללים שחרית', 'יש מניין קרוב', 'minyan shacharit',
    'mincha minyan', 'maariv minyan', 'prayer quorum',
  ];
  const minyanModifiers = [
    '', ' היום', ' מחר', ' בבוקר', ' בערב', ' קרוב אליי', ' ספרדי', ' חב"ד',
    ' נוסח ספרד', ' אשכנזי', ' תימני', ' בשעה מוקדמת', ' בשעה מאוחרת',
    ' for tomorrow', ' near me', ' tonight', ' early morning', ' with chabad',
  ];
  for (let i = 0; queries.filter((q) => q.expectedCategory === 'minyan').length < targets.minyan; i++) {
    const phrase = minyanPhrases[i % minyanPhrases.length];
    const modifier = minyanModifiers[Math.floor(i / minyanPhrases.length) % minyanModifiers.length];
    const q = /[א-ת]/.test(phrase)
      ? `${phrase}${modifier} ${prefixedHebrew(afula)}`
      : `${phrase}${modifier} in ${afula.city}`;
    add('minyan', q, afula, {
      difficulty: i % 4 === 0 ? 'hard' : 'medium',
      focus: phrase,
      notes: 'Afula is used because the current production DB has upcoming minyan data there.',
    });
  }

  const hostingPhrases = [
    'משפחה שמארחת בשבת', 'אירוח שבת', 'מחפש איפה להתארח לשבת',
    'יש משפחה שמארחת לשבת?', 'איפה אפשר לאכול בשבת אצל משפחה',
    'need shabbat hosting', 'family hosting for shabbat', 'shabbat meal with a family',
    'looking for a host family', 'אירוח למשפחה עם ילדים',
  ];
  const hostingModifiers = [
    '', ' לשני אנשים', ' למשפחה', ' עם ילדים', ' לסופש', ' השבוע',
    ' מחר', ' בשבת הקרובה', ' לארוחת ערב', ' for 2 people',
    ' for a family', ' this week', ' near me', ' tomorrow', ' for dinner',
  ];
  for (let i = 0; queries.filter((q) => q.expectedCategory === 'hosting').length < targets.hosting; i++) {
    const phrase = hostingPhrases[i % hostingPhrases.length];
    const modifier = hostingModifiers[Math.floor(i / hostingPhrases.length) % hostingModifiers.length];
    const q = /[א-ת]/.test(phrase)
      ? `${phrase}${modifier} ${prefixedHebrew(afula)}`
      : `${phrase}${modifier} in ${afula.city}`;
    add('hosting', q, afula, {
      difficulty: i % 3 === 0 ? 'hard' : 'medium',
      focus: phrase,
      notes: 'Afula is used because the current production DB has active hosting offers there.',
    });
  }

  const nearMe = [
    ['restaurant', 'איפה אפשר לאכול כשר קרוב אליי?', telAviv],
    ['restaurant', 'coffee kosher near me', telAviv],
    ['restaurant', 'בא לי סטייק כשר', telAviv],
    ['synagogue', 'בית כנסת חב״ד קרוב אליי', telAviv],
    ['synagogue', 'מחפש קהילה יהודית קרובה', telAviv],
  ];
  for (const [category, query, dest] of nearMe) {
    add(category, query, null, {
      difficulty: 'hard',
      focus: 'GPS fallback',
      notes: `No explicit destination; benchmark expects GPS fallback near ${dest.city}.`,
    });
  }

  return {
    name: `Jewish On The Way Search Benchmark ${TARGET_COUNT}`,
    generatedAt: new Date().toISOString(),
    server: SERVER,
    gps: TEL_AVIV_GPS,
    targetCount: TARGET_COUNT,
    queryCount: queries.length,
    distribution: queries.reduce((acc, q) => {
      acc[q.expectedCategory] = (acc[q.expectedCategory] || 0) + 1;
      return acc;
    }, {}),
    queries,
  };
}

function writeBenchmark(benchmark) {
  fs.writeFileSync(OUT_JSON, JSON.stringify(benchmark, null, 2), 'utf8');
  const txt = benchmark.queries.map((q) =>
    `${q.id}\t${q.expectedCategory}\t${q.expectedDestination}\t${q.query}`
  ).join('\n') + '\n';
  fs.writeFileSync(OUT_TXT, txt, 'utf8');
}

function destinationIdFromRoute(route) {
  const match = String(route || '').match(/\/(?:restaurants|synagogues|minyans|hosting)\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function okStatus(status) {
  return status >= 200 && status < 300;
}

async function checkResults(q, searchResult, token) {
  const destId = searchResult.destinationId || destinationIdFromRoute(searchResult.route) || q.expectedDestinationId;
  if (!destId) return { checked: false, pass: false, count: 0, endpoint: null, reason: 'no destination id' };

  if (q.expectedCategory === 'restaurant') {
    const url = `${SERVER}/restaurants/search?destinationId=${destId}&q=${encodeURIComponent(q.query)}`;
    const res = await request('GET', url, null, token);
    return {
      checked: true,
      pass: okStatus(res.status) && Number(res.body?.total || 0) > 0 && Number(res.body?.matchTier || 9) <= 3,
      count: Number(res.body?.total || 0),
      endpoint: '/restaurants/search',
      matchTier: res.body?.matchTier ?? null,
      message: res.body?.message ?? null,
      status: res.status,
    };
  }

  if (q.expectedCategory === 'synagogue') {
    const denom = searchResult.denomination ? `&denomination=${encodeURIComponent(searchResult.denomination)}` : '';
    const url = `${SERVER}/synagogues?destinationId=${destId}${denom}`;
    const res = await request('GET', url, null, token);
    return {
      checked: true,
      pass: okStatus(res.status) && Number(res.body?.total || 0) > 0,
      count: Number(res.body?.total || 0),
      endpoint: '/synagogues',
      denomination: searchResult.denomination ?? null,
      status: res.status,
    };
  }

  if (q.expectedCategory === 'minyan') {
    const url = `${SERVER}/minyans?destinationId=${destId}`;
    const res = await request('GET', url, null, token);
    return {
      checked: true,
      pass: okStatus(res.status) && Array.isArray(res.body) && res.body.length > 0,
      count: Array.isArray(res.body) ? res.body.length : 0,
      endpoint: '/minyans',
      status: res.status,
    };
  }

  if (q.expectedCategory === 'hosting') {
    const url = `${SERVER}/hosting/offers/search?destinationId=${destId}&limit=20`;
    const res = await request('GET', url, null, token);
    return {
      checked: true,
      pass: okStatus(res.status) && Array.isArray(res.body) && res.body.length > 0,
      count: Array.isArray(res.body) ? res.body.length : 0,
      endpoint: '/hosting/offers/search',
      status: res.status,
    };
  }

  return { checked: false, pass: false, count: 0, endpoint: null, reason: 'unknown category' };
}

async function runBenchmark(token) {
  const benchmark = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
  const existing = fs.existsSync(OUT_RESULTS)
    ? JSON.parse(fs.readFileSync(OUT_RESULTS, 'utf8')).results || []
    : [];
  const resultById = new Map(existing.map((r) => [r.id, r]));
  const runQueries = benchmark.queries.slice(
    RUN_START,
    RUN_LIMIT == null ? undefined : RUN_START + RUN_LIMIT,
  );

  const writePartial = () => {
    const results = benchmark.queries
      .map((q) => resultById.get(q.id))
      .filter(Boolean);
    const payload = {
      benchmark: benchmark.name,
      ranAt: new Date().toISOString(),
      server: SERVER,
      completed: results.length,
      target: benchmark.queries.length,
      totals: summarize(results),
      results,
    };
    fs.writeFileSync(OUT_RESULTS, JSON.stringify(payload, null, 2), 'utf8');
    fs.writeFileSync(OUT_REPORT, renderReport(payload), 'utf8');
    return payload;
  };

  let lastPayload = writePartial();

  for (let i = 0; i < runQueries.length; i++) {
    const q = runQueries[i];
    if (resultById.has(q.id)) {
      continue;
    }
    const searchRes = await request('POST', `${SERVER}/search`, {
      text: q.query,
      lat: TEL_AVIV_GPS.lat,
      lng: TEL_AVIV_GPS.lng,
    }, token);
    const body = searchRes.body || {};

    const categoryPass = okStatus(searchRes.status) && body.category === q.expectedCategory;
    const gotDestId = body.destinationId || destinationIdFromRoute(body.route);
    const destinationPass = q.expectedDestinationId == null
      ? Boolean(gotDestId)
      : gotDestId === q.expectedDestinationId;
    const resultCheck = categoryPass && destinationPass
      ? await checkResults(q, body, token)
      : { checked: false, pass: false, count: 0, endpoint: null, reason: 'search routing failed' };

    resultById.set(q.id, {
      ...q,
      status: searchRes.status,
      gotCategory: body.category ?? null,
      confidence: body.confidence ?? null,
      gotDestinationId: gotDestId ?? null,
      gotCity: body.detectedCity ?? null,
      route: body.route ?? null,
      error: body.error ?? null,
      categoryPass,
      destinationPass,
      resultPass: resultCheck.pass,
      result: resultCheck,
      overallPass: categoryPass && destinationPass && resultCheck.pass,
    });

    if ((i + 1) % 25 === 0) {
      lastPayload = writePartial();
      process.stdout.write(`${RUN_START + i + 1}/${benchmark.queries.length} `);
    }
    await sleep(50);
  }

  lastPayload = writePartial();
  return lastPayload;
}

function summarize(results) {
  const total = results.length;
  const overallPass = results.filter((r) => r.overallPass).length;
  const categoryPass = results.filter((r) => r.categoryPass).length;
  const destinationPass = results.filter((r) => r.destinationPass).length;
  const resultPass = results.filter((r) => r.resultPass).length;
  const byCategory = {};
  for (const r of results) {
    byCategory[r.expectedCategory] ||= { total: 0, overallPass: 0, categoryPass: 0, destinationPass: 0, resultPass: 0 };
    byCategory[r.expectedCategory].total++;
    if (r.overallPass) byCategory[r.expectedCategory].overallPass++;
    if (r.categoryPass) byCategory[r.expectedCategory].categoryPass++;
    if (r.destinationPass) byCategory[r.expectedCategory].destinationPass++;
    if (r.resultPass) byCategory[r.expectedCategory].resultPass++;
  }
  return { total, overallPass, categoryPass, destinationPass, resultPass, byCategory };
}

function pct(n, d) {
  return d ? `${((n / d) * 100).toFixed(1)}%` : '0.0%';
}

function topFailures(results, predicate, max = 20) {
  return results.filter(predicate).slice(0, max).map((r) =>
    `| ${r.id} | ${r.expectedCategory} | ${r.query.replace(/\|/g, '/')} | ${r.gotCategory || '-'} | ${r.expectedDestination} | ${r.gotCity || r.gotDestinationId || '-'} | ${r.result?.count ?? 0} | ${r.result?.message || r.error || r.result?.reason || ''} |`
  ).join('\n');
}

function renderReport(payload) {
  const s = payload.totals;
  const lines = [];
  lines.push('# Search Benchmark 500 Report');
  lines.push('');
  lines.push(`Ran at: ${payload.ranAt}`);
  lines.push(`Server: ${payload.server}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  if (payload.target) {
    lines.push(`- Completed queries: ${payload.completed}/${payload.target}`);
  }
  lines.push(`- Evaluated queries in this report: ${s.total}`);
  lines.push(`- Overall pass: ${s.overallPass}/${s.total} (${pct(s.overallPass, s.total)})`);
  lines.push(`- Category pass: ${s.categoryPass}/${s.total} (${pct(s.categoryPass, s.total)})`);
  lines.push(`- Destination pass: ${s.destinationPass}/${s.total} (${pct(s.destinationPass, s.total)})`);
  lines.push(`- Result pass: ${s.resultPass}/${s.total} (${pct(s.resultPass, s.total)})`);
  lines.push('');
  lines.push('## By Category');
  lines.push('');
  lines.push('| Category | Total | Overall | Category | Destination | Results |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const [cat, row] of Object.entries(s.byCategory)) {
    lines.push(`| ${cat} | ${row.total} | ${row.overallPass} (${pct(row.overallPass, row.total)}) | ${row.categoryPass} | ${row.destinationPass} | ${row.resultPass} |`);
  }
  lines.push('');
  lines.push('## Category Failures');
  lines.push('');
  lines.push('| ID | Expected | Query | Got category | Expected dest | Got dest/city | Result count | Note |');
  lines.push('|---|---|---|---|---|---|---:|---|');
  lines.push(topFailures(payload.results, (r) => !r.categoryPass) || '| - | - | none | - | - | - | - | - |');
  lines.push('');
  lines.push('## Destination Failures');
  lines.push('');
  lines.push('| ID | Expected | Query | Got category | Expected dest | Got dest/city | Result count | Note |');
  lines.push('|---|---|---|---|---|---|---:|---|');
  lines.push(topFailures(payload.results, (r) => r.categoryPass && !r.destinationPass) || '| - | - | none | - | - | - | - | - |');
  lines.push('');
  lines.push('## Result Failures');
  lines.push('');
  lines.push('| ID | Expected | Query | Got category | Expected dest | Got dest/city | Result count | Note |');
  lines.push('|---|---|---|---|---|---|---:|---|');
  lines.push(topFailures(payload.results, (r) => r.categoryPass && r.destinationPass && !r.resultPass, 30) || '| - | - | none | - | - | - | - | - |');
  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  lines.push('- Separate intent classification success from result retrieval success in the final report.');
  lines.push('- For restaurant search, improve multi-word food handling so strong base terms like "בורקס" are not lost inside longer phrases such as "בורקס גבינה".');
  lines.push('- For synagogue searches, review denomination filtering: if a denomination is detected but no matching records exist, fallback to all synagogues in that destination with a clear message.');
  lines.push('- For minyan and hosting, the production DB currently has very sparse data; do not evaluate those features using many different cities unless more data is seeded.');
  lines.push('- Keep this benchmark fixed and re-run it after every search change before submission.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const shouldGenerate = process.argv.includes('--generate');
  const shouldRun = process.argv.includes('--run');
  const token = await login();

  if (shouldGenerate) {
    const destinations = await fetchDestinations(token);
    const benchmark = buildBenchmark(destinations);
    writeBenchmark(benchmark);
    console.log(`Generated ${benchmark.queries.length} queries`);
    console.log(OUT_JSON);
    console.log(OUT_TXT);
  }

  if (shouldRun) {
    if (!fs.existsSync(OUT_JSON)) throw new Error('Benchmark JSON missing. Run with --generate first.');
    const result = await runBenchmark(token);
    console.log('\nDone');
    console.log(JSON.stringify(result.totals, null, 2));
    console.log(OUT_RESULTS);
    console.log(OUT_REPORT);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
