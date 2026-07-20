/*
 * COMBINED DRY-RUN — Israel only. NO apply, NO DB writes, NO field updates, NO photos.
 * Pipeline per restaurant:
 *   1. Google Text Search (IDs-only, free) + Place Details (Enterprise, ~$0.02).
 *   2. scoreMatch -> if verified: source = "regular".
 *   3. else address-first classifier -> if promote: source = "address-first".
 *   4. else (has candidate, operational, has data) LLM judge (Haiku):
 *        yes + high confidence (+ strong address for chain/generic) -> source = "llm".
 *        no -> keep flagged/no_match ; uncertain/low-conf -> "uncertain".
 *   5. else keep flagged / no_match.
 * Saves every Google result to CSV so a future apply can reuse it without
 * re-charging Google.
 *
 * Usage:
 *   node scripts/dry-run-combined.js --random 300     # validation batch
 *   node scripts/dry-run-combined.js                  # full Israel (unsynced)
 */
'use strict';
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');
const { GooglePlaces } = require('./lib/google-places');
const { nameSimilarity, distanceMeters, scoreMatch } = require('./lib/match-helpers');
const { classifyAddressFirst, nameType } = require('./lib/address-match');
const { ISRAEL_JOIN, ISRAEL_WHERE } = require('./lib/israel-filter');

// ── budget guards ──
const DETAILS_UNIT_USD = 0.02;
const MAX_DETAILS_CALLS = 6000;
const MAX_GOOGLE_USD = 115;   // hard Google budget cap
const MAX_LLM_CALLS = 6000;
const MAX_LLM_USD = 5;        // hard Anthropic budget cap
const ERROR_RATE_LIMIT = 0.15; // stop the run if >15% of rows error (after a warmup)
const ERROR_WARMUP = 50;       // don't evaluate error rate before this many rows
// Haiku 4.5 pricing per token
const LLM_IN_USD = 1 / 1e6, LLM_OUT_USD = 5 / 1e6;
// Codex hardening thresholds:
const REGULAR_NAME_FLOOR = 0.55; // below this, a short-distance match goes to LLM
const LLM_CONF_MIN = 0.90;       // LLM "yes" only accepted at >= this confidence
const MODEL = process.env.SMART_SEARCH_LLM_MODEL || 'claude-haiku-4-5-20251001';

const arg = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
const hasFlag = (f) => process.argv.includes(f);

function buildClient() {
  return new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false, keepAlive: true,
  });
}
const csvEsc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

// RFC4180 parse of a prior CSV to resume from. Returns the good (non-error) data
// lines to carry over, the set of ids already done, and seed tally counts so the
// summary reflects the whole file, not just the newly processed rows.
function loadResume(file) {
  const s = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = []; let f = [], c = '', q = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { f.push(c); c = ''; }
    else if (ch === '\n') { f.push(c); rows.push(f); f = []; c = ''; }
    else if (ch !== '\r') c += ch; }
  if (c || f.length) { f.push(c); rows.push(f); }
  const head = rows[0];
  const iId = head.indexOf('id'), iFinal = head.indexOf('final'), iSource = head.indexOf('source');
  const doneIds = new Set(); const goodLines = [];
  const seed = { verified_regular: 0, verified_addressfirst: 0, verified_llm: 0, flagged: 0, no_match: 0, uncertain: 0, error: 0 };
  for (let k = 1; k < rows.length; k++) {
    const r = rows[k]; if (r.length < head.length) continue;
    const final = r[iFinal], source = r[iSource];
    if (final === 'error' || !final) continue; // re-process errors
    doneIds.add(String(r[iId]));
    goodLines.push(r.map(csvEsc).join(','));
    if (final === 'verified') seed['verified_' + (source === 'address-first' ? 'addressfirst' : source === 'llm' ? 'llm' : 'regular')]++;
    else if (seed[final] != null) seed[final]++;
  }
  return { doneIds, goodLines, seed };
}

const LLM_SYSTEM = `You decide whether two restaurant listings are the SAME physical business.
- Listing A is from our Hebrew database; listing B is a Google Places candidate.
- Names may differ only by Hebrew<->English TRANSLATION or TRANSLITERATION (e.g. "ווק טו ווק"="Wok To Walk", "מרכז אסיה"="Central Asia"). Treat these as the SAME name.
- Our coordinates/house-numbers are often wrong, so a large distance or small house-number difference does NOT rule out a match if street+city and name align.
- CHAIN/brand names: answer "yes" only if street AND house number clearly match; else "uncertain".
- Generic names (just "pizza"/"falafel") need a clear address match; else "uncertain".
- If Google's name is just a street address (no business name), answer "no".
- If listing B is clearly NOT a food business (a shopping mall, clinic, gym, hotel, shop, office), answer "no".
- CITY-ONLY: if A's address is only a city/region with no street, and A has a strong UNIQUE name that clearly matches B (translation/transliteration) and B is a food business in that same city, answer "yes". But if A's name is generic or a multi-branch chain, answer "uncertain".
Respond with STRICT JSON only: {"same_place":"yes|no|uncertain","confidence":0.0-1.0,"reason":"short"}`;

// Google Place types → is this a food business? Used to reject malls/clinics/gyms
// that share coordinates with our restaurant (Codex hardening, rule 4).
const FOOD_RE = /restaurant|food|cafe|coffee|bakery|\bbar\b|meal_|deli|bistro|pub|ice_cream|dessert|juice|confection|winery|brewery|patisserie|steak|pizza|sushi|shawarma|falafel|hummus|catering|diner|eatery/;
const NONFOOD_RE = /shopping_mall|clinic|doctor|hospital|dental|\bgym\b|fitness|lodging|hotel|pharmacy|\bschool\b|university|bank|gas_station|parking|car_|store$|real_estate|government|beauty_salon|spa\b/;
function foodSignal(gName, types, primaryType) {
  const all = [primaryType, ...(types || [])].filter(Boolean).map((t) => String(t).toLowerCase());
  if (all.some((t) => FOOD_RE.test(t))) return 'food';
  if (all.some((t) => NONFOOD_RE.test(t))) return 'nonfood';
  if (/קניון|\bmall\b/i.test(gName || '')) return 'nonfood';
  return all.length ? 'other' : 'unknown';
}

async function llmJudge(client, r, cost) {
  const user = JSON.stringify({
    A_our_name: r.old_name, A_our_address: r.old_address,
    B_google_name: r.google_name, B_google_address: r.google_address,
    distance_meters: r.distance_m, name_type: nameType(r.old_name),
  });
  const resp = await client.messages.create({
    model: MODEL, max_tokens: 200, system: LLM_SYSTEM,
    messages: [{ role: 'user', content: user }],
  });
  cost.llmCalls++;
  cost.llmUsd += (resp.usage?.input_tokens || 0) * LLM_IN_USD + (resp.usage?.output_tokens || 0) * LLM_OUT_USD;
  const text = resp.content.map((c) => c.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { same_place: 'uncertain', confidence: 0, reason: 'unparseable' };
  try { return JSON.parse(m[0]); } catch { return { same_place: 'uncertain', confidence: 0, reason: 'bad-json' }; }
}

async function selectRows(c) {
  const coordCols = `r.id, r.name, r.address, ST_Y(r.location::geometry) lat, ST_X(r.location::geometry) lng`;
  const base = `from restaurants r ${ISRAEL_JOIN} where ${ISRAEL_WHERE}`;
  const limit = arg('--limit'), randomN = arg('--random');
  if (randomN) {
    const q = await c.query(`select ${coordCols} ${base} order by random() limit $1`, [parseInt(randomN, 10)]);
    return q.rows;
  }
  const synced = hasFlag('--force') ? '' : 'and r.google_synced_at is null';
  const q = await c.query(`select ${coordCols} ${base} ${synced} order by r.id ${limit ? 'limit ' + parseInt(limit, 10) : ''}`);
  return q.rows;
}

(async () => {
  const gp = new GooglePlaces(process.env.GOOGLE_PLACES_API_KEY, { rateMs: 120 });
  const llm = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const c = buildClient();
  c.on('error', (e) => console.error('[pg]', e.message));
  await c.connect();

  const syncedBefore = (await c.query(`select count(*) n from restaurants r ${ISRAEL_JOIN} where ${ISRAEL_WHERE} and r.google_synced_at is not null`)).rows[0].n;
  let rows = await selectRows(c);
  await c.end(); // no DB needed during the loop (dry-run)

  // --resume <file>: carry over already-cached good rows, skip their ids, and
  // re-process only errored/never-done ids (no re-paying Google for good rows).
  const resumeFile = arg('--resume');
  let resume = null;
  if (resumeFile) {
    resume = loadResume(resumeFile);
    const before = rows.length;
    rows = rows.filter((r) => !resume.doneIds.has(String(r.id)));
    console.log(`[resume] carried ${resume.doneIds.size} good rows from ${path.basename(resumeFile)}; re-processing ${rows.length} of ${before}`);
  }

  console.log(`\n=== COMBINED DRY-RUN — ISRAEL ONLY (no writes) ===`);
  console.log(`rows: ${rows.length} | synced_before: ${syncedBefore}\n`);

  const outDir = path.join(__dirname, '..', 'audit-output');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();
  const csvFile = path.join(outDir, `combined-dryrun-${stamp}.csv`);
  const COLS = ['id', 'final', 'source', 'old_name', 'old_address', 'old_lat', 'old_lng',
    'google_place_id', 'google_name', 'google_address', 'google_lat', 'google_lng',
    'name_sim', 'distance_m', 'business_status', 'food_signal', 'google_primary_type', 'google_types',
    'google_phone', 'google_rating', 'rating_count', 'opening_hours',
    'has_photo', 'photo_name', 'photo_attribution',
    'llm_verdict', 'llm_conf', 'llm_reason', 'google_maps_uri'];
  const HEAD = COLS.join(',');
  fs.writeFileSync(csvFile, '﻿' + HEAD + '\n', 'utf8');
  if (resume && resume.goodLines.length) {
    fs.appendFileSync(csvFile, resume.goodLines.join('\n') + '\n', 'utf8');
  }

  const tally = { verified_regular: 0, verified_addressfirst: 0, verified_llm: 0, flagged: 0, no_match: 0, uncertain: 0, error: 0 };
  if (resume) Object.assign(tally, resume.seed);
  const carried = resume ? resume.doneIds.size : 0;
  const cost = { llmCalls: 0, llmUsd: 0 };
  let processed = 0, googleUsd = 0;

  for (const r of rows) {
    if (gp.calls.details >= MAX_DETAILS_CALLS || googleUsd >= MAX_GOOGLE_USD) { console.log(`[budget] Google cap reached ($${googleUsd.toFixed(2)})`); break; }
    if (processed >= ERROR_WARMUP && tally.error / processed > ERROR_RATE_LIMIT) {
      console.log(`[abort] error rate ${(tally.error / processed * 100).toFixed(1)}% > ${ERROR_RATE_LIMIT * 100}% after ${processed} rows`); break;
    }
    processed++;
    let rec = {
      id: r.id, final: '', source: '',
      old_name: r.name, old_address: r.address, old_lat: r.lat ?? '', old_lng: r.lng ?? '',
      google_place_id: '', google_name: '', google_address: '', google_lat: '', google_lng: '',
      name_sim: '', distance_m: '', business_status: '', food_signal: '',
      google_primary_type: '', google_types: '',
      google_phone: '', google_rating: '', rating_count: '', opening_hours: '',
      has_photo: '', photo_name: '', photo_attribution: '',
      llm_verdict: '', llm_conf: '', llm_reason: '', google_maps_uri: '',
    };
    try {
      const placeId = await gp.findPlaceId(`${r.name} ${r.address || ''}`.trim(), { lat: r.lat, lng: r.lng, radius: 500 });
      if (!placeId) { rec.final = 'no_match'; rec.source = 'no-candidate'; tally.no_match++; }
      else {
        const d = await gp.getDetails(placeId); googleUsd += DETAILS_UNIT_USD;
        const gName = d.displayName?.text || '';
        const distM = distanceMeters(r.lat, r.lng, d.location?.latitude, d.location?.longitude);
        const sim = nameSimilarity(r.name, gName);
        const sc = scoreMatch({ nameSim: sim, distM, businessStatus: d.businessStatus });
        const food = foodSignal(gName, d.types, d.primaryType);
        const photo0 = d.photos && d.photos.length ? d.photos[0] : null;
        const attribution = photo0 && photo0.authorAttributions && photo0.authorAttributions.length
          ? photo0.authorAttributions.map((a) => a.displayName).filter(Boolean).join('; ') : '';
        const hours = d.regularOpeningHours && d.regularOpeningHours.weekdayDescriptions
          ? d.regularOpeningHours.weekdayDescriptions.join(' | ') : '';
        Object.assign(rec, {
          google_place_id: placeId,
          google_name: gName, google_address: d.formattedAddress || '',
          google_lat: d.location?.latitude ?? '', google_lng: d.location?.longitude ?? '',
          name_sim: sim.toFixed(3), distance_m: distM == null ? '' : Math.round(distM),
          business_status: d.businessStatus || '', food_signal: food,
          google_primary_type: d.primaryType || '', google_types: (d.types || []).join(';'),
          google_phone: d.nationalPhoneNumber || d.internationalPhoneNumber || '',
          google_rating: d.rating ?? '', rating_count: d.userRatingCount ?? '', opening_hours: hours,
          has_photo: photo0 ? 'yes' : 'no', photo_name: photo0 ? photo0.name : '', photo_attribution: attribution,
          google_maps_uri: d.googleMapsUri || '',
        });
        const rowForClass = { old_name: r.name, old_address: r.address, google_name: gName, google_address: rec.google_address, name_sim: rec.name_sim, business_status: rec.business_status, google_rating: rec.google_rating, google_phone: rec.google_phone, has_photo: rec.has_photo, distance_m: rec.distance_m };

        // A rejected row must never inherit a 'verified' status from scoreMatch
        // (name+distance can score 'verified' yet be rejected on other grounds).
        // Downgrade to 'flagged' when that happens. (Codex count-bug fix.)
        const rejectStatus = sc.status === 'verified' ? 'flagged' : sc.status;

        // Codex hardening: a non-food Google result (mall/clinic/gym) can never be
        // verified by any path — route straight to flagged/no_match, no LLM spend.
        if (food === 'nonfood') { rec.final = rejectStatus; rec.source = 'nonfood-reject'; tally[rejectStatus]++; }
        // Regular verify requires a real name signal (>=0.55); a short distance with
        // a weak name must go to the LLM judge instead of auto-verifying.
        else if (sc.status === 'verified' && sim >= REGULAR_NAME_FLOOR) { rec.final = 'verified'; rec.source = 'regular'; tally.verified_regular++; }
        else {
          const af = classifyAddressFirst(rowForClass);
          if (af.promote) { rec.final = 'verified'; rec.source = 'address-first'; tally.verified_addressfirst++; }
          else {
            const hasData = !!(rec.google_rating || rec.google_phone || rec.has_photo === 'yes');
            const operational = rec.business_status === 'OPERATIONAL';
            if (gName && hasData && operational && cost.llmCalls < MAX_LLM_CALLS && cost.llmUsd < MAX_LLM_USD) {
              const v = await llmJudge(llm, rec, cost);
              const nt = nameType(r.name);
              const conf = Number(v.confidence) || 0;
              rec.llm_verdict = v.same_place; rec.llm_conf = conf; rec.llm_reason = (v.reason || '').replace(/[\r\n]+/g, ' ');
              let verdict = String(v.same_place || 'uncertain').toLowerCase();
              const strongAddr = af.streetMatch && af.houseExact && af.cityMatch;
              // LLM yes requires high confidence (>=0.9). Unique names or a strong
              // address may pass; chains/generic effectively need the strong address.
              if (verdict === 'yes' && conf >= LLM_CONF_MIN && ((nt === 'unique') || strongAddr)) {
                rec.final = 'verified'; rec.source = 'llm'; tally.verified_llm++;
              } else if (verdict === 'no') { rec.final = rejectStatus; rec.source = 'llm-no'; tally[rejectStatus]++; }
              else { rec.final = 'uncertain'; rec.source = 'llm-uncertain'; tally.uncertain++; }
            } else { rec.final = rejectStatus; rec.source = 'rule'; tally[rejectStatus]++; }
          }
        }
      }
    } catch (e) { rec.final = 'error'; rec.source = e.message.slice(0, 60); tally.error++; }
    fs.appendFileSync(csvFile, COLS.map((k) => csvEsc(rec[k])).join(',') + '\n', 'utf8');
    if (processed % 25 === 0) console.log(`  ...${processed}/${rows.length}  vR=${tally.verified_regular} vA=${tally.verified_addressfirst} vL=${tally.verified_llm} flag=${tally.flagged} nm=${tally.no_match} unc=${tally.uncertain}  G$${googleUsd.toFixed(2)} A$${cost.llmUsd.toFixed(3)}`);
  }

  // verify nothing changed in DB — never let a DB blip hide the summary/CSV path.
  let syncedAfter = 'n/a';
  try {
    const c2 = buildClient(); await c2.connect();
    syncedAfter = (await c2.query(`select count(*) n from restaurants r ${ISRAEL_JOIN} where ${ISRAEL_WHERE} and r.google_synced_at is not null`)).rows[0].n;
    await c2.end();
  } catch (e) { console.error('[warn] post-run SYNCED check failed (network?):', e.message); }

  const totalVerified = tally.verified_regular + tally.verified_addressfirst + tally.verified_llm;
  const accounted = processed + carried; // new rows + carried-over from --resume
  console.log('\n=== SUMMARY (ISRAEL, DRY-RUN, NO WRITES) ===');
  console.log(`processed this run: ${processed}${carried ? ` | carried from resume: ${carried} | total: ${accounted}` : ''}`);
  console.log(`verified TOTAL: ${totalVerified} (${(totalVerified / accounted * 100).toFixed(1)}%)`);
  console.log(`   • regular (name+dist):   ${tally.verified_regular}`);
  console.log(`   • address-first:         ${tally.verified_addressfirst}`);
  console.log(`   • LLM-rescued:           ${tally.verified_llm}`);
  console.log(`flagged: ${tally.flagged} | no_match: ${tally.no_match} | uncertain: ${tally.uncertain} | error: ${tally.error}`);
  const tallySum = Object.values(tally).reduce((a, b) => a + b, 0);
  console.log(`consistency: tally sum ${tallySum} vs accounted ${accounted}  ${tallySum === accounted ? '✓' : '✗ MISMATCH'}`);
  console.log(`\nGoogle cost this run: ~$${googleUsd.toFixed(2)} (${gp.calls.details} details) | Anthropic: $${cost.llmUsd.toFixed(3)} (${cost.llmCalls} calls)`);
  console.log(`SYNCED_BEFORE=${syncedBefore}  SYNCED_AFTER=${syncedAfter}  ${String(syncedBefore) === String(syncedAfter) ? '✓ unchanged (no writes)' : (syncedAfter === 'n/a' ? '(check skipped)' : '✗ CHANGED!')}`);
  console.log(`CSV: ${path.relative(path.join(__dirname, '..'), csvFile)}`);
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
