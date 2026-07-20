/*
 * OFFLINE — builds a 100-row manual-review sample of VERIFIED restaurants from
 * the resolved combined-dryrun CSV, weighted toward the risky buckets:
 * LLM, address-first, low name_sim, high distance, chains, and resolved
 * place_id-collision winners. Outputs a sample CSV + an HTML with Google Maps
 * links. No API, no DB, no writes.
 * Usage: node scripts/build-review-sample.js <combined-dryrun-*-resolved.csv> [N]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { nameType } = require('./lib/address-match');

const file = process.argv[2];
const TARGET = parseInt(process.argv[3], 10) || 100;
if (!file) { console.error('usage: node scripts/build-review-sample.js <resolved.csv> [N]'); process.exit(1); }

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
const mapsSearch = (query) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query || '');

const rows = parseCsv(file);
const H = rows[0];
const data = rows.slice(1).filter((r) => r.length >= H.length).map((r) => Object.fromEntries(H.map((h, i) => [h, r[i]])));
const fin = (r) => r.resolved_final || r.final;
const verified = data.filter((r) => fin(r) === 'verified');

// place_ids that had a collision (>=2 verified in the RAW final) -> the surviving verified row is the "winner"
const rawVerifiedByPid = {};
data.forEach((r) => { if (r.final === 'verified' && r.google_place_id) rawVerifiedByPid[r.google_place_id] = (rawVerifiedByPid[r.google_place_id] || 0) + 1; });
const collisionPids = new Set(Object.entries(rawVerifiedByPid).filter(([, n]) => n > 1).map(([p]) => p));

const buckets = {
  'LLM low-sim (<0.4)': (r) => r.source === 'llm' && Number(r.name_sim) < 0.4,
  'address-first': (r) => r.source === 'address-first',
  'high distance (>1km)': (r) => Number(r.distance_m) > 1000,
  'chain name': (r) => nameType(r.old_name) === 'chain',
  'resolved-collision winner': (r) => collisionPids.has(r.google_place_id),
  'LLM (other)': (r) => r.source === 'llm',
};
const quota = { 'LLM low-sim (<0.4)': 22, 'address-first': 18, 'high distance (>1km)': 18, 'chain name': 15, 'resolved-collision winner': 17, 'LLM (other)': 10 };

// deterministic shuffle (seeded) for reproducibility
let seed = 42; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const chosen = new Map(); // id -> {rec, buckets:[]}
for (const [name, test] of Object.entries(buckets)) {
  const pool = shuffle(verified.filter(test));
  let added = 0;
  for (const r of pool) {
    if (added >= quota[name]) break;
    if (!chosen.has(r.id)) { chosen.set(r.id, { rec: r, buckets: [] }); added++; }
    if (!chosen.get(r.id).buckets.includes(name)) chosen.get(r.id).buckets.push(name);
  }
}
// tag every chosen row with ALL buckets it matches (for transparency)
for (const { rec, buckets: bs } of chosen.values()) {
  for (const [name, test] of Object.entries(buckets)) if (test(rec) && !bs.includes(name)) bs.push(name);
}
// top up to TARGET with random verified if short
if (chosen.size < TARGET) {
  for (const r of shuffle(verified)) { if (chosen.size >= TARGET) break; if (!chosen.has(r.id)) chosen.set(r.id, { rec: r, buckets: ['random'] }); }
}
const sample = [...chosen.values()].slice(0, TARGET)
  .sort((a, b) => (Number(a.rec.name_sim) || 0) - (Number(b.rec.name_sim) || 0)); // hardest (lowest sim) first

// coverage report
const cov = {}; sample.forEach(({ buckets: bs }) => bs.forEach((b) => cov[b] = (cov[b] || 0) + 1));

// write sample CSV
const outCsv = file.replace(/-resolved\.csv$/i, `-review-sample-${TARGET}.csv`);
const OUT_H = ['buckets', ...H];
fs.writeFileSync(outCsv, '﻿' + [OUT_H.join(','), ...sample.map(({ rec, buckets: bs }) => [bs.join('|'), ...H.map((h) => rec[h])].map(csvEsc).join(','))].join('\n') + '\n', 'utf8');

// write HTML
let html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>מדגם בדיקה — ${sample.length} verified</title>
<style>
body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#212121}
h1{font-size:18px} .sum{font-size:13px;margin:8px 0 14px}
.sum span{display:inline-block;margin:2px 6px 2px 0;padding:3px 9px;border-radius:4px;background:#1b5e20;color:#fff}
table{border-collapse:collapse;width:100%;font-size:12.5px;background:#fff}
th,td{border:1px solid #e0e0e0;padding:5px 7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0}
tr:nth-child(even){background:#f7f9fa}
.b{font-size:11px;color:#00695c;white-space:nowrap} .ok{color:#1b5e20;font-weight:bold} .no{color:#b71c1c;font-weight:bold}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}
td.v{white-space:nowrap;font-variant-numeric:tabular-nums}
</style></head><body>
<h1>מדגם בדיקה ידנית — ${sample.length} מסעדות verified (הקשות ביותר קודם) · לחיצה פותחת ב-Google Maps</h1>
<div class="sum">כיסוי דליים: `;
Object.entries(cov).forEach(([k, v]) => { html += `<span>${esc(k)}: ${v}</span>`; });
html += `</div>
<p style="font-size:13px">לכל שורה: השם+כתובת שלנו מול מה שגוגל מצא, נימוק ה-LLM, ושני קישורים — "שלנו" (חיפוש) ו"פין גוגל" (המקום המדויק). בדוק אם ההתאמה נכונה (✔) או שגויה (✗).</p>
<table><thead><tr>
<th>#</th><th>דליים</th><th>מקור</th><th>השם שלנו</th><th>כתובת שלנו</th>
<th>גוגל מצא</th><th>כתובת גוגל</th><th>sim</th><th>מרחק</th><th>דירוג</th><th>📷</th><th>נימוק LLM</th><th>קישורים</th>
</tr></thead><tbody>`;
for (const { rec: r, buckets: bs } of sample) {
  const links = [`<a href="${esc(mapsSearch(r.old_name + ' ' + r.old_address))}" target="_blank">שלנו</a>`];
  if (r.google_maps_uri) links.push(`<a href="${esc(r.google_maps_uri)}" target="_blank">פין גוגל</a>`);
  html += `<tr>
<td>${esc(r.id)}</td>
<td class="b">${esc(bs.join(' · '))}</td>
<td>${esc(r.source)}${r.llm_verdict ? `<br>${esc(r.llm_verdict)}/${esc(r.llm_conf)}` : ''}</td>
<td>${esc(r.old_name)}</td><td>${esc(r.old_address)}</td>
<td>${esc(r.google_name || '—')}</td><td>${esc(r.google_address || '—')}</td>
<td class="v">${esc(r.name_sim)}</td>
<td class="v">${esc(r.distance_m)}${r.distance_m ? 'מ׳' : ''}</td>
<td class="v">${esc(r.google_rating || '')}${r.rating_count ? ' (' + esc(r.rating_count) + ')' : ''}</td>
<td>${r.photo_name ? '✔' : ''}</td>
<td style="max-width:340px">${esc(r.llm_reason || '')}</td>
<td>${links.join(' · ')}</td>
</tr>`;
}
html += `</tbody></table></body></html>`;
const outHtml = file.replace(/-resolved\.csv$/i, `-review-sample-${TARGET}.html`);
fs.writeFileSync(outHtml, html, 'utf8');

console.log('=== REVIEW SAMPLE (verified only, no writes) ===');
console.log('sampled:', sample.length, 'of', verified.length, 'verified');
console.log('bucket coverage:', JSON.stringify(cov));
console.log('CSV :', path.relative(path.join(__dirname, '..'), outCsv));
console.log('HTML:', path.relative(path.join(__dirname, '..'), outHtml));
