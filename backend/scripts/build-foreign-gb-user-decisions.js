'use strict';

/*
 * Build user decisions for the GB dry-run.
 *
 * User rule:
 * - approve all green/verified rows
 * - additionally approve specific red/no_match rows by id
 * - remaining no_match rows become delete candidates
 * - maybe rows remain manual review
 *
 * Read-only: writes CSV + HTML only.
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'audit-output', 'foreign-gb-google-dryrun-1783402443683.csv');
const outCsv = path.join(__dirname, '..', 'audit-output', 'foreign-gb-user-decisions.csv');
const outHtml = path.join(__dirname, '..', 'audit-output', 'foreign-gb-user-decisions.html');

// Approved red rows from the user's names:
// MAZAL London -> #8127; Reubens Deli -> #8153; Sharon's Bakery -> #8159;
// Beit HaMadras -> #8099; BRACHA -> #6358; PUKUSH -> #4704.
const APPROVED_RED_IDS = new Set([8127, 8153, 8159, 8099, 6358, 4704]);

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
  return { header, rows: rows.slice(1).filter((r) => r.length >= header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]]))) };
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

function decisionFor(row) {
  const id = Number(row.id);
  if (row.final === 'verified') return ['apply_google_shadow', 'User approved all green rows'];
  if (APPROVED_RED_IDS.has(id)) return ['apply_google_shadow', 'User approved this red row by name'];
  if (row.final === 'no_match') return ['delete_restaurant_candidate', 'Red row not approved by user'];
  return ['manual_review', 'Maybe row requires user decision'];
}

const { header, rows } = parseCsv(inputFile);
const outRows = rows.map((row) => {
  const [decision, user_note] = decisionFor(row);
  return { decision, user_note, ...row };
});

const outHeader = ['decision', 'user_note', ...header];
fs.writeFileSync(outCsv, '\ufeff' + [outHeader.join(','), ...outRows.map((row) => outHeader.map((h) => csvEsc(row[h])).join(','))].join('\n') + '\n', 'utf8');

const counts = outRows.reduce((acc, row) => {
  acc[row.decision] = (acc[row.decision] || 0) + 1;
  return acc;
}, {});

const rowHtml = outRows.map((row) => {
  const cls = row.decision === 'apply_google_shadow' ? 'ok' : row.decision === 'delete_restaurant_candidate' ? 'del' : 'maybe';
  return `<tr class="${cls}">
    <td>${esc(row.decision)}</td>
    <td>${esc(row.id)}</td>
    <td>${esc(row.final)}</td>
    <td><b>${esc(row.old_name)}</b><br>${esc(row.old_address)}</td>
    <td><b>${esc(row.google_name)}</b><br>${esc(row.google_address)}<br><small>${esc(row.business_status)}</small></td>
    <td>${esc(row.user_note)}<br><small>${esc(row.reason)}</small></td>
    <td>${row.google_maps_uri ? `<a href="${esc(row.google_maps_uri)}" target="_blank">פין Google</a>` : ''}</td>
  </tr>`;
}).join('\n');

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>GB user decisions</title>
<style>
body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#202124}
h1{font-size:20px}.sum span{display:inline-block;margin:3px;padding:4px 9px;border-radius:4px;background:#eceff1}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}th,td{border:1px solid #ddd;padding:7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0}.ok{background:#eef8ee}.del{background:#fff1f1}.maybe{background:#fff8e1}
small{color:#607d8b}a{color:#1565c0;text-decoration:none}
</style></head><body>
<h1>החלטות משתמש - GB</h1>
<div class="sum">
  <span>apply: ${counts.apply_google_shadow || 0}</span>
  <span>delete candidates: ${counts.delete_restaurant_candidate || 0}</span>
  <span>manual: ${counts.manual_review || 0}</span>
</div>
<p>דוח החלטה בלבד. אין כתיבה ל-DB.</p>
<table><thead><tr><th>החלטה</th><th>ID</th><th>final</th><th>שלנו</th><th>גוגל</th><th>נימוק</th><th>קישור</th></tr></thead><tbody>
${rowHtml}
</tbody></table></body></html>`;

fs.writeFileSync(outHtml, html, 'utf8');
console.log(JSON.stringify(counts, null, 2));
console.log(outHtml);
console.log(outCsv);
