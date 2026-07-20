/*
 * OFFLINE triage of the ~2.9K pending (non-verified) Google candidates into
 * three buckets, per the user's relaxed rules ("our data is imprecise, Google
 * is right"):
 *   probably_right — same name across he/en (translation/transliteration), or
 *                    same city+street even with a different house number,
 *                    or an LLM yes that the strict pipeline gated out.
 *   surely_wrong   — a clearly different business (different name that is not
 *                    a translation, brand-vs-other-brand, non-food, address-as-name,
 *                    or a high-confidence LLM no).
 *   maybe          — everything in between.
 *
 * NO Google calls, NO LLM calls, NO DB writes. Input = resolved combined CSV.
 * Output: pending-triage.html (3 sections) + pending-triage.csv.
 *
 * Usage: node scripts/triage-pending-candidates.js [resolved.csv]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { nameSimilarity, normalizeName } = require('./lib/match-helpers');
const { classifyAddressFirst, nameType, looseKey, ourCity, houseNum } = require('./lib/address-match');

const file = process.argv[2] || path.join(__dirname, '..', 'audit-output', 'combined-dryrun-1783240537425-resolved.csv');

// ── CSV parse (RFC4180) ──
function parseCsv(f) {
  const s = fs.readFileSync(f, 'utf8').replace(/^﻿/, '');
  const rows = []; let ff = [], c = '', q = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { ff.push(c); c = ''; }
    else if (ch === '\n') { ff.push(c); rows.push(ff); ff = []; c = ''; }
    else if (ch !== '\r') c += ch; }
  if (c || ff.length) { ff.push(c); rows.push(ff); }
  return rows;
}
const csvEsc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

// ── Brand identity: if OUR name is brand A and GOOGLE's is brand B, it's a
//    different business no matter how close the address is. he/en aliases share
//    one id so בורגראנץ' == Burgeranch (NOT a conflict). ──
const BRAND_ALIASES = {
  burgeranch: ['בורגראנץ', 'burgeranch', 'burger ranch'],
  burgerking: ['בורגר קינג', 'burger king'],
  mcdonalds: ['מקדונלד', 'mcdonald'],
  kfc: ['kfc', 'קיי אף סי'],
  aroma: ['ארומה', 'aroma'],
  cofix: ['קופיקס', 'cofix'],
  cafecafe: ['קפה קפה', 'cafe cafe'],
  greg: ['קפה גרג', 'greg'],
  arcaffe: ['ארקפה', 'arcaffe'],
  landwer: ['לנדוור', 'landwer'],
  roladin: ['רולדין', 'roladin'],
  rebar: ['רבר', 're-bar', 'rebar'],
  dominos: ['דומינו', 'domino'],
  pizzahut: ['פיצה האט', 'pizza hut'],
  japanika: ['ג\'פניקה', 'גפניקה', 'japanika'],
  burgerim: ['בורגרים', 'burgerim'],
  moses: ['מוזס', 'moses'],
  bbb: ['בי בי בי', 'b.b.b', 'burgus'],
  shipudei: ['שיפודי ציפורה', 'shipudei tzipora'],
  golda: ['גולדה', 'golda'],
  vaniglia: ['וניליה', 'vaniglia'],
  anita: ['אניטה', 'anita'],
  segafredo: ['סגפרדו', 'segafredo'],
  biga: ['ביגה', 'biga'],
  shemesh: ['שמש במשולש'],
};
function brandsOf(name) {
  const n = normalizeName(name);
  const hits = new Set();
  for (const [id, aliases] of Object.entries(BRAND_ALIASES))
    if (aliases.some((a) => n.includes(normalizeName(a)))) hits.add(id);
  return hits;
}

// Google returned a street address instead of a business name
const ADDRESS_AS_NAME_RE = /(^\d+\s)|(\b(st|street|rd|road|blvd|ave|sderot|derech)\.?\s+\d+)|(^[A-Za-z\-'. ]+\s+St\b)/i;

// loose-key containment: catches transliteration pairs nameSimilarity may underscore
function looseContain(a, b) {
  const ka = looseKey(normalizeName(a)), kb = looseKey(normalizeName(b));
  if (ka.length < 4 || kb.length < 4) return false;
  return ka.includes(kb) || kb.includes(ka);
}

// ── The rulebook. Returns { bucket, score, why } ──
function judge(r) {
  const sim = Number(r.name_sim) || nameSimilarity(r.old_name, r.google_name);
  const nt = nameType(r.old_name);
  const af = classifyAddressFirst({
    old_name: r.old_name, old_address: r.old_address,
    google_name: r.google_name, google_address: r.google_address,
    name_sim: sim, business_status: r.business_status || 'OPERATIONAL',
    google_rating: r.google_rating, google_phone: r.google_phone,
    has_photo: r.has_photo, distance_m: r.distance_m,
  });
  const llmV = String(r.llm_verdict || '').toLowerCase();
  const llmC = Number(r.llm_conf) || 0;
  const ourBrands = brandsOf(r.old_name), gBrands = brandsOf(r.google_name);
  const sameBrand = [...ourBrands].some((b) => gBrands.has(b));
  const brandConflict = ourBrands.size && gBrands.size && !sameBrand;
  const contains = looseContain(r.old_name, r.google_name);
  const hn1 = Number(houseNum(r.old_address)), hn2 = Number(houseNum(r.google_address));
  const houseClose = !!(hn1 && hn2 && Math.abs(hn1 - hn2) <= 10);
  const strongName = sim >= 0.7 || contains || (llmV === 'yes' && llmC >= 0.8);
  const okName = sim >= 0.5 || contains || (llmV === 'yes' && llmC >= 0.7);

  // ══ SURELY WRONG ══
  if (r.food_signal === 'nonfood')
    return { bucket: 'wrong', score: 3, why: 'גוגל מצא עסק שאינו מזון (קניון/מרפאה/חנות)' };
  if (ADDRESS_AS_NAME_RE.test(r.google_name) && sim < 0.4)
    return { bucket: 'wrong', score: 3, why: 'גוגל החזיר כתובת/רחוב במקום שם עסק' };
  if (brandConflict)
    return { bucket: 'wrong', score: 3, why: `רשת מול רשת אחרת (${[...ourBrands]} ≠ ${[...gBrands]})` };
  if (llmV === 'no' && llmC >= 0.9 && sim < 0.45 && !af.addressExact)
    return { bucket: 'wrong', score: 2, why: `LLM דחה בביטחון ${llmC} + שם שונה (sim ${sim.toFixed(2)})` };
  if (r.business_status && r.business_status !== 'OPERATIONAL' && !strongName)
    return { bucket: 'wrong', score: 2, why: `העסק שגוגל מצא ${r.business_status === 'CLOSED_PERMANENTLY' ? 'סגור לצמיתות' : 'סגור זמנית'} ושם לא תואם` };
  if (sim < 0.3 && !contains && llmV !== 'yes' && !af.streetMatch)
    return { bucket: 'wrong', score: 1, why: 'שם שונה לחלוטין, אין תרגום, אין רחוב תואם, אין אישור LLM' };

  // ══ PROBABLY RIGHT ══
  // Chains are ALWAYS gated on street evidence — same brand in the same city is
  // usually a different branch (בורגראנץ' גור דב ≠ בורגראנץ' בתחנה המרכזית).
  const chainStreetOk = nt !== 'chain' || (af.streetMatch && (houseClose || !hn1 || !hn2));
  // Street+house agreeing is location-precise even when he↔en city detection fails.
  const strongAddr = af.streetMatch && af.houseExact;
  const cityOrStrongAddr = af.cityMatch || strongAddr;

  if (llmV === 'yes' && llmC >= 0.8 && nt === 'unique')
    return { bucket: 'right', score: 3, why: `LLM אישר (conf ${llmC}) — נחסם קודם רק בגלל רף ה-0.9` };
  if ((sim >= 0.75 || contains) && cityOrStrongAddr && nt === 'unique')
    return { bucket: 'right', score: 3, why: `שם זהה/תעתיק (sim ${sim.toFixed(2)}) + ${af.cityMatch ? 'אותה עיר' : 'רחוב+בית זהים'}` };
  if (nt === 'chain' && (sim >= 0.75 || contains) && af.streetMatch && (houseClose || af.houseExact))
    return { bucket: 'right', score: 2.5, why: `רשת — אותו סניף (רחוב${af.houseExact ? '+בית' : ' תואם'})` };
  if (llmV === 'yes' && llmC >= 0.8 && nt === 'chain' && af.streetMatch)
    return { bucket: 'right', score: 2.5, why: `רשת — LLM אישר (conf ${llmC}) + רחוב תואם` };
  if (okName && af.cityMatch && af.streetMatch && chainStreetOk)
    return { bucket: 'right', score: 2.5, why: `שם תואם (sim ${sim.toFixed(2)}) + עיר + רחוב${af.houseExact ? ' + מספר' : hn1 && hn2 ? ` (בית ${hn1}≠${hn2})` : ''}` };
  if (af.cityMatch && af.streetMatch && houseClose && sim >= 0.4 && nt === 'unique')
    return { bucket: 'right', score: 2, why: `עיר+רחוב+בית קרוב (${hn1}~${hn2}), שם חלקית (sim ${sim.toFixed(2)})` };
  if (llmV === 'yes' && llmC >= 0.7 && (af.streetMatch || af.addressExact) && chainStreetOk)
    return { bucket: 'right', score: 2, why: `LLM כן (conf ${llmC}) + רחוב תואם` };
  // Identical unique name + same house number: the street text failed only on
  // he↔en transliteration edge cases (חוגלה↔Khogla) — same place.
  if ((sim >= 0.9 || contains) && nt === 'unique' && hn1 && hn1 === hn2 && llmV !== 'no')
    return { bucket: 'right', score: 2, why: `שם זהה + אותו מספר בית (${hn1}) — רחוב בתעתיק שונה` };
  if ((sim >= 0.75 || contains) && nt === 'unique' && !r.old_address?.includes(','))
    return { bucket: 'right', score: 1.5, why: `שם זהה, לנו אין כתובת אמיתית להשוואה` };

  // ══ MAYBE ══
  let why = [];
  if (llmV === 'uncertain') why.push(`LLM לא בטוח (${llmC})`);
  if (llmV === 'yes') why.push(`LLM כן אבל conf ${llmC} נמוך`);
  if (llmV === 'no') why.push(`LLM לא (conf ${llmC})`);
  if (sim >= 0.4 && sim < 0.75) why.push(`שם דומה חלקית (${sim.toFixed(2)})`);
  if (nt === 'chain' && (sim >= 0.75 || contains) && !af.streetMatch) why.push('רשת באותו שם אבל רחוב אחר — כנראה סניף אחר');
  else if (af.cityMatch && !af.streetMatch) why.push('אותה עיר, רחוב שונה');
  if (!af.cityMatch && !af.streetMatch) why.push('עיר/רחוב לא זוהו כתואמים');
  if (nt === 'generic') why.push('שם גנרי');
  return { bucket: 'maybe', score: 0, why: why.join(' · ') || 'סימנים מעורבים' };
}

// ── main ──
const rows = parseCsv(file);
const H = rows[0];
const data = rows.slice(1).filter((r) => r.length >= H.length).map((a) => Object.fromEntries(H.map((h, i) => [h, a[i]])));
const fin = (r) => r.resolved_final || r.final;
const pending = data.filter((r) => fin(r) !== 'verified' && fin(r) !== 'error');
const withCand = pending.filter((r) => r.google_name);
const noCand = pending.length - withCand.length;

const buckets = { right: [], wrong: [], maybe: [] };
for (const r of withCand) {
  const j = judge(r);
  buckets[j.bucket].push({ r, ...j });
}
buckets.right.sort((a, b) => b.score - a.score || (Number(b.r.name_sim) || 0) - (Number(a.r.name_sim) || 0));
buckets.wrong.sort((a, b) => b.score - a.score);
buckets.maybe.sort((a, b) => (Number(b.r.name_sim) || 0) - (Number(a.r.name_sim) || 0));

// ── CSV out ──
const outDir = path.join(__dirname, '..', 'audit-output');
const csvOut = path.join(outDir, 'pending-triage.csv');
const CSV_COLS = ['triage', 'triage_score', 'triage_reason', ...H];
const lines = [CSV_COLS.join(',')];
for (const bucket of ['right', 'maybe', 'wrong'])
  for (const { r, score, why } of buckets[bucket])
    lines.push([bucket, score, why, ...H.map((h) => r[h])].map(csvEsc).join(','));
fs.writeFileSync(csvOut, '﻿' + lines.join('\n') + '\n', 'utf8');

// ── HTML out ──
const mapsQ = (r) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${r.old_name} ${r.old_address || ''}`);
function section(title, color, items, note) {
  let h = `<h2 style="color:${color}">${title} — ${items.length}</h2><p class="note">${note}</p>
  <table><thead><tr><th>ID</th><th>השם שלנו</th><th>כתובת שלנו</th><th>גוגל מצא</th><th>כתובת גוגל</th><th>sim</th><th>מרחק</th><th>★</th><th>למה</th><th>קישורים</th></tr></thead><tbody>`;
  for (const { r, why } of items) {
    const links = [`<a href="${esc(mapsQ(r))}" target="_blank">שלנו</a>`];
    if (r.google_maps_uri) links.push(`<a href="${esc(r.google_maps_uri)}" target="_blank">פין גוגל</a>`);
    h += `<tr><td>${esc(r.id)}</td><td><b>${esc(r.old_name)}</b></td><td>${esc(r.old_address)}</td>
      <td>${esc(r.google_name)}</td><td>${esc(r.google_address)}</td>
      <td class="n">${esc(r.name_sim)}</td><td class="n">${esc(r.distance_m)}</td><td class="n">${esc(r.google_rating || '')}</td>
      <td class="why">${esc(why)}</td><td>${links.join(' · ')}</td></tr>`;
  }
  return h + '</tbody></table>';
}
const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>טריאז' מסעדות לא-בטוחות — 3 חלקים</title>
<style>
body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#212121}
h1{font-size:19px}h2{font-size:16px;margin:26px 0 4px}
.sum{font-size:13.5px;margin:10px 0 4px}.sum b{padding:2px 10px;border-radius:6px;color:#fff;margin-inline-end:6px}
.note{font-size:12px;color:#666;margin:2px 0 8px}
table{border-collapse:collapse;width:100%;font-size:12px;background:#fff;margin-bottom:8px}
th,td{border:1px solid #e0e0e0;padding:4px 7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0}
tr:nth-child(even){background:#f7f9fa}
td.n{white-space:nowrap;font-variant-numeric:tabular-nums}
td.why{max-width:260px;color:#455a64}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}
</style></head><body>
<h1>טריאז' ${withCand.length} מסעדות לא-בטוחות (ישראל) — לפי חוקים מקלים</h1>
<div class="sum">
  <b style="background:#1b5e20">כנראה נכון: ${buckets.right.length}</b>
  <b style="background:#b71c1c">בטוח לא: ${buckets.wrong.length}</b>
  <b style="background:#e65100">אולי: ${buckets.maybe.length}</b>
  <span style="color:#888">· בלי מועמד גוגל בכלל (לא בקובץ): ${noCand}</span>
</div>
${section('✅ כנראה נכון — גוגל מצא את המסעדה', '#1b5e20', buckets.right, 'שם זהה גם בעברית↔אנגלית, או עיר+רחוב תואמים גם אם מספר הבית שונה, או אישור LLM שנחסם קודם רק בגלל רף מחמיר. ממוין מהבטוח ביותר.')}
${section('❓ אולי — צריך עין אנושית', '#e65100', buckets.maybe, 'סימנים מעורבים: שם דומה חלקית, עיר תואמת בלי רחוב, רשתות שאולי סניף אחר.')}
${section('❌ בטוח לא נכון — עסק אחר', '#b71c1c', buckets.wrong, 'שם שונה לחלוטין שאינו תרגום, רשת מול רשת אחרת, עסק לא-מזון, או דחיית LLM בביטחון גבוה.')}
</body></html>`;
fs.writeFileSync(path.join(outDir, 'pending-triage.html'), html, 'utf8');

console.log('=== PENDING TRIAGE (offline, no API, no DB) ===');
console.log(`pending rows: ${pending.length} | with a Google candidate: ${withCand.length} | no candidate at all: ${noCand}`);
console.log(`✅ probably right: ${buckets.right.length}`);
console.log(`❓ maybe:          ${buckets.maybe.length}`);
console.log(`❌ surely wrong:   ${buckets.wrong.length}`);
console.log(`HTML: audit-output/pending-triage.html`);
console.log(`CSV : audit-output/pending-triage.csv`);
