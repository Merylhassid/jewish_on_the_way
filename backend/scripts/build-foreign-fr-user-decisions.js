'use strict';

/*
 * Builds a review checkpoint from the user's decisions on the France dry-run.
 * No DB writes, no deletes.
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '..', 'audit-output', 'foreign-fr-google-dryrun-1783397925119.csv');
const OUT_CSV = path.join(__dirname, '..', 'audit-output', 'foreign-fr-user-decisions.csv');
const OUT_HTML = path.join(__dirname, '..', 'audit-output', 'foreign-fr-user-decisions.html');

const FORCE_VERIFY_IDS = new Set(['8196']); // Chabad Champs Elysees Shabbat
const DELETE_IDS = new Set(['7336']); // Syna Pizza, user marked closed/delete

function parseCsv(text) {
  const lines = text.replace(/^\ufeff/, '').trim().split(/\r?\n/);
  const header = lines.shift().split(',');
  return lines.map((line) => {
    const cols = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"' && quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = !quoted;
      else if (ch === ',' && !quoted) {
        cols.push(cur);
        cur = '';
      } else cur += ch;
    }
    cols.push(cur);
    return Object.fromEntries(header.map((h, i) => [h, cols[i] ?? '']));
  });
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
function mapsSearch(row) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${row.old_name} ${row.old_address || ''}`)}`;
}
function googlePin(row) {
  return row.place_id ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(row.place_id)}` : '';
}

const rows = parseCsv(fs.readFileSync(INPUT, 'utf8'));
const decisions = rows.map((row) => {
  let decision = 'manual_review';
  let user_note = '';
  if (row.final === 'verified' || FORCE_VERIFY_IDS.has(row.id)) {
    decision = 'apply_google_shadow';
    user_note = FORCE_VERIFY_IDS.has(row.id)
      ? 'User approved orange Chabad; use Google address/details'
      : 'User approved green rows';
  }
  if (row.final === 'no_match' || DELETE_IDS.has(row.id)) {
    decision = 'delete_restaurant_candidate';
    user_note = DELETE_IDS.has(row.id)
      ? 'User says closed permanently; delete from system'
      : 'User says all red rows should not enter and should be deleted';
  }
  return { decision, user_note, ...row };
});

const cols = ['decision', 'user_note', ...Object.keys(rows[0] || {})];
fs.writeFileSync(
  OUT_CSV,
  '\ufeff' + [cols.join(','), ...decisions.map((r) => cols.map((c) => csvEsc(r[c])).join(','))].join('\n') + '\n',
  'utf8',
);

const applyRows = decisions.filter((r) => r.decision === 'apply_google_shadow');
const deleteRows = decisions.filter((r) => r.decision === 'delete_restaurant_candidate');
const reviewRows = decisions.filter((r) => r.decision === 'manual_review');

function section(title, color, items) {
  return `<h2 style="color:${color}">${title} — ${items.length}</h2>
  <table><thead><tr>
    <th>ID</th><th>שם שלנו</th><th>כתובת שלנו</th><th>Google</th><th>כתובת Google</th>
    <th>דירוג</th><th>טלפון</th><th>Photo name</th><th>החלטה/נימוק</th><th>קישורים</th>
  </tr></thead><tbody>
  ${items.map((r) => `<tr>
    <td>${esc(r.id)}</td>
    <td><b>${esc(r.old_name)}</b><div class="muted">${esc(r.final)} · ${esc(r.source)}</div></td>
    <td>${esc(r.old_address)}</td>
    <td>${esc(r.google_name || '—')}</td>
    <td>${esc(r.google_address || '')}</td>
    <td>${esc(r.google_rating || '')}${r.google_rating_count ? ` (${esc(r.google_rating_count)})` : ''}</td>
    <td>${esc(r.google_phone || '')}</td>
    <td class="photo">${esc(r.google_photo_name || '')}</td>
    <td class="reason"><b>${esc(r.user_note)}</b><br>${esc(r.reason)}</td>
    <td><a href="${esc(mapsSearch(r))}" target="_blank">שלנו</a>${r.place_id ? ` · <a href="${esc(googlePin(r))}" target="_blank">פין Google</a>` : ''}</td>
  </tr>`).join('')}
  </tbody></table>`;
}

fs.writeFileSync(OUT_HTML, `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>France user decisions</title>
<style>
body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#212121}
h1{font-size:18px}.sum{background:#fff;border:1px solid #ddd;border-radius:8px;padding:10px 12px;margin:10px 0 16px;font-size:13px}
table{border-collapse:collapse;width:100%;background:#fff;font-size:12px;margin-bottom:20px}
th,td{border:1px solid #e0e0e0;padding:5px 7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0}.muted{color:#607d8b;font-size:11px;margin-top:3px}
.reason{max-width:340px}.photo{max-width:220px;direction:ltr;text-align:left;word-break:break-all}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}
</style></head><body>
<h1>France Google dry-run — החלטות משתמש</h1>
<div class="sum">
להכנסה לשכבת Google: <b>${applyRows.length}</b><br>
למחיקה מועמדת: <b>${deleteRows.length}</b><br>
נשאר לבדיקה ידנית: <b>${reviewRows.length}</b><br>
זהו דוח החלטות בלבד. לא נכתב ל-DB ולא נמחק שום דבר.
</div>
${section('✅ להכנסה לשכבת Google', '#1b5e20', applyRows)}
${section('🗑️ למחיקה מועמדת', '#b71c1c', deleteRows)}
${section('❓ נשאר לבדיקה', '#e65100', reviewRows)}
</body></html>`, 'utf8');

console.log({
  apply_google_shadow: applyRows.length,
  delete_restaurant_candidate: deleteRows.length,
  manual_review: reviewRows.length,
  outCsv: OUT_CSV,
  outHtml: OUT_HTML,
});
