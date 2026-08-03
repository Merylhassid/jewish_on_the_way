/*
 * Runs docs/smart-search-random-1000.json against the real app API.
 *
 * Usage:
 *   BENCH_SERVER=https://api.jewishontheway.com BENCH_TOKEN=... node docs/run-smart-search-random-1000.js
 *   BENCH_EMAIL=... BENCH_PASSWORD=... node docs/run-smart-search-random-1000.js
 *
 * Optional:
 *   BENCH_LIMIT=50 BENCH_START=0
 *
 * Outputs:
 *   docs/smart-search-random-1000-results.json
 *   docs/smart-search-random-1000-report.md
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = process.env.BENCH_SERVER || 'https://api.jewishontheway.com';
const EMAIL = process.env.BENCH_EMAIL;
const PASSWORD = process.env.BENCH_PASSWORD;
const TOKEN = process.env.BENCH_TOKEN;
const START = Number(process.env.BENCH_START || 0);
const LIMIT = process.env.BENCH_LIMIT ? Number(process.env.BENCH_LIMIT) : null;
const SEARCH_ONLY = process.env.BENCH_SEARCH_ONLY === 'true';
const REQUEST_DELAY_MS = Number(process.env.BENCH_DELAY_MS || 350);
const MAX_429_RETRIES = Number(process.env.BENCH_429_RETRIES || 5);
const GPS = { lat: 32.0853, lng: 34.7818 };

const STATIC_DESTINATIONS = [
  ['מיאמי', 'Miami'], ['לונדון', 'London'], ['פריז', 'Paris'], ['ירושלים', 'Jerusalem'],
  ['תל אביב', 'Tel Aviv'], ['עפולה', 'Afula'], ['פתח תקווה', 'Petah Tikva'],
  ['ראשון לציון', 'Rishon LeZion'], ['בית שמש', 'Beit Shemesh'], ['קריית גת', 'Kiryat Gat'],
  ['בני ברק', 'Bnei Brak'], ['נתניה', 'Netanya'], ['חיפה', 'Haifa'], ['אילת', 'Eilat'],
  ['טבריה', 'Tiberias'], ['רומא', 'Rome'], ['מילאנו', 'Milan'], ['מדריד', 'Madrid'],
  ['ברצלונה', 'Barcelona'], ['ליסבון', 'Lisbon'], ['אתונה', 'Athens'], ['ברלין', 'Berlin'],
  ['וינה', 'Vienna'], ['פראג', 'Prague'], ['בודפשט', 'Budapest'], ['דובאי', 'Dubai'],
  ['בנגקוק', 'Bangkok'], ['פוקט', 'Phuket'], ['קוסמוי', 'Koh Samui'], ['טוקיו', 'Tokyo'],
  ['ניו יורק', 'New York'], ['לוס אנג׳לס', 'Los Angeles'], ['טורונטו', 'Toronto'],
  ['מונטריאול', 'Montreal'], ['אמסטרדם', 'Amsterdam'], ['אנטוורפן', 'Antwerp'],
  ['ציריך', 'Zurich'], ['ז׳נבה', 'Geneva'], ['מרקש', 'Marrakech'], ['קזבלנקה', 'Casablanca'],
  ['לימסול', 'Limassol'], ['פאפוס', 'Paphos'], ['לרנקה', 'Larnaca'], ['פורטו', 'Porto'],
  ['קאן', 'Cannes'], ['ניס', 'Nice'], ['בואנוס איירס', 'Buenos Aires'],
].map(([nameHe, city], index) => ({ id: null, name: city, nameHe, city, country: null, staticId: index + 1 }));

const IN_JSON = path.join(ROOT, 'docs', 'smart-search-random-1000.json');
const OUT_RESULTS = path.join(ROOT, 'docs', 'smart-search-random-1000-results.json');
const OUT_REPORT = path.join(ROOT, 'docs', 'smart-search-random-1000-report.md');

const HEBREW_PREFIXES = ['', 'ב', 'ל', 'מ'];
let lastRequestAt = 0;
let authToken = TOKEN || null;

async function throttleRequest() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < REQUEST_DELAY_MS) {
    await sleep(REQUEST_DELAY_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

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
          resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', (err) => resolve({ status: 0, body: { error: err.message } }));
    req.setTimeout(20000, () => {
      req.destroy();
      resolve({ status: 0, body: { error: 'timeout' } });
    });
    if (data) req.write(data);
    req.end();
  });
}

async function requestWithRetry(method, url, body, token) {
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    await throttleRequest();
    const response = await request(method, url, body, token);
    if (response.status !== 429 || attempt === MAX_429_RETRIES) return response;
    await sleep(Math.min(30000, 3000 * (attempt + 1)));
  }
  return { status: 0, body: { error: 'retry loop failed' } };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function okStatus(status) {
  return status >= 200 && status < 300;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[׳'`"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenRegex(alias) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'i');
}

function destinationIdFromRoute(route) {
  const match = String(route || '').match(/\/(?:restaurants|synagogues|minyans|hosting)\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function routeCategory(route) {
  const value = String(route || '');
  if (value.startsWith('/restaurants/')) return 'restaurant';
  if (value.startsWith('/synagogues/')) return 'synagogue';
  if (value.startsWith('/minyans/')) return 'minyan';
  if (value.startsWith('/hosting/')) return 'hosting';
  if (value.startsWith('/destinations/')) return 'destination';
  return null;
}

function countItems(body) {
  if (Array.isArray(body)) return body.length;
  if (Array.isArray(body?.items)) return body.items.length;
  if (Array.isArray(body?.data)) return body.data.length;
  if (Array.isArray(body?.results)) return body.results.length;
  if (typeof body?.total === 'number') return body.total;
  return 0;
}

async function login() {
  if (TOKEN) {
    authToken = TOKEN;
    return TOKEN;
  }
  if (!EMAIL || !PASSWORD) return null;
  const res = await requestWithRetry('POST', `${SERVER}/auth/login`, { email: EMAIL, password: PASSWORD });
  if (res.status !== 200 || !res.body?.access_token) {
    throw new Error(`Login failed: status=${res.status}`);
  }
  authToken = res.body.access_token;
  return authToken;
}

async function authedRequest(method, url, body) {
  const first = await requestWithRetry(method, url, body, authToken);
  if (first.status !== 401 || TOKEN || !EMAIL || !PASSWORD) return first;
  await login();
  return requestWithRetry(method, url, body, authToken);
}

async function fetchDestinations(token) {
  const res = await requestWithRetry('GET', `${SERVER}/destinations`, null, token);
  if (!okStatus(res.status) || !Array.isArray(res.body)) return [];
  const flat = [];
  for (const item of res.body) {
    if (item?.id && !item.children) flat.push(item);
    for (const child of item.children || []) {
      flat.push({
        id: child.id,
        city: child.city || child.name,
        name: child.name,
        nameHe: child.nameHe || child.name_he || null,
        country: child.country || item.country,
      });
    }
  }
  return flat;
}

function inferExpectedDestination(query, destinations) {
  const sourceDestinations = destinations.length ? destinations : STATIC_DESTINATIONS;
  const normalizedQuery = normalize(query);
  const matches = [];
  for (const dest of sourceDestinations) {
    const aliases = [dest.city, dest.name, dest.nameHe].filter(Boolean);
    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias || normalizedAlias.length < 2) continue;
      const variants = /[א-ת]/.test(normalizedAlias)
        ? HEBREW_PREFIXES.map((prefix) => `${prefix}${normalizedAlias}`)
        : [normalizedAlias];
      if (variants.some((variant) => tokenRegex(variant).test(normalizedQuery))) {
        matches.push(dest);
        break;
      }
    }
  }
  matches.sort((a, b) => String(b.city || b.name).length - String(a.city || a.name).length);
  return matches[0] || null;
}

function expectedDestinationForCase(testCase, destinations) {
  if (testCase.expectedBehavior === 'safe_no_results_ok') return null;
  if (/near me|לידי|קרוב אלי|קרוב אליי|באזור שלי/.test(testCase.query)) {
    const explicit = inferExpectedDestination(testCase.query, destinations);
    return explicit || { id: null, city: 'GPS fallback' };
  }
  return inferExpectedDestination(testCase.query, destinations);
}

async function checkResults(testCase, searchBody, token) {
  if (SEARCH_ONLY) return { checked: false, pass: true, reason: 'search-only mode' };
  const category = testCase.expectedCategory;
  if (category === 'unknown' || category === 'destination') {
    return { checked: false, pass: true, reason: 'no result endpoint expected' };
  }

  const destId = searchBody.destinationId || destinationIdFromRoute(searchBody.route);
  if (!destId) return { checked: false, pass: false, count: 0, reason: 'no destination id' };

  if (category === 'restaurant') {
    const params = new URLSearchParams({
      destinationId: String(destId),
      q: testCase.query,
      lat: String(GPS.lat),
      lng: String(GPS.lng),
    });
    const res = await authedRequest('GET', `${SERVER}/restaurants/search?${params}`, null);
    const count = countItems(res.body);
    return {
      checked: true,
      endpoint: '/restaurants/search',
      status: res.status,
      count,
      pass: okStatus(res.status) && count > 0,
      matchTier: res.body?.matchTier ?? null,
      message: res.body?.message ?? null,
    };
  }

  if (category === 'synagogue') {
    const params = new URLSearchParams({
      destinationId: String(destId),
      lat: String(GPS.lat),
      lng: String(GPS.lng),
      expandNearby: 'true',
    });
    if (searchBody.denomination) params.set('denomination', searchBody.denomination);
    const res = await authedRequest('GET', `${SERVER}/synagogues?${params}`, null);
    const count = countItems(res.body);
    return {
      checked: true,
      endpoint: '/synagogues',
      status: res.status,
      count,
      pass: okStatus(res.status) && count > 0,
      denomination: searchBody.denomination ?? null,
    };
  }

  if (category === 'minyan') {
    const params = new URLSearchParams({
      destinationId: String(destId),
      lat: String(GPS.lat),
      lng: String(GPS.lng),
    });
    const res = await authedRequest('GET', `${SERVER}/minyans?${params}`, null);
    const count = countItems(res.body);
    return {
      checked: true,
      endpoint: '/minyans',
      status: res.status,
      count,
      pass: okStatus(res.status) && count > 0,
    };
  }

  if (category === 'hosting') {
    const params = new URLSearchParams({ destinationId: String(destId), limit: '20' });
    const res = await authedRequest('GET', `${SERVER}/hosting/offers/search?${params}`, null);
    const count = countItems(res.body);
    return {
      checked: true,
      endpoint: '/hosting/offers/search',
      status: res.status,
      count,
      pass: okStatus(res.status) && count > 0,
    };
  }

  return { checked: false, pass: false, count: 0, reason: 'unsupported category' };
}

function evaluateSearch(testCase, searchRes, expectedDestination) {
  const body = searchRes.body || {};
  const gotCategory = body.category || routeCategory(body.route);
  const gotDestId = body.destinationId || destinationIdFromRoute(body.route);
  const expectedCategory = testCase.expectedCategory;

  let categoryPass = gotCategory === expectedCategory;
  if (expectedCategory === 'unknown') {
    categoryPass = !gotCategory || gotCategory === 'unknown' || !body.route || !gotDestId;
  }
  if (expectedCategory === 'destination') {
    categoryPass = gotCategory === 'destination' || Boolean(gotDestId || body.route);
  }

  let destinationPass = true;
  if (expectedCategory !== 'unknown' && expectedDestination?.id) {
    destinationPass = gotDestId === expectedDestination.id;
  } else if (expectedCategory !== 'unknown' && expectedDestination && expectedDestination.city !== 'GPS fallback') {
    const gotCityNorm = normalize(body.detectedCity);
    const expectedAliases = [expectedDestination.city, expectedDestination.name, expectedDestination.nameHe]
      .filter(Boolean)
      .map(normalize);
    destinationPass = expectedAliases.includes(gotCityNorm);
  } else if (expectedCategory !== 'unknown' && expectedDestination?.city === 'GPS fallback') {
    destinationPass = Boolean(gotDestId || body.route);
  } else if (testCase.expectedBehavior === 'safe_no_results_ok') {
    destinationPass = !gotDestId || gotCategory === 'unknown';
  }

  return {
    gotCategory: gotCategory ?? null,
    gotDestinationId: gotDestId ?? null,
    gotCity: body.detectedCity ?? null,
    route: body.route ?? null,
    confidence: body.confidence ?? null,
    categoryPass,
    destinationPass,
    error: body.error ?? null,
  };
}

function summarize(results) {
  const totals = {
    total: results.length,
    overallPass: 0,
    categoryPass: 0,
    destinationPass: 0,
    resultPass: 0,
    searchErrors: 0,
    byCategory: {},
    byBehavior: {},
  };
  for (const result of results) {
    if (result.overallPass) totals.overallPass++;
    if (result.categoryPass) totals.categoryPass++;
    if (result.destinationPass) totals.destinationPass++;
    if (result.resultPass) totals.resultPass++;
    if (!okStatus(result.status)) totals.searchErrors++;
    for (const key of ['byCategory', 'byBehavior']) {
      const value = key === 'byCategory' ? result.expectedCategory : result.expectedBehavior;
      totals[key][value] ||= { total: 0, overallPass: 0, categoryPass: 0, destinationPass: 0, resultPass: 0 };
      totals[key][value].total++;
      if (result.overallPass) totals[key][value].overallPass++;
      if (result.categoryPass) totals[key][value].categoryPass++;
      if (result.destinationPass) totals[key][value].destinationPass++;
      if (result.resultPass) totals[key][value].resultPass++;
    }
  }
  return totals;
}

function pct(n, d) {
  return d ? `${((n / d) * 100).toFixed(1)}%` : '0.0%';
}

function row(result) {
  return [
    result.id,
    result.expectedCategory,
    result.query.replace(/\|/g, '/'),
    result.gotCategory || '-',
    result.expectedDestination || '-',
    result.gotCity || result.gotDestinationId || '-',
    result.route || '-',
    result.result?.status ?? result.status ?? '-',
    result.result?.count ?? 0,
    result.failureReason || '',
  ].join(' | ');
}

function renderTable(rows, max = 40) {
  if (!rows.length) return '| - | - | none | - | - | - | - | - | - | - |';
  return rows.slice(0, max).map((item) => `| ${row(item)} |`).join('\n');
}

function topFailureTerms(results) {
  const counts = new Map();
  for (const result of results.filter((item) => !item.overallPass)) {
    for (const note of result.notes || []) {
      counts.set(note, (counts.get(note) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
}

function renderReport(payload) {
  const s = payload.totals;
  const lines = [];
  lines.push('# Smart Search Random 1000 Report');
  lines.push('');
  lines.push(`Ran at: ${payload.ranAt}`);
  lines.push(`Server: ${payload.server}`);
  lines.push(`GPS used: ${payload.gps.lat}, ${payload.gps.lng}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Completed queries: ${payload.completed}/${payload.target}`);
  lines.push(`- Overall pass: ${s.overallPass}/${s.total} (${pct(s.overallPass, s.total)})`);
  lines.push(`- Category pass: ${s.categoryPass}/${s.total} (${pct(s.categoryPass, s.total)})`);
  lines.push(`- Destination pass: ${s.destinationPass}/${s.total} (${pct(s.destinationPass, s.total)})`);
  lines.push(`- Result pass: ${s.resultPass}/${s.total} (${pct(s.resultPass, s.total)})`);
  lines.push(`- Search HTTP errors: ${s.searchErrors}`);
  lines.push('');
  lines.push('## By Category');
  lines.push('');
  lines.push('| Category | Total | Overall | Category | Destination | Results |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const [category, item] of Object.entries(s.byCategory)) {
    lines.push(`| ${category} | ${item.total} | ${item.overallPass} (${pct(item.overallPass, item.total)}) | ${item.categoryPass} | ${item.destinationPass} | ${item.resultPass} |`);
  }
  lines.push('');
  lines.push('## By Expected Behavior');
  lines.push('');
  lines.push('| Behavior | Total | Overall | Category | Destination | Results |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const [behavior, item] of Object.entries(s.byBehavior)) {
    lines.push(`| ${behavior} | ${item.total} | ${item.overallPass} (${pct(item.overallPass, item.total)}) | ${item.categoryPass} | ${item.destinationPass} | ${item.resultPass} |`);
  }
  lines.push('');
  const categoryFailures = payload.results.filter((item) => !item.categoryPass);
  const destinationFailures = payload.results.filter((item) => item.categoryPass && !item.destinationPass);
  const resultFailures = payload.results.filter((item) => item.categoryPass && item.destinationPass && !item.resultPass);
  lines.push('## Category Failures');
  lines.push('');
  lines.push('| ID | Expected | Query | Got category | Expected dest | Got dest/city | Route | Status | Result count | Reason |');
  lines.push('|---|---|---|---|---|---|---|---:|---:|---|');
  lines.push(renderTable(categoryFailures));
  lines.push('');
  lines.push('## Destination Failures');
  lines.push('');
  lines.push('| ID | Expected | Query | Got category | Expected dest | Got dest/city | Route | Status | Result count | Reason |');
  lines.push('|---|---|---|---|---|---|---|---:|---:|---|');
  lines.push(renderTable(destinationFailures));
  lines.push('');
  lines.push('## Result Failures');
  lines.push('');
  lines.push('| ID | Expected | Query | Got category | Expected dest | Got dest/city | Route | Status | Result count | Reason |');
  lines.push('|---|---|---|---|---|---|---|---:|---:|---|');
  lines.push(renderTable(resultFailures, 60));
  lines.push('');
  lines.push('## Top Failed Notes');
  lines.push('');
  const terms = topFailureTerms(payload.results);
  if (!terms.length) {
    lines.push('- none');
  } else {
    for (const [term, count] of terms) lines.push(`- ${term}: ${count}`);
  }
  lines.push('');
  lines.push('## What To Fix First');
  lines.push('');
  if (categoryFailures.length) {
    lines.push('- Fix category/routing failures first. These are cases where the user is sent to the wrong screen.');
  }
  if (destinationFailures.length) {
    lines.push('- Fix destination failures next. These are cases where the intent is right but the user lands in the wrong place.');
  }
  if (resultFailures.length) {
    lines.push('- Then review result failures. Some are real bugs, but some may simply mean the DB has no data for that destination/category.');
  }
  if (!categoryFailures.length && !destinationFailures.length && !resultFailures.length) {
    lines.push('- No major failures in this run. Keep this file as a regression benchmark.');
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- `unknown` cases pass when the system safely avoids routing to a confident wrong result.');
  lines.push('- Result checks require auth for guarded endpoints. If many result failures have status 401, rerun with `BENCH_TOKEN` or `BENCH_EMAIL/BENCH_PASSWORD`.');
  lines.push('- A zero-result failure is not always a parser bug; it can be missing data or overly strict filtering.');
  lines.push('');
  return lines.join('\n');
}

function failureReason(result) {
  if (!okStatus(result.status)) return `search HTTP ${result.status}`;
  if (!result.categoryPass) return 'wrong category/unsafe route';
  if (!result.destinationPass) return 'wrong destination';
  if (!result.resultPass) {
    if (result.result?.status === 401) return 'result endpoint requires auth';
    if (result.result?.status && !okStatus(result.result.status)) return `result HTTP ${result.result.status}`;
    if (result.result?.count === 0) return 'zero results';
    return result.result?.reason || 'result check failed';
  }
  return '';
}

function writePayload(results, target) {
  const payload = {
    benchmark: 'smart-search-random-1000',
    ranAt: new Date().toISOString(),
    server: SERVER,
    gps: GPS,
    completed: results.length,
    target,
    totals: summarize(results),
    results,
  };
  fs.writeFileSync(OUT_RESULTS, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUT_REPORT, renderReport(payload), 'utf8');
  return payload;
}

async function main() {
  const cases = JSON.parse(fs.readFileSync(IN_JSON, 'utf8'));
  const token = await login();
  const destinations = await fetchDestinations(token);
  const existing = fs.existsSync(OUT_RESULTS)
    ? JSON.parse(fs.readFileSync(OUT_RESULTS, 'utf8')).results || []
    : [];
  const byId = new Map(existing.map((item) => [item.id, item]));
  const runCases = cases.slice(START, LIMIT == null ? undefined : START + LIMIT);

  for (let i = 0; i < runCases.length; i++) {
    const testCase = runCases[i];
    if (byId.has(testCase.id)) continue;
    const expectedDestination = expectedDestinationForCase(testCase, destinations);
    const searchRes = await requestWithRetry('POST', `${SERVER}/search`, {
      text: testCase.query,
      lat: GPS.lat,
      lng: GPS.lng,
    }, token);
    const searchEval = evaluateSearch(testCase, searchRes, expectedDestination);
    const result = await checkResults(testCase, searchRes.body || {}, token);
    const record = {
      ...testCase,
      expectedDestination: expectedDestination?.city || expectedDestination?.name || null,
      status: searchRes.status,
      rawSearch: searchRes.body,
      ...searchEval,
      result,
      resultPass: result.pass,
      overallPass: searchEval.categoryPass && searchEval.destinationPass && result.pass,
    };
    record.failureReason = failureReason(record);
    byId.set(testCase.id, record);

    if ((i + 1) % 25 === 0) {
      writePayload(cases.map((item) => byId.get(item.id)).filter(Boolean), cases.length);
      process.stdout.write(`${START + i + 1}/${cases.length} `);
    }
  }

  const payload = writePayload(cases.map((item) => byId.get(item.id)).filter(Boolean), cases.length);
  console.log('\nDone');
  console.log(JSON.stringify(payload.totals, null, 2));
  console.log(OUT_RESULTS);
  console.log(OUT_REPORT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
