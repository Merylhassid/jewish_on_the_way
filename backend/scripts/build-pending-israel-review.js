/* eslint-disable no-console */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const OUT = path.join(
  __dirname,
  '..',
  'audit-output',
  'pending-israel-restaurants-review.html',
);

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mapsSearch(name, address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${name || ''} ${address || ''}`.trim(),
  )}`;
}

function pct(part, total) {
  if (!total) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function bucket(row) {
  const name = `${row.name || ''} ${row.category || ''} ${(row.tags || []).join(' ')}`.toLowerCase();
  if (/pizza|פיצה/.test(name)) return 'פיצה';
  if (/sushi|סושי|japan|גפניקה|ג'פניקה/.test(name)) return 'סושי / אסייתי';
  if (/bakery|מאפ|קונדיט|bake|לחם|עוג/.test(name)) return 'מאפייה / קונדיטוריה';
  if (/burger|המבורגר|בורגר/.test(name)) return 'המבורגר';
  if (/falafel|פלאפל|shawarma|שווארמה|חומוס|hummus|סביח/.test(name)) return 'רחוב / מזרחי';
  if (/cafe|coffee|קפה|ארומה|קופיקס/.test(name)) return 'קפה';
  return 'אחר / לא ברור';
}

function countBy(rows, getKey) {
  const counts = new Map();
  for (const row of rows) {
    const key = getKey(row) || 'לא ידוע';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  const israelWhere =
    "(coalesce(r.address,'') ilike '%Israel%' or coalesce(r.address,'') ~ '[א-ת]')";

  const [{ count: totalIsrael }] = (
    await client.query(`select count(*)::int from restaurants r where ${israelWhere}`)
  ).rows;
  const [{ count: pendingIsrael }] = (
    await client.query(
      `select count(*)::int from restaurants r where ${israelWhere} and r.verification_status = 'pending'`,
    )
  ).rows;
  const [{ count: verifiedIsrael }] = (
    await client.query(
      `select count(*)::int from restaurants r where ${israelWhere} and r.verification_status = 'verified'`,
    )
  ).rows;

  const rows = (
    await client.query(
      `
      select
        r.id,
        r.name,
        r.address,
        r.city,
        r.country,
        r.phone,
        r.category,
        r.restaurant_type,
        r.restaurant_type_confidence,
        r.kashrut_level,
        r.rating,
        r.tags,
        r.lat,
        r.lng,
        r."destinationId",
        d.name as destination_name
      from restaurants r
      left join destinations d on d.id = r."destinationId"
      where ${israelWhere}
        and r.verification_status = 'pending'
      order by
        coalesce(r.city, d.name, ''),
        r.name,
        r.id
      `,
    )
  ).rows;

  await client.end();

  const byCity = countBy(rows, (r) => r.city || r.destination_name).slice(0, 25);
  const byCategory = countBy(rows, (r) => r.category).slice(0, 25);
  const byType = countBy(rows, (r) => r.restaurant_type).slice(0, 10);
  const byBucket = countBy(rows, bucket);

  const cards = [
    ['סה"כ מסעדות ישראל', totalIsrael],
    ['Pending לבדיקה', pendingIsrael],
    ['Verified כבר מועשר', verifiedIsrael],
    ['אחוז verified', pct(verifiedIsrael, totalIsrael)],
  ];

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>Pending Israel Restaurants Review</title>
  <style>
    body{font-family:Arial,sans-serif;margin:18px;background:#f7f8fa;color:#1f2933}
    h1{font-size:22px;margin:0 0 8px}
    .sub{font-size:13px;color:#52606d;margin-bottom:16px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:10px;margin:12px 0 18px}
    .card{background:#fff;border:1px solid #d9e2ec;border-radius:8px;padding:12px}
    .card b{display:block;font-size:22px;color:#102a43;margin-top:5px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
    .panel{background:#fff;border:1px solid #d9e2ec;border-radius:8px;padding:10px}
    .panel h2{font-size:14px;margin:0 0 8px}
    .pill{display:flex;justify-content:space-between;gap:8px;font-size:12px;border-bottom:1px solid #eef2f7;padding:4px 0}
    table{border-collapse:collapse;width:100%;font-size:12px;background:#fff}
    th,td{border:1px solid #d9e2ec;padding:6px 7px;text-align:right;vertical-align:top}
    th{position:sticky;top:0;background:#e6edf5;z-index:1}
    tr:nth-child(even){background:#fbfcfd}
    .mono{font-variant-numeric:tabular-nums;white-space:nowrap}
    .muted{color:#697586;font-size:11px}
    .tags{max-width:220px}
    a{color:#0b63ce;text-decoration:none}
    a:hover{text-decoration:underline}
    .addr{max-width:320px}
    .name{font-weight:bold}
  </style>
</head>
<body>
  <h1>מסעדות ישראל בסטטוס Pending לבדיקה</h1>
  <div class="sub">דוח קריאה בלבד. לא נכתב כלום ל-DB. לכל שורה יש קישור חיפוש ב-Google Maps כדי לבדוק התאמה ידנית.</div>

  <div class="cards">
    ${cards.map(([label, value]) => `<div class="card">${esc(label)}<b>${esc(value)}</b></div>`).join('')}
  </div>

  <div class="grid">
    <div class="panel"><h2>דליים מוצעים</h2>${byBucket.map(([k, v]) => `<div class="pill"><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>
    <div class="panel"><h2>ערים / יעדים מובילים</h2>${byCity.map(([k, v]) => `<div class="pill"><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>
    <div class="panel"><h2>קטגוריות קיימות</h2>${byCategory.map(([k, v]) => `<div class="pill"><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>
    <div class="panel"><h2>בשרי / חלבי / פרווה</h2>${byType.map(([k, v]) => `<div class="pill"><span>${esc(k)}</span><b>${v}</b></div>`).join('')}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>ID</th><th>שם</th><th>כתובת</th><th>עיר/יעד</th><th>טלפון</th>
        <th>קטגוריה</th><th>סוג</th><th>כשרות</th><th>דירוג ישן</th><th>Tags</th><th>דליים</th><th>קישורים</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (r, i) => `<tr>
            <td class="mono">${i + 1}</td>
            <td class="mono">${esc(r.id)}</td>
            <td class="name">${esc(r.name)}</td>
            <td class="addr">${esc(r.address)}${r.lat && r.lng ? `<div class="muted">${esc(r.lat)}, ${esc(r.lng)}</div>` : ''}</td>
            <td>${esc(r.city || r.destination_name || '')}<div class="muted">destinationId: ${esc(r.destinationId)}</div></td>
            <td class="mono">${esc(r.phone)}</td>
            <td>${esc(r.category)}</td>
            <td>${esc(r.restaurant_type)}${r.restaurant_type_confidence ? `<div class="muted">conf ${esc(r.restaurant_type_confidence)}</div>` : ''}</td>
            <td>${esc(r.kashrut_level)}</td>
            <td class="mono">${esc(r.rating)}</td>
            <td class="tags">${esc((r.tags || []).join(', '))}</td>
            <td>${esc(bucket(r))}</td>
            <td><a target="_blank" href="${esc(mapsSearch(r.name, r.address))}">חיפוש Google Maps</a></td>
          </tr>`,
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log(`Rows: ${rows.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
