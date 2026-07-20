/*
 * OFFLINE — builds an HTML report from the resolved combined-dryrun CSV so the
 * user can browse every restaurant + its verification result with clickable
 * Google Maps links. No API, no DB, no writes.
 * Usage: node scripts/build-verification-report.js <combined-dryrun-*-resolved.csv>
 */
'use strict';
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/build-verification-report.js <resolved.csv>'); process.exit(1); }

const s = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
const rows = []; let f = [], c = '', q = false;
for (let i = 0; i < s.length; i++) { const ch = s[i];
  if (q) { if (ch === '"') { if (s[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
  else if (ch === '"') q = true; else if (ch === ',') { f.push(c); c = ''; }
  else if (ch === '\n') { f.push(c); rows.push(f); f = []; c = ''; }
  else if (ch !== '\r') c += ch; }
if (c || f.length) { f.push(c); rows.push(f); }
const H = rows[0];
const data = rows.slice(1).filter((r) => r.length >= H.length).map((r) => Object.fromEntries(H.map((h, i) => [h, r[i]])));

const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const mapsSearch = (query) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query || '');
const fin = (r) => r.resolved_final || r.final;

// order: verified first, then uncertain, flagged, no_match; within, by source then name_sim desc
const finOrder = { verified: 0, uncertain: 1, flagged: 2, no_match: 3, error: 4 };
data.sort((a, b) => (finOrder[fin(a)] ?? 9) - (finOrder[fin(b)] ?? 9)
  || String(a.source).localeCompare(String(b.source))
  || (Number(b.name_sim) || 0) - (Number(a.name_sim) || 0));

const byFin = {}, bySrc = {};
data.forEach((r) => { byFin[fin(r)] = (byFin[fin(r)] || 0) + 1; if (fin(r) === 'verified') bySrc[r.source] = (bySrc[r.source] || 0) + 1; });
const finColor = { verified: '#1b5e20', uncertain: '#f57f17', flagged: '#e65100', no_match: '#616161', error: '#b71c1c' };

let html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>אימות מסעדות — Google Places (ישראל)</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;margin:16px;background:#fafafa;color:#212121}
h1{font-size:19px} .sum{margin:8px 0 16px;font-size:13px}
.sum span{display:inline-block;margin:2px 6px 2px 0;padding:3px 9px;border-radius:4px;color:#fff}
.filters{margin:8px 0;font-size:13px} .filters button{margin:2px;padding:4px 10px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer}
table{border-collapse:collapse;width:100%;font-size:12.5px;background:#fff}
th,td{border:1px solid #e0e0e0;padding:5px 7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0;z-index:1}
tr:nth-child(even){background:#f7f9fa}
.f{font-weight:bold;white-space:nowrap} .dist{white-space:nowrap;font-variant-numeric:tabular-nums}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}
.col{color:#e65100;font-size:11px}
</style></head><body>
<h1>אימות מסעדות ישראל — ${data.length} סה״כ · לחיצה על הקישורים פותחת ב-Google Maps</h1>
<div class="sum">`;
Object.entries(byFin).sort((a, b) => (finOrder[a[0]] ?? 9) - (finOrder[b[0]] ?? 9)).forEach(([k, v]) => {
  html += `<span style="background:${finColor[k] || '#333'}">${esc(k)}: ${v} (${(v / data.length * 100).toFixed(0)}%)</span>`;
});
html += `</div><div class="sum">verified לפי מקור: `;
Object.entries(bySrc).forEach(([k, v]) => { html += `<span style="background:#1b5e20">${esc(k)}: ${v}</span>`; });
html += `</div>
<div class="filters">סינון: <button onclick="flt('all')">הכל</button>
<button onclick="flt('verified')">verified</button>
<button onclick="flt('uncertain')">uncertain</button>
<button onclick="flt('flagged')">flagged</button>
<button onclick="flt('no_match')">no_match</button></div>
<table id="t"><thead><tr>
<th>#</th><th>תוצאה</th><th>מקור</th><th>השם שלנו</th><th>כתובת שלנו</th>
<th>גוגל מצא</th><th>כתובת גוגל</th><th>sim</th><th>מרחק</th><th>דירוג</th><th>📷</th><th>LLM</th><th>קישורים</th>
</tr></thead><tbody>`;

for (const r of data) {
  const links = [`<a href="${esc(mapsSearch(r.old_name + ' ' + r.old_address))}" target="_blank">שלנו</a>`];
  if (r.google_maps_uri) links.push(`<a href="${esc(r.google_maps_uri)}" target="_blank">פין גוגל</a>`);
  const llm = r.llm_verdict ? `${esc(r.llm_verdict)}/${esc(r.llm_conf)}` : '';
  html += `<tr data-f="${esc(fin(r))}">
<td>${esc(r.id)}</td>
<td class="f" style="color:${finColor[fin(r)] || '#333'}">${esc(fin(r))}${r.collision ? '<br><span class="col">↓' + esc(r.collision) + '</span>' : ''}</td>
<td>${esc(r.source)}</td>
<td>${esc(r.old_name)}</td><td>${esc(r.old_address)}</td>
<td>${esc(r.google_name || '—')}</td><td>${esc(r.google_address || '—')}</td>
<td>${esc(r.name_sim)}</td>
<td class="dist">${esc(r.distance_m)}${r.distance_m ? 'מ׳' : ''}</td>
<td>${esc(r.google_rating || '')}${r.rating_count ? ' (' + esc(r.rating_count) + ')' : ''}${/CLOSED/.test(r.business_status || '') ? ' 🔴' : ''}</td>
<td>${r.photo_name ? '✔' : ''}</td>
<td title="${esc(r.llm_reason)}">${llm}</td>
<td>${links.join(' · ')}</td>
</tr>`;
}
html += `</tbody></table>
<script>
function flt(k){document.querySelectorAll('#t tbody tr').forEach(function(tr){tr.style.display=(k==='all'||tr.dataset.f===k)?'':'none';});}
</script></body></html>`;

const outFile = file.replace(/-resolved\.csv$/i, '-report.html').replace(/\.csv$/i, '-report.html');
fs.writeFileSync(outFile, html, 'utf8');
console.log('HTML report:', path.relative(path.join(__dirname, '..'), outFile));
console.log('rows:', data.length);
