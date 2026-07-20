'use strict';

/*
 * Prepare a safe deletion review pack for France restaurants rejected by user.
 *
 * This script is read-only:
 * - reads audit-output/foreign-fr-user-decisions.csv
 * - selects decision=delete_restaurant_candidate
 * - writes full-row backup JSON + human HTML review
 * - does not update/delete anything
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const inputArg = process.argv[2] || 'audit-output/foreign-fr-user-decisions.csv';
const inputFile = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, '..', inputArg);

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

function mapLink(name, address) {
  const q = encodeURIComponent(`${name || ''} ${address || ''}`.trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

(async () => {
  const decisions = parseCsv(inputFile)
    .filter((row) => row.decision === 'delete_restaurant_candidate')
    .sort((a, b) => Number(a.id) - Number(b.id));
  const ids = decisions.map((row) => Number(row.id));

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const dbRows = ids.length
    ? (await client.query(
      `select r.*, d.name as destination_name, d.country_code
         from restaurants r
         left join destinations d on d.id = r."destinationId"
        where r.id = any($1)
        order by r.id`,
      [ids],
    )).rows
    : [];
  await client.end();

  const byId = new Map(dbRows.map((row) => [Number(row.id), row]));
  const base = path.join(path.dirname(inputFile), 'foreign-fr-delete-candidates');
  const backupFile = `${base}-backup.json`;
  const htmlFile = `${base}.html`;

  fs.writeFileSync(
    backupFile,
    JSON.stringify({ takenAt: new Date().toISOString(), count: dbRows.length, rows: dbRows }, null, 2),
    'utf8',
  );

  const rowsHtml = decisions.map((decision) => {
    const db = byId.get(Number(decision.id)) || {};
    const ours = mapLink(decision.old_name, decision.old_address);
    const google = decision.google_maps_uri || (decision.place_id ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(decision.place_id)}` : '');
    return `<tr>
      <td>${esc(decision.id)}</td>
      <td><b>${esc(decision.old_name)}</b><br><span>${esc(decision.old_address)}</span><br><small>${esc(db.destination_name)} · ${esc(db.country_code)}</small></td>
      <td><b>${esc(decision.google_name)}</b><br><span>${esc(decision.google_address)}</span><br><small>${esc(decision.business_status)}</small></td>
      <td>${esc(decision.triage)}<br><small>${esc(decision.decision_reason || decision.triage_reason)}</small></td>
      <td>${esc(db.verification_status)}</td>
      <td><a href="${ours}" target="_blank">שלנו</a>${google ? ` · <a href="${esc(google)}" target="_blank">פין גוגל</a>` : ''}</td>
    </tr>`;
  }).join('\n');

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>מועמדים למחיקה - צרפת</title>
<style>
body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#202124}
h1{font-size:20px;margin:0 0 8px}.note{background:#fff3cd;border:1px solid #ffe08a;padding:10px;border-radius:6px;margin:12px 0}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}th,td{border:1px solid #ddd;padding:7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0}small{color:#607d8b}.bad{color:#b71c1c;font-weight:bold}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}
</style></head><body>
<h1>מועמדים למחיקה - צרפת (${decisions.length})</h1>
<div class="note"><b>לא בוצעה מחיקה.</b> זה דוח בדיקה בלבד. נוצר גיבוי מלא: <code>${esc(path.basename(backupFile))}</code>. מחיקה בפועל דורשת אישור נוסף מפורש.</div>
<table><thead><tr><th>ID</th><th>המסעדה אצלנו</th><th>מה גוגל מצא</th><th>סיבה</th><th>סטטוס נוכחי</th><th>קישורים</th></tr></thead><tbody>
${rowsHtml}
</tbody></table></body></html>`;
  fs.writeFileSync(htmlFile, html, 'utf8');

  console.log(`delete candidates: ${decisions.length}`);
  console.log(`found in DB: ${dbRows.length}`);
  console.log(`backup: ${backupFile}`);
  console.log(`html: ${htmlFile}`);
})();
