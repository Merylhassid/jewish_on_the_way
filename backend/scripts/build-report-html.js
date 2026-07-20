/*
 * OFFLINE — builds an HTML report from audit-output/dry-run-matches.csv so the
 * user can browse every restaurant + its match result with clickable links.
 * No API, no DB, no writes to DB. Usage: node scripts/build-report-html.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const inFile = path.join(__dirname, '..', 'audit-output', 'dry-run-matches.csv');
const outFile = path.join(__dirname, '..', 'audit-output', 'restaurant-report.html');

const parse = (line) => {
  const o = []; let c = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else { if (ch === ',') { o.push(c); c = ''; } else if (ch === '"') q = true; else c += ch; }
  }
  o.push(c); return o;
};
const t = fs.readFileSync(inFile, 'utf8').replace(/^﻿/, '').trim().split('\n');
const hdr = t[0].split(',');
const rows = t.slice(1).map((l) => { const a = parse(l); return Object.fromEntries(hdr.map((h, i) => [h, a[i]])); });

const houseNum = (a) => { const m = (a || '').match(/\b(\d{1,4})\b/); return m ? m[1] : ''; };
function category(r) {
  const sim = Number(r.name_sim), closed = /CLOSED/.test(r.business_status || '');
  const houseMatch = houseNum(r.old_address) && houseNum(r.old_address) === houseNum(r.google_address);
  if (r.status === 'verified') return { k: 1, t: '✅ הצליח — התאמה מלאה', c: '#1b5e20' };
  if (closed) return { k: 2, t: '🔴 סגור בגוגל', c: '#b71c1c' };
  if (r.status === 'flagged' && /proximity-name-mismatch/.test(r.reason)) return { k: 3, t: '🏬 עסק שכן/קניון', c: '#e65100' };
  if (!r.google_name) return { k: 4, t: '❓ לא בגוגל', c: '#424242' };
  if (sim >= 0.6 && houseMatch) return { k: 5, t: '📍 אותה מסעדה, קואורדינטה שבורה (ניתן להצלה)', c: '#0d47a1' };
  if (sim >= 0.6 && !houseMatch) return { k: 6, t: '🏘️ שם זהה, כתובת שונה (סניף אחר)', c: '#4a148c' };
  if (sim < 0.4) return { k: 7, t: '⛔ גוגל החזיר מקום אחר', c: '#880e4f' };
  return { k: 8, t: '🟡 גבולי — בדיקה ידנית', c: '#f57f17' };
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const mapsSearch = (q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q || '');

rows.forEach((r) => (r._cat = category(r)));
rows.sort((a, b) => a._cat.k - b._cat.k || Number(b.name_sim) - Number(a.name_sim));

const counts = {};
rows.forEach((r) => (counts[r._cat.t] = (counts[r._cat.t] || 0) + 1));

let html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>דוח התאמת מסעדות — Google Places</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;margin:20px;background:#fafafa;color:#212121}
h1{font-size:20px} .sum{margin:10px 0 20px;font-size:14px}
.sum span{display:inline-block;margin:2px 8px 2px 0;padding:3px 8px;border-radius:4px;color:#fff}
table{border-collapse:collapse;width:100%;font-size:13px;background:#fff}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0}
tr:nth-child(even){background:#f7f9fa}
.cat{font-weight:bold;white-space:nowrap}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}
.dist{white-space:nowrap;font-variant-numeric:tabular-nums}
</style></head><body>
<h1>דוח התאמת מסעדות (מדגם ${rows.length}) — לחיצה על הקישורים פותחת ב-Google Maps</h1>
<div class="sum">`;
const catColor = {};
rows.forEach((r) => (catColor[r._cat.t] = r._cat.c));
Object.entries(counts).forEach(([k, v]) => {
  html += `<span style="background:${catColor[k]}">${esc(k)}: ${v} (${(v / rows.length * 100).toFixed(0)}%)</span>`;
});
html += `</div><table><thead><tr>
<th>#</th><th>קטגוריה</th><th>השם שלנו</th><th>הכתובת שלנו</th>
<th>מה גוגל מצא</th><th>כתובת גוגל</th><th>מרחק</th><th>דירוג</th><th>קישורים</th>
</tr></thead><tbody>`;

for (const r of rows) {
  const links = [];
  links.push(`<a href="${esc(mapsSearch(r.old_name + ' ' + r.old_address))}" target="_blank">הכתובת שלנו</a>`);
  if (r.google_maps_uri) links.push(`<a href="${esc(r.google_maps_uri)}" target="_blank">הפין של גוגל</a>`);
  html += `<tr>
<td>${esc(r.id)}</td>
<td class="cat" style="color:${r._cat.c}">${esc(r._cat.t)}</td>
<td>${esc(r.old_name)}</td>
<td>${esc(r.old_address)}</td>
<td>${esc(r.google_name || '—')}</td>
<td>${esc(r.google_address || '—')}</td>
<td class="dist">${esc(r.distance_m)}${r.distance_m ? 'מ׳' : ''}</td>
<td>${esc(r.google_rating || '')}${r.google_rating_count ? ' ('+esc(r.google_rating_count)+')' : ''}${/CLOSED/.test(r.business_status||'')?' 🔴':''}</td>
<td>${links.join(' · ')}</td>
</tr>`;
}
html += `</tbody></table></body></html>`;

fs.writeFileSync(outFile, html, 'utf8');
console.log('HTML report written:', outFile);
console.log('rows:', rows.length);
