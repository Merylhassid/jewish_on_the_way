'use strict';

/*
 * Build a review/action plan for GB rows skipped due duplicate place_id.
 * Read-only: produces HTML + CSV.
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'audit-output', 'foreign-gb-user-decisions.csv');
const outCsv = path.join(__dirname, '..', 'audit-output', 'foreign-gb-duplicate-resolution.csv');
const outHtml = path.join(__dirname, '..', 'audit-output', 'foreign-gb-duplicate-resolution.html');

function parseCsv(file) {
  const s = fs.readFileSync(file, 'utf8').replace(/^\ufeff/, '');
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  const header = rows[0] || [];
  return rows.slice(1).filter((r) => r.length >= header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9א-ת]+/g, ' ')
    .trim();
}

function addressNum(s) {
  const m = String(s || '').match(/\b\d+\b/);
  return m ? m[0] : '';
}

function score(row) {
  let n = 0;
  const oldName = normalize(row.old_name);
  const gName = normalize(row.google_name);
  const oldAddr = normalize(row.old_address);
  const gAddr = normalize(row.google_address);
  if (oldName && gName && (oldName === gName || oldName.includes(gName) || gName.includes(oldName))) n += 5;
  if (addressNum(row.old_address) && addressNum(row.old_address) === addressNum(row.google_address)) n += 4;
  const oldTokens = new Set(oldAddr.split(' ').filter((x) => x.length > 2));
  let overlap = 0;
  gAddr.split(' ').forEach((x) => { if (oldTokens.has(x)) overlap += 1; });
  n += Math.min(overlap, 4);
  if (row.final === 'verified') n += 1;
  if (Number(row.id) >= 8000) n += 0.25; // newer imported rows often have richer exact English names.
  return n;
}

const approved = parseCsv(inputFile).filter((row) => row.decision === 'apply_google_shadow');
const byPid = new Map();
approved.forEach((row) => {
  if (!row.place_id) return;
  byPid.set(row.place_id, [...(byPid.get(row.place_id) || []), row]);
});

const groups = [...byPid.values()].filter((group) => group.length > 1);
const planned = [];

for (const group of groups) {
  const sorted = [...group].sort((a, b) => score(b) - score(a) || Number(b.id) - Number(a.id));
  const winner = sorted[0];
  sorted.forEach((row) => {
    const isWinner = row.id === winner.id;
    planned.push({
      ...row,
      duplicate_action: isWinner ? 'apply_winner' : 'duplicate_delete_candidate',
      duplicate_reason: isWinner
        ? 'Best row to keep for this Google place_id; apply Google shadow here.'
        : `Likely duplicate of #${winner.id}; same Google place_id, same business/address.`,
      duplicate_score: score(row).toFixed(2),
    });
  });
}

const cols = [
  'duplicate_action',
  'duplicate_reason',
  'duplicate_score',
  'id',
  'final',
  'old_name',
  'old_address',
  'place_id',
  'google_name',
  'google_address',
  'google_maps_uri',
  'google_rating',
  'google_rating_count',
  'google_phone',
  'google_photo_name',
];
fs.writeFileSync(outCsv, '\ufeff' + [cols.join(','), ...planned.map((row) => cols.map((col) => csvEsc(row[col])).join(','))].join('\n') + '\n', 'utf8');

const rowHtml = planned.map((row) => {
  const cls = row.duplicate_action === 'apply_winner' ? 'ok' : 'del';
  return `<tr class="${cls}">
    <td>${esc(row.duplicate_action)}</td>
    <td>${esc(row.id)}</td>
    <td>${esc(row.final)}</td>
    <td><b>${esc(row.old_name)}</b><br>${esc(row.old_address)}</td>
    <td><b>${esc(row.google_name)}</b><br>${esc(row.google_address)}<br><small>${esc(row.place_id)}</small></td>
    <td>${esc(row.duplicate_reason)}<br><small>score ${esc(row.duplicate_score)}</small></td>
    <td>${row.google_maps_uri ? `<a href="${esc(row.google_maps_uri)}" target="_blank">פין Google</a>` : ''}</td>
  </tr>`;
}).join('\n');

const counts = planned.reduce((acc, row) => {
  acc[row.duplicate_action] = (acc[row.duplicate_action] || 0) + 1;
  return acc;
}, {});

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>פתרון כפילויות GB</title>
<style>
body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#202124}
h1{font-size:20px;margin:0 0 8px}.sum span{display:inline-block;margin:3px;padding:4px 9px;border-radius:4px;background:#eceff1}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}th,td{border:1px solid #ddd;padding:7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0}.ok{background:#eef8ee}.del{background:#fff1f1}
small{color:#607d8b}a{color:#1565c0;text-decoration:none}
</style></head><body>
<h1>פתרון כפילויות Google place_id - GB</h1>
<div class="sum">
  <span>קבוצות: ${groups.length}</span>
  <span>שורות: ${planned.length}</span>
  <span>להחיל winner: ${counts.apply_winner || 0}</span>
  <span>מועמדי מחיקה כפילות: ${counts.duplicate_delete_candidate || 0}</span>
</div>
<p>זה דוח החלטה בלבד. אין כאן כתיבה ל-DB.</p>
<table><thead><tr><th>פעולה</th><th>ID</th><th>final</th><th>שלנו</th><th>גוגל</th><th>נימוק</th><th>קישור</th></tr></thead><tbody>
${rowHtml}
</tbody></table></body></html>`;

fs.writeFileSync(outHtml, html, 'utf8');
console.log(`groups: ${groups.length}`);
console.log(JSON.stringify(counts, null, 2));
console.log(outHtml);
console.log(outCsv);
