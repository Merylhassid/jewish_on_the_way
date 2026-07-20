'use strict';

/*
 * Builds an HTML report for pending-triage right rows that cannot be applied
 * directly because of duplicate/conflicting google_place_id.
 *
 * NO DB writes.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const INPUT = path.join(__dirname, '..', 'audit-output', 'pending-triage-right-920-resolved.csv');
const OUT = path.join(__dirname, '..', 'audit-output', 'pending-triage-right-920-conflicts.html');

function parseCsv(filename) {
  const text = fs.readFileSync(filename, 'utf8').replace(/^\ufeff/, '');
  const rows = [];
  let fields = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else if (ch === '\n') {
      fields.push(cur);
      rows.push(fields);
      fields = [];
      cur = '';
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  if (cur || fields.length) {
    fields.push(cur);
    rows.push(fields);
  }
  const header = rows[0] || [];
  return rows
    .slice(1)
    .filter((row) => row.length >= header.length)
    .map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? ''])));
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function meters(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1)} ק״מ`;
  return `${Math.round(n)} מ׳`;
}

function searchLink(name, address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${name || ''} ${address || ''}`.trim(),
  )}`;
}

(async () => {
  const rows = parseCsv(INPUT).filter((row) => row.google_place_id);
  const pidCounts = new Map();
  rows.forEach((row) => pidCounts.set(row.google_place_id, (pidCounts.get(row.google_place_id) || 0) + 1));

  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await db.connect();
  const pids = [...pidCounts.keys()];
  const owners = pids.length
    ? (
        await db.query(
          `select id, name, address, verification_status, google_place_id
             from restaurants
            where google_place_id = ANY($1)
            order by id`,
          [pids],
        )
      ).rows
    : [];
  await db.end();

  const ownerByPid = new Map(owners.map((row) => [row.google_place_id, row]));
  const conflictRows = rows
    .map((row) => {
      const owner = ownerByPid.get(row.google_place_id);
      let conflict = '';
      if (pidCounts.get(row.google_place_id) > 1) conflict = 'כפילות בתוך ה־920';
      if (owner && Number(owner.id) !== Number(row.id)) {
        conflict = conflict ? `${conflict} + כבר שייך למסעדה אחרת` : 'כבר שייך למסעדה אחרת';
      }
      return { ...row, conflict, owner };
    })
    .filter((row) => row.conflict)
    .sort((a, b) => String(a.conflict).localeCompare(String(b.conflict)) || Number(a.id) - Number(b.id));

  const internalDup = conflictRows.filter((row) => row.conflict.includes('כפילות בתוך')).length;
  const ownedByOther = conflictRows.filter((row) => row.conflict.includes('כבר שייך')).length;

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>Pending Right 920 Conflicts</title>
<style>
body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#212121}
h1{font-size:20px;margin:0 0 8px}.note{font-size:13px;color:#546e7a;margin:0 0 14px}
.sum{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}.sum span{background:#12344d;color:white;border-radius:5px;padding:7px 11px;font-size:13px}.sum b{font-size:16px}
table{border-collapse:collapse;width:100%;font-size:12.2px;background:#fff}
th,td{border:1px solid #e0e0e0;padding:5px 7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0;z-index:2}
tr:nth-child(even){background:#f7f9fa}
.name{font-weight:bold}.addr{max-width:260px}.muted{font-size:11px;color:#607d8b}.bad{color:#b71c1c;font-weight:bold}.v{white-space:nowrap;font-variant-numeric:tabular-nums}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}
</style>
</head>
<body>
<h1>920 כנראה נכונים - חסימות לפני apply</h1>
<p class="note">אלה השורות מתוך ה־920 שלא יכולות להיכנס ב־apply רגיל בגלל UNIQUE על google_place_id או כפילות פנימית. לא נכתבה שום שורה ל־DB.</p>
<div class="sum">
  <span>סה״כ חסומים: <b>${conflictRows.length}</b></span>
  <span>כפילות בתוך ה־920: <b>${internalDup}</b></span>
  <span>כבר שייך למסעדה אחרת: <b>${ownedByOther}</b></span>
</div>
<table>
<thead><tr>
<th>#</th><th>ID</th><th>סיבת חסימה</th><th>השם שלנו</th><th>כתובת שלנו</th><th>Google מצא</th><th>כתובת Google</th><th>מרחק</th><th>בעלים קיימים ב־DB</th><th>קישורים</th>
</tr></thead>
<tbody>
${conflictRows
  .map(
    (row, i) => `<tr>
<td class="v">${i + 1}</td>
<td class="v">${esc(row.id)}</td>
<td class="bad">${esc(row.conflict)}</td>
<td class="name">${esc(row.old_name)}</td>
<td class="addr">${esc(row.old_address)}</td>
<td class="name">${esc(row.google_name)}</td>
<td class="addr">${esc(row.google_address)}</td>
<td class="v">${esc(meters(row.distance_m))}</td>
<td>${row.owner ? `<b>#${esc(row.owner.id)}</b> ${esc(row.owner.name)}<div class="muted">${esc(row.owner.address)} · ${esc(row.owner.verification_status)}</div>` : '<span class="muted">אין בעלים קיים</span>'}</td>
<td><a target="_blank" href="${esc(searchLink(row.old_name, row.old_address))}">שלנו</a>${row.google_maps_uri ? ` · <a target="_blank" href="${esc(row.google_maps_uri)}">פין גוגל</a>` : ''}</td>
</tr>`,
  )
  .join('')}
</tbody>
</table>
</body>
</html>`;

  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log({ conflicts: conflictRows.length, internalDup, ownedByOther });
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
