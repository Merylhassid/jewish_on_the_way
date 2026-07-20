'use strict';

/*
 * Builds a read-only report of child destinations/cities and their current
 * destination-image behavior. No API calls, no DB writes.
 *
 * Usage:
 *   node scripts/build-city-image-plan.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..', '..');
const THEME = path.join(ROOT, 'mobile', 'constants', 'theme.ts');
const OUT_CSV = path.join(__dirname, '..', 'audit-output', 'city-image-plan.csv');
const OUT_HTML = path.join(__dirname, '..', 'audit-output', 'city-image-plan.html');

function extractObjectKeys(source, objectName) {
  const start = source.indexOf(`const ${objectName}`);
  if (start < 0) return new Set();
  const open = source.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (; end < source.length; end += 1) {
    const ch = source[end];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const body = source.slice(open + 1, end);
  const keys = new Set();
  const re = /(?:^|\n)\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_ -]+))\s*:/g;
  let m;
  while ((m = re.exec(body))) {
    keys.add(String(m[1] || m[2] || m[3] || '').trim().toLowerCase());
  }
  return keys;
}

function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

(async () => {
  const theme = fs.readFileSync(THEME, 'utf8');
  const localCountries = extractObjectKeys(theme, 'LOCAL_COUNTRY_IMAGES');
  const landmarks = extractObjectKeys(theme, 'LANDMARK');

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  const { rows } = await client.query(`
    select
      d.id,
      d.name,
      d.name_he,
      d.city,
      d.country,
      d.country_code,
      d.parent_id,
      p.name as parent_name,
      count(r.id)::int as restaurants
    from destinations d
    left join destinations p on p.id = d.parent_id
    left join restaurants r on r."destinationId" = d.id
    where d.parent_id is not null
    group by d.id, p.id
    order by coalesce(d.country, p.country), d.name
  `);
  await client.end();

  const report = rows.map((row) => {
    const cityKey = String(row.city || row.name || '').trim().toLowerCase();
    const countryCode = String(row.country_code || '').trim().toUpperCase();
    const hasLocalCountryImage = localCountries.has(countryCode.toLowerCase());
    const hasLandmark = landmarks.has(cityKey);
    const currentSource = hasLocalCountryImage
      ? 'country-local-image'
      : hasLandmark
        ? 'city-landmark-url'
        : 'country-fallback-or-picsum';
    const recommendedAction = hasLandmark
      ? 'change-priority-to-city-first'
      : 'add-city-image';
    return {
      id: row.id,
      name: row.name,
      name_he: row.name_he || '',
      city: row.city || row.name,
      country: row.country,
      country_code: countryCode,
      parent_id: row.parent_id,
      parent_name: row.parent_name,
      restaurants: row.restaurants,
      has_local_country_image: hasLocalCountryImage ? 'yes' : 'no',
      has_city_landmark_in_code: hasLandmark ? 'yes' : 'no',
      current_source: currentSource,
      recommended_action: recommendedAction,
    };
  });

  const header = Object.keys(report[0] || {});
  fs.writeFileSync(
    OUT_CSV,
    '\ufeff' + [header.join(','), ...report.map((row) => header.map((h) => csvEsc(row[h])).join(','))].join('\n') + '\n',
    'utf8',
  );

  const byCountry = new Map();
  for (const row of report) {
    const key = `${row.country} (${row.country_code})`;
    byCountry.set(key, (byCountry.get(key) || 0) + 1);
  }
  const withLandmark = report.filter((row) => row.has_city_landmark_in_code === 'yes').length;
  const blockedByCountry = report.filter((row) => row.has_city_landmark_in_code === 'yes' && row.current_source === 'country-local-image').length;

  const rowsHtml = report.map((row) => `
    <tr>
      <td>${escHtml(row.id)}</td>
      <td>${escHtml(row.name)}</td>
      <td>${escHtml(row.name_he)}</td>
      <td>${escHtml(row.country)}</td>
      <td>${escHtml(row.country_code)}</td>
      <td>${escHtml(row.restaurants)}</td>
      <td>${escHtml(row.has_city_landmark_in_code)}</td>
      <td>${escHtml(row.current_source)}</td>
      <td>${escHtml(row.recommended_action)}</td>
    </tr>`).join('');

  fs.writeFileSync(OUT_HTML, `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>City image plan</title>
  <style>
    body{font-family:Arial,sans-serif;margin:18px;background:#f7f8fb;color:#172033}
    h1{font-size:22px;margin:0 0 10px}
    .summary{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 18px}
    .pill{background:#0b1736;color:#fff;border-radius:6px;padding:7px 11px;font-size:13px}
    table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}
    th,td{border:1px solid #dce2ea;padding:7px 8px;text-align:right;vertical-align:top}
    th{background:#edf1f7;position:sticky;top:0}
    tr:nth-child(even){background:#fafbfd}
    .note{font-size:13px;line-height:1.45;margin:10px 0 14px}
    code{background:#eef1f6;padding:2px 5px;border-radius:4px}
  </style>
</head>
<body>
  <h1>תוכנית תמונות לערים / תתי-יעדים</h1>
  <div class="summary">
    <span class="pill">סה״כ ערים: ${report.length}</span>
    <span class="pill">כבר יש LANDMARK בקוד: ${withLandmark}</span>
    <span class="pill">LANDMARK חסום בגלל תמונת מדינה: ${blockedByCountry}</span>
    <span class="pill">צריך להוסיף תמונה/URL עיר: ${report.length - withLandmark}</span>
  </div>
  <p class="note">
    כרגע <code>getDestinationImageUrl</code> מחזירה קודם תמונת מדינה מקומית, ורק אחר כך בודקת תמונת עיר.
    לכן במדינות כמו ישראל/צרפת/ארה״ב, כל הערים מקבלות אותה תמונת מדינה גם אם כבר קיימת תמונת עיר ב-LANDMARK.
  </p>
  <table>
    <thead><tr>
      <th>ID</th><th>עיר</th><th>עברית</th><th>מדינה</th><th>קוד</th><th>מסעדות</th>
      <th>יש LANDMARK</th><th>מקור תמונה כיום</th><th>פעולה מומלצת</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`, 'utf8');

  console.log({ rows: report.length, withLandmark, blockedByCountry, outCsv: OUT_CSV, outHtml: OUT_HTML });
  console.log('countries:', Array.from(byCountry.entries()).map(([country, n]) => `${country}: ${n}`).join(' | '));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
