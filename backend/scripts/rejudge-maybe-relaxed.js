/*
 * PHASE A — re-judge the 812 "maybe" pending rows with the RELAXED doctrine.
 * NO Google calls. NO DB writes. Input: audit-output/pending-triage.csv
 * (triage=maybe rows only). Uses cached Google candidate data + Haiku.
 *
 * Relaxed doctrine (user-approved):
 *  - Hebrew<->English translation/transliteration = same name.
 *  - OUR address/coords are often wrong; Google is authoritative. Same city,
 *    same or nearby street => strong yes. House-number differences are fine.
 *  - Chains: a different street in the same city = a DIFFERENT branch => no
 *    (its phone/photo/pin would belong to the wrong branch).
 *  - Generic names need address support.
 *
 * Output buckets: sure_right (yes conf>=0.8) / sure_wrong (no conf>=0.8) / still_maybe.
 * Files: rejudge-maybe.csv (incremental) + rejudge-maybe.html
 * Budget guard: MAX_LLM_USD = 1.5
 */
'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { nameType } = require('./lib/address-match');

const MODEL = process.env.SMART_SEARCH_LLM_MODEL || 'claude-haiku-4-5-20251001';
const LLM_IN_USD = 1 / 1e6, LLM_OUT_USD = 5 / 1e6;
const MAX_LLM_USD = 1.5;
const YES_CONF = 0.8, NO_CONF = 0.8;

const SYSTEM = `You decide whether two restaurant listings refer to the SAME physical business.
Listing A is from our database (often imprecise); listing B is Google's candidate (authoritative).
Rules:
- Hebrew<->English TRANSLATION or TRANSLITERATION of a name = the SAME name ("מרכז אסיה"="Central Asia", "פיתה בסטה"="Pita Basta").
- OUR address and coordinates are frequently WRONG. If the unique name clearly matches and the city matches, answer yes even if street/house differ. A large distance value does NOT rule out a match.
- House-number differences on the same street are fine (our data error).
- SMALL DISTANCE OVERRIDES STREET TEXT: if distance_meters is small (<=400) and the name matches, answer "yes" even when the street names differ — our street text is probably wrong (corner building, mall with two entrances, renamed street). The physical proximity proves it is the same spot.
- CHAIN brands (name_type=chain): a different street in the same city usually means a DIFFERENT BRANCH -> "no" (Google's phone/photo/pin would belong to the wrong branch). EXCEPTION: if distance_meters <= 400, it is the SAME branch (our address text is wrong) -> "yes". Same street (any house number) -> "yes".
- GENERIC names (just "pizza"/"shawarma", name_type=generic): require the street to match; otherwise "uncertain".
- If B is clearly not a food business, or is just a street address with no business name -> "no".
Respond STRICT JSON only: {"same_place":"yes|no|uncertain","confidence":0.0-1.0,"reason":"short Hebrew"}`;

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

(async () => {
  const src = path.join(__dirname, '..', 'audit-output', 'pending-triage.csv');
  const rows = parseCsv(src);
  const H = rows[0];
  const data = rows.slice(1).filter((r) => r.length >= H.length).map((a) => Object.fromEntries(H.map((h, i) => [h, a[i]])));
  const maybe = data.filter((r) => r.triage === 'maybe');
  console.log(`\n=== PHASE A — RE-JUDGE ${maybe.length} MAYBE ROWS (relaxed, no Google, no DB) ===\n`);

  const llm = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const outDir = path.join(__dirname, '..', 'audit-output');
  const csvOut = path.join(outDir, 'rejudge-maybe.csv');
  const OUT_COLS = ['bucket', 'new_verdict', 'new_conf', 'new_reason', ...H];
  fs.writeFileSync(csvOut, '﻿' + OUT_COLS.join(',') + '\n', 'utf8');

  const tally = { sure_right: 0, sure_wrong: 0, still_maybe: 0, error: 0 };
  const results = [];
  let usd = 0, calls = 0;

  for (const r of maybe) {
    if (usd >= MAX_LLM_USD) { console.log(`[budget] LLM cap $${MAX_LLM_USD} reached`); break; }
    let verdict = 'uncertain', conf = 0, reason = '';
    try {
      const resp = await llm.messages.create({
        model: MODEL, max_tokens: 200, system: SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify({
          A_our_name: r.old_name, A_our_address: r.old_address,
          B_google_name: r.google_name, B_google_address: r.google_address,
          distance_meters: r.distance_m, name_type: nameType(r.old_name),
          B_google_types: r.google_types || r.google_primary_type || '',
        }) }],
      });
      calls++;
      usd += (resp.usage?.input_tokens || 0) * LLM_IN_USD + (resp.usage?.output_tokens || 0) * LLM_OUT_USD;
      const m = resp.content.map((c) => c.text || '').join('').match(/\{[\s\S]*\}/);
      if (m) { const j = JSON.parse(m[0]); verdict = String(j.same_place || 'uncertain').toLowerCase(); conf = Number(j.confidence) || 0; reason = (j.reason || '').replace(/[\r\n]+/g, ' '); }
    } catch (e) { reason = 'error: ' + e.message.slice(0, 60); tally.error++; }

    let bucket = 'still_maybe';
    if (verdict === 'yes' && conf >= YES_CONF) bucket = 'sure_right';
    else if (verdict === 'no' && conf >= NO_CONF) bucket = 'sure_wrong';
    tally[bucket]++;
    results.push({ r, bucket, verdict, conf, reason });
    fs.appendFileSync(csvOut, [bucket, verdict, conf, reason, ...H.map((h) => r[h])].map(csvEsc).join(',') + '\n', 'utf8');
    const done = results.length;
    if (done % 50 === 0) console.log(`  ...${done}/${maybe.length}  right=${tally.sure_right} wrong=${tally.sure_wrong} maybe=${tally.still_maybe}  $${usd.toFixed(3)}`);
  }

  // HTML
  const mapsQ = (r) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${r.old_name} ${r.old_address || ''}`);
  const section = (title, color, items, note) => {
    let h = `<h2 style="color:${color}">${title} — ${items.length}</h2><p class="note">${note}</p>
    <table><thead><tr><th>ID</th><th>השם שלנו</th><th>כתובת שלנו</th><th>גוגל מצא</th><th>כתובת גוגל</th><th>sim</th><th>conf</th><th>נימוק חדש</th><th>קישורים</th></tr></thead><tbody>`;
    for (const { r, conf, reason } of items) {
      const links = [`<a href="${esc(mapsQ(r))}" target="_blank">שלנו</a>`];
      if (r.google_maps_uri) links.push(`<a href="${esc(r.google_maps_uri)}" target="_blank">פין גוגל</a>`);
      h += `<tr><td>${esc(r.id)}</td><td><b>${esc(r.old_name)}</b></td><td>${esc(r.old_address)}</td>
        <td>${esc(r.google_name)}</td><td>${esc(r.google_address)}</td>
        <td class="n">${esc(r.name_sim)}</td><td class="n">${conf}</td><td class="why">${esc(reason)}</td><td>${links.join(' · ')}</td></tr>`;
    }
    return h + '</tbody></table>';
  };
  const by = (b) => results.filter((x) => x.bucket === b).sort((a, c) => c.conf - a.conf);
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>שלב A — שיפוט מחדש של הכתומים</title>
<style>body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#212121}
h1{font-size:19px}h2{font-size:16px;margin:26px 0 4px}.note{font-size:12px;color:#666;margin:2px 0 8px}
.sum{font-size:13.5px;margin:10px 0}.sum b{padding:2px 10px;border-radius:6px;color:#fff;margin-inline-end:6px}
table{border-collapse:collapse;width:100%;font-size:12px;background:#fff;margin-bottom:8px}
th,td{border:1px solid #e0e0e0;padding:4px 7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0}tr:nth-child(even){background:#f7f9fa}
td.n{white-space:nowrap}td.why{max-width:300px;color:#455a64}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}</style></head><body>
<h1>שלב A — שיפוט מחדש (מקל) של ${results.length} מסעדות "אולי"</h1>
<div class="sum">
 <b style="background:#1b5e20">בטוח נכון: ${tally.sure_right}</b>
 <b style="background:#b71c1c">בטוח לא: ${tally.sure_wrong}</b>
 <b style="background:#e65100">עדיין אולי: ${tally.still_maybe}</b>
 <span style="color:#888">· עלות: $${usd.toFixed(3)} (${calls} קריאות Haiku)</span>
</div>
${section('✅ בטוח נכון', '#1b5e20', by('sure_right'), 'ה-LLM אישר בביטחון ≥0.8 עם הכללים המקלים. מועמדים ל-apply אחרי בדיקתך.')}
${section('❌ בטוח לא', '#b71c1c', by('sure_wrong'), 'ה-LLM דחה בביטחון ≥0.8 — עסק אחר/סניף אחר. ילכו לפיילוט B.')}
${section('❓ עדיין אולי', '#e65100', by('still_maybe'), 'נשארו לא מוכרעים — יצטרפו לפיילוט B או לבדיקה ידנית.')}
</body></html>`;
  fs.writeFileSync(path.join(outDir, 'rejudge-maybe.html'), html, 'utf8');

  console.log('\n=== PHASE A SUMMARY (no Google, no DB writes) ===');
  console.log(`judged: ${results.length}/${maybe.length}`);
  console.log(`✅ sure_right: ${tally.sure_right}`);
  console.log(`❌ sure_wrong: ${tally.sure_wrong}`);
  console.log(`❓ still_maybe: ${tally.still_maybe} | errors: ${tally.error}`);
  console.log(`Anthropic cost: $${usd.toFixed(3)} (${calls} calls)`);
  console.log('CSV : audit-output/rejudge-maybe.csv');
  console.log('HTML: audit-output/rejudge-maybe.html');
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
