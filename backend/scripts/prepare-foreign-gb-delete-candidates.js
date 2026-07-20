'use strict';

/*
 * Prepare GB delete candidates report:
 * - duplicate_delete_candidate rows from foreign-gb-duplicate-resolution.csv
 * - delete_restaurant_candidate rows from foreign-gb-user-decisions.csv
 *
 * Read-only: writes full backup JSON + HTML.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const decisionsFile = path.join(__dirname, '..', 'audit-output', 'foreign-gb-user-decisions.csv');
const duplicatesFile = path.join(__dirname, '..', 'audit-output', 'foreign-gb-duplicate-resolution.csv');

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

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

(async () => {
  const deleteById = new Map();
  parseCsv(decisionsFile)
    .filter((row) => row.decision === 'delete_restaurant_candidate')
    .forEach((row) => deleteById.set(Number(row.id), { ...row, delete_reason: 'GB red row not approved by user' }));
  parseCsv(duplicatesFile)
    .filter((row) => row.duplicate_action === 'duplicate_delete_candidate')
    .forEach((row) => deleteById.set(Number(row.id), { ...row, delete_reason: row.duplicate_reason || 'GB duplicate loser' }));

  const rows = [...deleteById.values()].sort((a, b) => Number(a.id) - Number(b.id));
  const ids = rows.map((row) => Number(row.id));

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  const dbRows = ids.length ? (await client.query(`select * from restaurants where id = any($1) order by id`, [ids])).rows : [];
  await client.end();

  const byId = new Map(dbRows.map((row) => [Number(row.id), row]));
  const backupFile = path.join(__dirname, '..', 'audit-output', 'foreign-gb-delete-candidates-backup.json');
  const htmlFile = path.join(__dirname, '..', 'audit-output', 'foreign-gb-delete-candidates.html');
  fs.writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), count: dbRows.length, rows: dbRows }, null, 2), 'utf8');

  const htmlRows = rows.map((row) => {
    const db = byId.get(Number(row.id)) || {};
    return `<tr>
      <td>${esc(row.id)}</td>
      <td><b>${esc(row.old_name || db.name)}</b><br>${esc(row.old_address || db.address)}</td>
      <td><b>${esc(row.google_name)}</b><br>${esc(row.google_address)}</td>
      <td>${esc(row.delete_reason)}</td>
      <td>${esc(db.verification_status)}</td>
      <td>${esc(db.google_place_id)}</td>
      <td>${row.google_maps_uri ? `<a href="${esc(row.google_maps_uri)}" target="_blank">פין Google</a>` : ''}</td>
    </tr>`;
  }).join('\n');

  fs.writeFileSync(htmlFile, `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>GB delete candidates</title>
<style>body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#202124}.note{background:#fff3cd;border:1px solid #ffe08a;padding:10px;border-radius:6px;margin:12px 0}table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}th,td{border:1px solid #ddd;padding:7px;text-align:right;vertical-align:top}th{background:#eceff1;position:sticky;top:0}small{color:#607d8b}a{color:#1565c0;text-decoration:none}</style>
</head><body><h1>מועמדים למחיקה - GB (${rows.length})</h1>
<div class="note"><b>לא בוצעה מחיקה.</b> נוצר גיבוי מלא: <code>${esc(path.basename(backupFile))}</code>. מחיקה בפועל דורשת אישור מפורש.</div>
<table><thead><tr><th>ID</th><th>שלנו</th><th>גוגל</th><th>סיבה</th><th>סטטוס</th><th>google_place_id</th><th>קישור</th></tr></thead><tbody>${htmlRows}</tbody></table></body></html>`, 'utf8');

  console.log(`delete candidates: ${rows.length}`);
  console.log(`found in DB: ${dbRows.length}`);
  console.log(htmlFile);
  console.log(backupFile);
})();
