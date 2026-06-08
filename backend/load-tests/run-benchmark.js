/**
 * Restaurant search benchmark runner
 * Usage: node run-benchmark.js <path-to-benchmark.json>
 */
const fs = require('fs');
const https = require('https');
const http = require('http');

const SERVER = 'http://49.12.189.108:3000';
const EMAIL = 'daniyehudai@gmail.com';
const PASSWORD = 'daniel2109';

async function request(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    };
    const req = lib.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getToken() {
  const r = await request('POST', `${SERVER}/auth/login`, { email: EMAIL, password: PASSWORD });
  return r.body.access_token;
}

async function runBenchmark(benchmarkPath) {
  console.log('Getting token...');
  const token = await getToken();
  console.log('Token OK\n');

  const raw = fs.readFileSync(benchmarkPath, 'utf8');
  const benchmark = JSON.parse(raw);
  const queries = benchmark.queries;

  console.log(`Running ${queries.length} queries...\n`);

  const failed = [];
  const categoryWrong = [];
  const destWrong = [];
  const noDestFound = [];

  let passed = 0;
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    try {
      const r = await request('POST', `${SERVER}/search`, { text: q.query }, {
        Authorization: `Bearer ${token}`,
      });
      const result = r.body;

      const catOk = result.category === q.expectedCategory;
      const destOk = q.expectedDestinationId == null
        ? true  // GPS fallback — only category matters
        : result.destinationId === q.expectedDestinationId;

      if (catOk && destOk) {
        passed++;
      } else {
        const failure = {
          id: q.id,
          query: q.query,
          lang: q.language,
          food: q.food,
          expectedCategory: q.expectedCategory,
          gotCategory: result.category,
          expectedDestId: q.expectedDestinationId,
          gotDestId: result.destinationId,
          expectedDest: q.expectedDestination,
          gotCity: result.detectedCity,
          error: result.error,
        };
        failed.push(failure);
        if (!catOk) categoryWrong.push(failure);
        else if (q.expectedDestinationId && !result.destinationId) noDestFound.push(failure);
        else destWrong.push(failure);
      }
    } catch (e) {
      failed.push({ id: q.id, query: q.query, error: e.message });
    }
    if (i % 100 === 0) process.stdout.write(`${i}/${queries.length}... `);
    await new Promise(r => setTimeout(r, 80));
  }

  console.log('\n\n=== RESULTS ===');
  console.log(`PASSED: ${passed}/${queries.length} (${Math.round(passed/queries.length*100)}%)`);
  console.log(`FAILED: ${failed.length}`);
  console.log(`  Category wrong: ${categoryWrong.length}`);
  console.log(`  Dest not found: ${noDestFound.length}`);
  console.log(`  Wrong dest:     ${destWrong.length}`);

  // Group failures by type
  if (categoryWrong.length > 0) {
    console.log('\n--- CATEGORY ERRORS (top 15) ---');
    categoryWrong.slice(0, 15).forEach(f => {
      console.log(`  [${f.lang}] "${f.query}" → got:${f.gotCategory} expected:${f.expectedCategory}`);
    });
  }

  if (noDestFound.length > 0) {
    console.log('\n--- DESTINATION NOT FOUND (top 15) ---');
    noDestFound.slice(0, 15).forEach(f => {
      console.log(`  [${f.lang}] "${f.query}" → expected:${f.expectedDest}(${f.expectedDestId}) gotCity:${f.gotCity}`);
    });
  }

  if (destWrong.length > 0) {
    console.log('\n--- WRONG DESTINATION (top 15) ---');
    destWrong.slice(0, 15).forEach(f => {
      console.log(`  [${f.lang}] "${f.query}" → expected:${f.expectedDest}(${f.expectedDestId}) got:${f.gotCity}(${f.gotDestId})`);
    });
  }

  // Group by destination to find which cities fail most
  const destFailCount = {};
  failed.filter(f => f.expectedDest).forEach(f => {
    destFailCount[f.expectedDest] = (destFailCount[f.expectedDest] || 0) + 1;
  });
  const topDestFails = Object.entries(destFailCount).sort((a,b) => b[1]-a[1]).slice(0, 10);
  if (topDestFails.length > 0) {
    console.log('\n--- TOP FAILING DESTINATIONS ---');
    topDestFails.forEach(([dest, count]) => console.log(`  ${dest}: ${count} failures`));
  }

  // Group by food term
  const foodFailCount = {};
  failed.filter(f => f.food).forEach(f => {
    foodFailCount[f.food] = (foodFailCount[f.food] || 0) + 1;
  });
  const topFoodFails = Object.entries(foodFailCount).sort((a,b) => b[1]-a[1]).slice(0, 10);
  if (topFoodFails.length > 0) {
    console.log('\n--- TOP FAILING FOOD TERMS ---');
    topFoodFails.forEach(([food, count]) => console.log(`  ${food}: ${count} failures`));
  }

  // Group by language
  const langFail = {};
  failed.forEach(f => { langFail[f.lang] = (langFail[f.lang] || 0) + 1; });
  console.log('\n--- FAILURES BY LANGUAGE ---');
  Object.entries(langFail).forEach(([lang, count]) => {
    const total = queries.filter(q => q.language === lang).length;
    console.log(`  ${lang}: ${count}/${total} failed`);
  });
}

const path = process.argv[2];
if (!path) { console.error('Usage: node run-benchmark.js <benchmark.json>'); process.exit(1); }
runBenchmark(path).catch(console.error);
