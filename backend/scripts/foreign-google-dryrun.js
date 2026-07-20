'use strict';

/*
 * Foreign restaurants Google enrichment dry-run.
 *
 * - No DB writes.
 * - No photo downloads.
 * - Text Search is IDs-only.
 * - Details are cached to disk so repeated dry-runs do not re-buy data.
 * - Collects google_photo_name on the selected candidate so a later photo step
 *   can download/upload images without another Place Details call.
 *
 * Usage:
 *   node scripts/foreign-google-dryrun.js --country-code FR --limit 100
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');
const { GooglePlaces } = require('./lib/google-places');
const { nameSimilarity, normalizeName, distanceMeters } = require('./lib/match-helpers');
const { classifyAddressFirst, nameType } = require('./lib/address-match');

const OUT_DIR = path.join(__dirname, '..', 'audit-output');
const CACHE_FILE = path.join(OUT_DIR, 'foreign-google-details-cache.json');
const MODEL = process.env.SMART_SEARCH_LLM_MODEL || 'claude-haiku-4-5-20251001';

const MIN_MASK = 'id,displayName,formattedAddress,location,businessStatus,types,primaryType,googleMapsUri';
const MAX_SEARCH_CALLS = Number(process.env.FOREIGN_DRYRUN_MAX_SEARCH || 600);
const MAX_DETAILS_CALLS = Number(process.env.FOREIGN_DRYRUN_MAX_DETAILS || 500);
const MAX_LLM_USD = Number(process.env.FOREIGN_DRYRUN_MAX_LLM_USD || 0.75);
const LLM_IN = 1 / 1e6;
const LLM_OUT = 5 / 1e6;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
function hasFlag(name) {
  return process.argv.includes(name);
}
function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function mapsSearch(row) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${row.old_name} ${row.old_address || ''}`)}`;
}
function googlePin(placeId) {
  return placeId ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}` : '';
}
function parseAddressParts(address) {
  const parts = String(address || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    first: parts[0] || '',
    city: parts.length >= 2 ? parts[parts.length - 2] : '',
    country: parts.length ? parts[parts.length - 1] : '',
  };
}
function cleanedName(name) {
  return normalizeName(name)
    .replace(/\b(restaurant|pizza|pizzeria|cafe|coffee|bar|grill|bakery|deli|kosher|meat|sushi|burger)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function buildQueries(row) {
  const parts = parseAddressParts(row.old_address);
  const city = row.city || parts.city || row.destination_name || '';
  const country = row.country || parts.country || '';
  const clean = cleanedName(row.old_name);
  return [
    `${row.old_name} ${city} ${country}`,
    `${row.old_name} ${row.old_address || ''} ${country}`,
    clean && clean !== normalizeName(row.old_name) ? `${clean} ${city} ${country}` : null,
  ].filter(Boolean).map((q) => q.replace(/\s+/g, ' ').trim());
}
function foodSignal(types, name) {
  const all = `${(types || []).join(';')} ${name || ''}`.toLowerCase();
  if (/restaurant|food|cafe|coffee|bakery|\bbar\b|meal_|deli|bistro|pub|ice_cream|dessert|juice|pizza|sushi|burger|grill|kosher/.test(all)) return 'food';
  if (/shopping_mall|clinic|doctor|hospital|gym|fitness|lodging|hotel|pharmacy|school|university|bank|gas_station|parking|store|real_estate/.test(all)) return 'nonfood';
  return 'unknown';
}
function flattenDetails(raw) {
  const photo0 = raw.photos?.[0] || null;
  return {
    place_id: raw.id || '',
    google_name: raw.displayName?.text || '',
    google_address: raw.formattedAddress || '',
    google_lat: raw.location?.latitude ?? '',
    google_lng: raw.location?.longitude ?? '',
    business_status: raw.businessStatus || '',
    google_primary_type: raw.primaryType || '',
    google_types: (raw.types || []).join(';'),
    google_maps_uri: raw.googleMapsUri || '',
    google_phone: raw.nationalPhoneNumber || raw.internationalPhoneNumber || '',
    google_rating: raw.rating ?? '',
    google_rating_count: raw.userRatingCount ?? '',
    google_opening_hours: raw.regularOpeningHours?.weekdayDescriptions?.join(' | ') || '',
    google_photo_name: photo0?.name || '',
    google_photo_attribution: (photo0?.authorAttributions || []).map((a) => a.displayName).filter(Boolean).join('; '),
    has_photo: photo0 ? 'yes' : 'no',
  };
}
function judgeDeterministic(row, cand) {
  const sim = nameSimilarity(row.old_name, cand.google_name);
  const distM = distanceMeters(Number(row.old_lat), Number(row.old_lng), Number(cand.google_lat), Number(cand.google_lng));
  const food = foodSignal(String(cand.google_types || '').split(';'), cand.google_name);
  const af = classifyAddressFirst({
    old_name: row.old_name,
    old_address: row.old_address,
    google_name: cand.google_name,
    google_address: cand.google_address,
    name_sim: sim,
    business_status: cand.business_status || 'OPERATIONAL',
    google_rating: cand.google_rating || 'x',
    google_phone: cand.google_phone || '',
    has_photo: cand.has_photo || '',
    distance_m: distM == null ? '' : String(Math.round(distM)),
  });
  const nt = nameType(row.old_name);
  const normA = normalizeName(row.old_name);
  const normB = normalizeName(cand.google_name);
  const contains = normA.length >= 4 && (normB.includes(normA) || normA.includes(normB));
  let verdict = 'maybe';
  let reason = '';
  let score = sim * 10;

  if (food === 'nonfood') {
    return { verdict: 'no', reason: 'Google candidate is not a food business', score: -10, sim, distM, af, food };
  }
  if (cand.business_status && cand.business_status !== 'OPERATIONAL' && sim < 0.75) {
    return { verdict: 'no', reason: `business_status=${cand.business_status}`, score: -5, sim, distM, af, food };
  }

  if (nt === 'chain') {
    if ((sim >= 0.75 || contains) && af.cityMatch && af.streetMatch && af.houseExact) {
      verdict = 'yes'; reason = 'chain name + exact branch address'; score += 25;
    } else if (sim >= 0.75 || contains) {
      verdict = 'maybe'; reason = 'chain name matches but branch/address is not exact'; score += 5;
    } else {
      verdict = 'no'; reason = 'chain/brand mismatch';
    }
  } else if (nt === 'generic') {
    if (af.addressExact) {
      verdict = 'yes'; reason = 'generic name but exact address'; score += 22;
    } else {
      verdict = 'maybe'; reason = 'generic name needs stronger address';
    }
  } else if ((sim >= 0.78 || contains) && af.cityMatch) {
    verdict = 'yes'; reason = 'unique name matches + same city'; score += 20;
  } else if ((sim >= 0.55 || contains) && af.cityMatch && (af.streetMatch || af.addressExact)) {
    verdict = 'yes'; reason = 'name + city + street match'; score += 18;
  } else if (sim >= 0.4 || af.addressExact || (af.cityMatch && af.streetMatch)) {
    verdict = 'maybe'; reason = 'partial signals';
    score += af.addressExact ? 10 : af.streetMatch ? 6 : 0;
  } else {
    verdict = 'no'; reason = 'weak name/address match';
  }

  if (af.addressExact) score += 12;
  else if (af.streetMatch && af.cityMatch) score += 8;
  else if (af.cityMatch) score += 3;
  if (cand.google_rating) score += 1;
  if (cand.google_photo_name) score += 1;
  return { verdict, reason, score, sim, distM, af, food };
}
async function llmJudge(llm, row, cand, deterministic) {
  const resp = await llm.messages.create({
    model: MODEL,
    max_tokens: 220,
    system: [
      'Decide whether A and B are the SAME physical kosher restaurant/place.',
      'A is our database, B is a Google Places candidate.',
      'Hebrew/English translation/transliteration or spelling variants are the same name.',
      'Our address/coordinates may be wrong; Google may be more reliable.',
      'Unique name + same city is usually enough.',
      'Chains need the same branch/street/house; different branch means no.',
      'Generic names need a strong address match.',
      'If B is a non-food business or totally different brand, answer no.',
      'Return strict JSON: {"same_place":"yes|no|uncertain","confidence":0-1,"reason":"short Hebrew"}',
    ].join('\n'),
    messages: [{
      role: 'user',
      content: JSON.stringify({
        A: { name: row.old_name, address: row.old_address, city: row.city, country: row.country },
        B: { name: cand.google_name, address: cand.google_address, types: cand.google_types, status: cand.business_status },
        deterministic,
      }),
    }],
  });
  const text = resp.content.map((c) => c.text || '').join('');
  const match = text.match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) : { same_place: 'uncertain', confidence: 0, reason: 'unparseable' };
  return {
    parsed,
    usd: (resp.usage?.input_tokens || 0) * LLM_IN + (resp.usage?.output_tokens || 0) * LLM_OUT,
  };
}
function loadCache() {
  try {
    const arr = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    return new Map(arr.map((item) => [item.place_id, item]));
  } catch {
    return new Map();
  }
}
function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify([...cache.values()], null, 2), 'utf8');
}
async function selectRows({ countryCode, destinationId, limit }) {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  // Scope by a single destination id (e.g. one US city) OR by country_code.
  const filter = destinationId ? `r."destinationId" = $1` : `d.country_code = $1`;
  const params = [destinationId ? Number(destinationId) : countryCode];
  const lim = limit ? `limit $2` : '';
  if (limit) params.push(Number(limit));
  const { rows } = await client.query(`
    select
      r.id,
      r.name as old_name,
      r.address as old_address,
      ST_Y(r.location::geometry) as old_lat,
      ST_X(r.location::geometry) as old_lng,
      d.name as destination_name,
      d.city,
      d.country,
      d.country_code
    from restaurants r
    join destinations d on d.id = r."destinationId"
    where ${filter}
      and coalesce(r.verification_status, 'pending') <> 'verified'
      and r.google_place_id is null
    order by r.id
    ${lim}
  `, params);
  await client.end();
  return rows;
}

(async () => {
  const countryCode = String(arg('--country-code', 'FR')).toUpperCase();
  const destinationId = arg('--destination-id', null);
  const limit = arg('--limit', null);
  const maxCandidates = Number(arg('--max-candidates', '6'));
  const noLlm = hasFlag('--no-llm');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const rows = await selectRows({ countryCode, destinationId, limit });
  const gp = new GooglePlaces(process.env.GOOGLE_PLACES_API_KEY, { rateMs: 140 });
  const llm = noLlm || !process.env.ANTHROPIC_API_KEY ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let llmUsd = 0;
  let llmCalls = 0;
  let llmDead = false;
  let cacheHits = 0;
  let newDetails = 0;
  const cache = loadCache();
  const results = [];
  const tally = { verified: 0, maybe: 0, no_match: 0, error: 0 };

  console.log(`\n=== FOREIGN GOOGLE DRY-RUN ${countryCode} ===`);
  console.log(`rows=${rows.length} | no DB writes | maxSearch=${MAX_SEARCH_CALLS} maxDetails=${MAX_DETAILS_CALLS}\n`);

  for (const row of rows) {
    if (gp.calls.textSearch >= MAX_SEARCH_CALLS || gp.calls.details >= MAX_DETAILS_CALLS) {
      console.log('[budget] Google guard reached');
      break;
    }
    const queries = buildQueries(row);
    const found = new Map();
    try {
      for (const query of queries) {
        const ids = await gp.searchIds(query, { max: 5 });
        ids.forEach((id) => found.set(id, (found.get(id) || 0) + 1));
      }
      const candidates = [];
      for (const [placeId, variants] of [...found.entries()].slice(0, maxCandidates)) {
        let details = cache.get(placeId);
        if (details) cacheHits += 1;
        else {
          const raw = await gp.getDetails(placeId, { mask: undefined });
          details = flattenDetails(raw);
          cache.set(placeId, details);
          newDetails += 1;
          if (gp.calls.details >= MAX_DETAILS_CALLS) break;
        }
        candidates.push({ ...details, variants });
      }
      let best = null;
      for (const cand of candidates) {
        const det = judgeDeterministic(row, cand);
        if (!best || det.score > best.det.score) best = { cand, det };
      }

      let final = 'no_match';
      let source = 'no-candidate';
      let reason = 'Google did not return candidates';
      let bestCand = {};
      if (best) {
        bestCand = best.cand;
        final = best.det.verdict === 'yes' ? 'verified' : best.det.verdict === 'no' ? 'no_match' : 'maybe';
        source = `rules-${best.det.verdict}`;
        reason = best.det.reason;

        if (final === 'maybe' && llm && !llmDead && llmUsd < MAX_LLM_USD) {
          try {
            const judged = await llmJudge(llm, row, best.cand, best.det);
            llmUsd += judged.usd;
            llmCalls += 1;
            const verdict = String(judged.parsed.same_place || 'uncertain').toLowerCase();
            const conf = Number(judged.parsed.confidence || 0);
            if (verdict === 'yes' && conf >= 0.85) {
              final = 'verified'; source = 'llm-yes'; reason = `LLM אישר (${conf}): ${judged.parsed.reason || ''}`;
            } else if (verdict === 'no' && conf >= 0.85) {
              final = 'no_match'; source = 'llm-no'; reason = `LLM דחה (${conf}): ${judged.parsed.reason || ''}`;
            } else {
              final = 'maybe'; source = 'llm-uncertain'; reason = `LLM לא הכריע (${conf}): ${judged.parsed.reason || reason}`;
            }
          } catch (err) {
            llmDead = true;
            final = 'maybe';
            source = 'llm-error';
            reason = `${reason} · LLM unavailable: ${err.message}`;
          }
        }
      }
      tally[final] += 1;
      results.push({ ...row, final, source, reason, ...bestCand });
    } catch (err) {
      tally.error += 1;
      results.push({ ...row, final: 'error', source: 'error', reason: err.message });
    }
    if (results.length % 20 === 0) {
      console.log(`  ${results.length}/${rows.length} verified=${tally.verified} maybe=${tally.maybe} no=${tally.no_match} errors=${tally.error} TS=${gp.calls.textSearch} D=${gp.calls.details} cache=${cacheHits} llm=$${llmUsd.toFixed(3)}`);
      saveCache(cache);
    }
  }
  saveCache(cache);

  const stamp = Date.now();
  const scopeLabel = destinationId ? `dest${destinationId}` : countryCode.toLowerCase();
  const base = `foreign-${scopeLabel}-google-dryrun-${stamp}`;
  const csvFile = path.join(OUT_DIR, `${base}.csv`);
  const htmlFile = path.join(OUT_DIR, `${base}.html`);
  const cols = [
    'id', 'final', 'source', 'reason',
    'old_name', 'old_address', 'city', 'country', 'country_code', 'old_lat', 'old_lng',
    'place_id', 'google_name', 'google_address', 'google_lat', 'google_lng',
    'business_status', 'google_primary_type', 'google_types', 'google_maps_uri',
    'google_phone', 'google_rating', 'google_rating_count', 'google_opening_hours',
    'has_photo', 'google_photo_name', 'google_photo_attribution',
  ];
  fs.writeFileSync(
    csvFile,
    '\ufeff' + [cols.join(','), ...results.map((r) => cols.map((c) => csvEsc(r[c])).join(','))].join('\n') + '\n',
    'utf8',
  );

  const section = (title, color, items) => `
    <h2 style="color:${color}">${title} — ${items.length}</h2>
    <table><thead><tr>
      <th>ID</th><th>השם שלנו</th><th>כתובת שלנו</th><th>Google מצא</th><th>כתובת Google</th>
      <th>דירוג</th><th>טלפון</th><th>Photo name</th><th>נימוק</th><th>קישורים</th>
    </tr></thead><tbody>
    ${items.map((r) => `<tr>
      <td>${escHtml(r.id)}</td>
      <td><b>${escHtml(r.old_name)}</b><div class="muted">${escHtml(r.city)} · ${escHtml(r.country)}</div></td>
      <td>${escHtml(r.old_address)}</td>
      <td>${escHtml(r.google_name || '—')}</td>
      <td>${escHtml(r.google_address || '')}</td>
      <td>${escHtml(r.google_rating || '')}${r.google_rating_count ? ` (${escHtml(r.google_rating_count)})` : ''}</td>
      <td>${escHtml(r.google_phone || '')}</td>
      <td class="photo">${escHtml(r.google_photo_name || '')}</td>
      <td class="reason">${escHtml(r.reason || '')}</td>
      <td><a href="${escHtml(mapsSearch(r))}" target="_blank">שלנו</a>${r.place_id ? ` · <a href="${escHtml(googlePin(r.place_id))}" target="_blank">פין Google</a>` : ''}</td>
    </tr>`).join('')}
    </tbody></table>`;

  const by = (final) => results.filter((r) => r.final === final);
  const googleCost = (newDetails * 0.017).toFixed(2);
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>Foreign Google dry-run ${countryCode}</title>
<style>
body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#212121}
h1{font-size:18px}.sum{background:#fff;border:1px solid #ddd;border-radius:8px;padding:10px 12px;margin:10px 0 16px;font-size:13px}
table{border-collapse:collapse;width:100%;background:#fff;font-size:12px;margin-bottom:18px}
th,td{border:1px solid #e0e0e0;padding:5px 7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0}.muted{color:#607d8b;font-size:11px;margin-top:3px}
.reason{max-width:320px}.photo{max-width:220px;direction:ltr;text-align:left;word-break:break-all}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}
</style></head><body>
<h1>Google dry-run למסעדות חו״ל — ${escHtml(countryCode)}</h1>
<div class="sum">
שורות שנבדקו: <b>${results.length}</b> מתוך ${rows.length}<br>
✅ בטוח נכון: <b>${tally.verified}</b> · ❓ אולי: <b>${tally.maybe}</b> · ❌ לא נמצא/לא נכון: <b>${tally.no_match}</b> · שגיאות: <b>${tally.error}</b><br>
Text Search IDs-only: ${gp.calls.textSearch} · Details: ${gp.calls.details} (${newDetails} חדשים, ${cacheHits} cache) · Google estimate max: ~$${googleCost} · LLM: $${llmUsd.toFixed(3)} (${llmCalls})
<br>לא נכתב כלום ל-DB. נשמר גם google_photo_name בשביל שלב תמונות עתידי.
</div>
${section('✅ בטוח נכון', '#1b5e20', by('verified'))}
${section('❓ אולי / בדיקה ידנית', '#e65100', by('maybe'))}
${section('❌ לא נכון / לא נמצא', '#b71c1c', by('no_match'))}
${section('⚠️ שגיאות', '#6a1b9a', by('error'))}
</body></html>`;
  fs.writeFileSync(htmlFile, html, 'utf8');

  console.log('\n=== DONE — no DB writes ===');
  console.log({ countryCode, rows: results.length, tally, textSearch: gp.calls.textSearch, details: gp.calls.details, newDetails, cacheHits, googleCostMaxUsd: googleCost, llmUsd: llmUsd.toFixed(3), csvFile, htmlFile });
})();
