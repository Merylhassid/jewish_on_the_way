/*
 * PHASE A.2 — targeted correction pass. Re-judges ONLY rows the first relaxed
 * pass rejected/left-uncertain WHERE distance <= 400m: physical proximity
 * proves the spot; a differing street text there is OUR address error
 * (user rule: "our data may be wrong — small distance overrides street text").
 * No Google. No DB. Input: rejudge-maybe.csv. Output: rejudge-maybe-corrected.csv/html
 * (full merged result of Phase A after correction).
 */
'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Anthropic = require('@anthropic-ai/sdk');
const { nameType } = require('./lib/address-match');

const MODEL = process.env.SMART_SEARCH_LLM_MODEL || 'claude-haiku-4-5-20251001';
const LLM_IN_USD = 1 / 1e6, LLM_OUT_USD = 5 / 1e6;
const MAX_LLM_USD = 0.6;
const DIST_MAX = 400;

const SYSTEM = `You decide whether two restaurant listings refer to the SAME physical business.
Listing A is from our database; listing B is Google's candidate (authoritative). CRITICAL CONTEXT:
these two listings are physically within ${DIST_MAX} meters of each other (verified coordinates).
Rules:
- Hebrew<->English TRANSLATION or TRANSLITERATION = the SAME name.
- Because the two points are so close, a DIFFERENT STREET NAME in the text almost always means OUR
  address text is wrong (corner building, mall with two entrances, renamed street) — NOT a different place.
  If the name matches (including translation), answer "yes" even with different street text.
- Same logic for chains: within ${DIST_MAX}m it is the SAME branch -> "yes" if the brand matches.
- Answer "no" only if the NAMES clearly identify different businesses (not translation, different brand),
  or B is not a food business / just a street address.
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
  const src = path.join(__dirname, '..', 'audit-output', 'rejudge-maybe.csv');
  const rows = parseCsv(src);
  const H = rows[0];
  const data = rows.slice(1).filter((r) => r.length >= H.length).map((a) => Object.fromEntries(H.map((h, i) => [h, a[i]])));
  const eligible = (r) => (r.bucket === 'sure_wrong' || r.bucket === 'still_maybe') && r.distance_m !== '' && Number(r.distance_m) <= DIST_MAX;
  const targets = data.filter(eligible);
  console.log(`\n=== PHASE A.2 — 400m CORRECTION on ${targets.length} rows (no Google, no DB) ===\n`);

  const llm = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let usd = 0, calls = 0;
  const tally = { promoted: 0, kept: 0, error: 0 };

  for (const r of targets) {
    if (usd >= MAX_LLM_USD) { console.log('[budget] cap reached'); break; }
    try {
      const resp = await llm.messages.create({
        model: MODEL, max_tokens: 200, system: SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify({
          A_our_name: r.old_name, A_our_address: r.old_address,
          B_google_name: r.google_name, B_google_address: r.google_address,
          distance_meters: r.distance_m, name_type: nameType(r.old_name),
        }) }],
      });
      calls++;
      usd += (resp.usage?.input_tokens || 0) * LLM_IN_USD + (resp.usage?.output_tokens || 0) * LLM_OUT_USD;
      const m = resp.content.map((c) => c.text || '').join('').match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]);
        const v = String(j.same_place || 'uncertain').toLowerCase();
        const conf = Number(j.confidence) || 0;
        if (v === 'yes' && conf >= 0.8) {
          r.bucket = 'sure_right'; r.new_verdict = 'yes'; r.new_conf = conf;
          r.new_reason = '[תיקון 400מ] ' + (j.reason || '').replace(/[\r\n]+/g, ' ');
          tally.promoted++;
        } else tally.kept++;
      } else tally.kept++;
    } catch (e) { tally.error++; }
    if ((tally.promoted + tally.kept + tally.error) % 40 === 0)
      console.log(`  ...${tally.promoted + tally.kept + tally.error}/${targets.length} promoted=${tally.promoted} $${usd.toFixed(3)}`);
  }

  // write merged corrected CSV
  const outCsv = path.join(__dirname, '..', 'audit-output', 'rejudge-maybe-corrected.csv');
  fs.writeFileSync(outCsv, '﻿' + H.join(',') + '\n' + data.map((r) => H.map((h) => csvEsc(r[h])).join(',')).join('\n') + '\n', 'utf8');

  // rebuild HTML from merged data
  const buckets = { sure_right: [], sure_wrong: [], still_maybe: [] };
  data.forEach((r) => (buckets[r.bucket] || buckets.still_maybe).push(r));
  buckets.sure_right.sort((a, b) => Number(b.new_conf) - Number(a.new_conf));
  const mapsQ = (r) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${r.old_name} ${r.old_address || ''}`);
  const section = (title, color, items, note) => {
    let h = `<h2 style="color:${color}">${title} — ${items.length}</h2><p class="note">${note}</p>
    <table><thead><tr><th>ID</th><th>השם שלנו</th><th>כתובת שלנו</th><th>גוגל מצא</th><th>כתובת גוגל</th><th>sim</th><th>מרחק</th><th>conf</th><th>נימוק</th><th>קישורים</th></tr></thead><tbody>`;
    for (const r of items) {
      const links = [`<a href="${esc(mapsQ(r))}" target="_blank">שלנו</a>`];
      if (r.google_maps_uri) links.push(`<a href="${esc(r.google_maps_uri)}" target="_blank">פין גוגל</a>`);
      h += `<tr><td>${esc(r.id)}</td><td><b>${esc(r.old_name)}</b></td><td>${esc(r.old_address)}</td>
        <td>${esc(r.google_name)}</td><td>${esc(r.google_address)}</td>
        <td class="n">${esc(r.name_sim)}</td><td class="n">${esc(r.distance_m)}</td><td class="n">${esc(r.new_conf)}</td>
        <td class="why">${esc(r.new_reason)}</td><td>${links.join(' · ')}</td></tr>`;
    }
    return h + '</tbody></table>';
  };
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>שלב A מתוקן — שיפוט הכתומים</title>
<style>body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#212121}
h1{font-size:19px}h2{font-size:16px;margin:26px 0 4px}.note{font-size:12px;color:#666;margin:2px 0 8px}
.sum{font-size:13.5px;margin:10px 0}.sum b{padding:2px 10px;border-radius:6px;color:#fff;margin-inline-end:6px}
table{border-collapse:collapse;width:100%;font-size:12px;background:#fff;margin-bottom:8px}
th,td{border:1px solid #e0e0e0;padding:4px 7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0}tr:nth-child(even){background:#f7f9fa}
td.n{white-space:nowrap}td.why{max-width:300px;color:#455a64}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}</style></head><body>
<h1>שלב A (אחרי תיקון 400 מ') — ${data.length} מסעדות "אולי"</h1>
<div class="sum">
 <b style="background:#1b5e20">בטוח נכון: ${buckets.sure_right.length}</b>
 <b style="background:#b71c1c">בטוח לא: ${buckets.sure_wrong.length}</b>
 <b style="background:#e65100">עדיין אולי: ${buckets.still_maybe.length}</b>
 <span style="color:#888">· תיקון 400מ העלה ${tally.promoted} שורות</span>
</div>
${section('✅ בטוח נכון', '#1b5e20', buckets.sure_right, 'שם תואם (כולל תרגום) + עיר, או קרבה פיזית ≤400מ שמוכיחה שטקסט הרחוב אצלנו שגוי. נימוקים עם [תיקון 400מ] = הועלו בסיבוב התיקון.')}
${section('❓ עדיין אולי', '#e65100', buckets.still_maybe, 'לא מוכרע — לפיילוט B או בדיקה ידנית.')}
${section('❌ בטוח לא', '#b71c1c', buckets.sure_wrong, 'עסק אחר: שם שונה שאינו תרגום, סניף אחר רחוק, לא-מזון.')}
</body></html>`;
  fs.writeFileSync(path.join(__dirname, '..', 'audit-output', 'rejudge-maybe-corrected.html'), html, 'utf8');

  console.log('\n=== A.2 SUMMARY ===');
  console.log(`re-judged: ${calls} | promoted to sure_right: ${tally.promoted} | kept: ${tally.kept} | errors: ${tally.error}`);
  console.log(`cost: $${usd.toFixed(3)}`);
  console.log(`FINAL after correction: right=${buckets.sure_right.length} wrong=${buckets.sure_wrong.length} maybe=${buckets.still_maybe.length}`);
  console.log('CSV : audit-output/rejudge-maybe-corrected.csv');
  console.log('HTML: audit-output/rejudge-maybe-corrected.html');
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
