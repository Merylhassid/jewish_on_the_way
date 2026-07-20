'use strict';

/*
 * Builds a review gallery for child destinations that already have a city
 * image entry in mobile/constants/theme.ts. No API calls, no DB writes.
 *
 * Usage:
 *   node scripts/build-existing-city-images-gallery.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const THEME = path.join(ROOT, 'mobile', 'constants', 'theme.ts');
const PLAN_CSV = path.join(__dirname, '..', 'audit-output', 'city-image-plan.csv');
const OUT_HTML = path.join(__dirname, '..', 'audit-output', 'existing-city-images-gallery.html');
const OUT_CSV = path.join(__dirname, '..', 'audit-output', 'existing-city-images-gallery.csv');

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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
      } else if (ch === '"') {
        quoted = !quoted;
      } else if (ch === ',' && !quoted) {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    return Object.fromEntries(header.map((h, i) => [h, cols[i] ?? '']));
  });
}

function expandImageCall(kind, value) {
  if (kind === 'U') {
    return `https://images.unsplash.com/photo-${value}?auto=format&fit=crop&w=900&q=80`;
  }
  if (kind === 'P') {
    return `https://picsum.photos/seed/${encodeURIComponent(value)}/900/500`;
  }
  return value;
}

function extractLandmarkMap(source) {
  const start = source.indexOf('const LANDMARK');
  if (start < 0) return new Map();
  const open = source.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (; end < source.length; end += 1) {
    if (source[end] === '{') depth += 1;
    if (source[end] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const body = source.slice(open + 1, end);
  const map = new Map();
  const re = /(?:^|\n)\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_ -]+))\s*:\s*(U|P)\('([^']+)'\)/g;
  let m;
  while ((m = re.exec(body))) {
    const key = String(m[1] || m[2] || m[3] || '').trim().toLowerCase();
    const kind = m[4];
    const value = m[5];
    map.set(key, {
      key,
      imageUrl: expandImageCall(kind, value),
      sourceCall: `${kind}('${value}')`,
    });
  }
  return map;
}

const theme = fs.readFileSync(THEME, 'utf8');
const landmarks = extractLandmarkMap(theme);
const rows = parseCsv(fs.readFileSync(PLAN_CSV, 'utf8'));

const galleryRows = rows
  .filter((row) => row.has_city_landmark_in_code === 'yes')
  .map((row) => {
    const key = String(row.city || row.name || '').trim().toLowerCase();
    const landmark = landmarks.get(key);
    return {
      id: row.id,
      city: row.city || row.name,
      name_he: row.name_he,
      country: row.country,
      country_code: row.country_code,
      restaurants: row.restaurants,
      current_source: row.current_source,
      key,
      image_url: landmark?.imageUrl || '',
      source_call: landmark?.sourceCall || '',
    };
  })
  .sort((a, b) => Number(b.restaurants || 0) - Number(a.restaurants || 0) || a.city.localeCompare(b.city));

const header = Object.keys(galleryRows[0] || {});
fs.writeFileSync(
  OUT_CSV,
  '\ufeff' + [header.join(','), ...galleryRows.map((row) => header.map((h) => csvEsc(row[h])).join(','))].join('\n') + '\n',
  'utf8',
);

const cards = galleryRows.map((row) => `
  <article class="card">
    <img src="${escHtml(row.image_url)}" alt="${escHtml(row.city)}" loading="lazy" />
    <div class="body">
      <h2>${escHtml(row.name_he || row.city)}</h2>
      <div class="meta">${escHtml(row.city)} · ${escHtml(row.country)} (${escHtml(row.country_code)})</div>
      <div class="meta">מסעדות: ${escHtml(row.restaurants)} · מקור נוכחי: ${escHtml(row.current_source)}</div>
      <a href="${escHtml(row.image_url)}" target="_blank" rel="noreferrer">פתח תמונה</a>
    </div>
  </article>
`).join('');

fs.writeFileSync(OUT_HTML, `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>Existing city images gallery</title>
  <style>
    body{font-family:Arial,sans-serif;margin:18px;background:#f7f8fb;color:#172033}
    h1{font-size:22px;margin:0 0 8px}
    .note{font-size:13px;line-height:1.45;margin:0 0 18px;color:#526070}
    .summary{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 18px}
    .pill{background:#0b1736;color:#fff;border-radius:6px;padding:7px 11px;font-size:13px}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
    .card{background:#fff;border:1px solid #dce2ea;border-radius:10px;overflow:hidden;box-shadow:0 4px 12px rgba(11,23,54,.06)}
    img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#d9dee8}
    .body{padding:11px 12px 13px}
    h2{font-size:16px;margin:0 0 5px}
    .meta{font-size:12.5px;color:#526070;margin:3px 0}
    a{display:inline-block;margin-top:8px;color:#1565c0;text-decoration:none;font-size:13px}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <h1>גלריית ערים שכבר יש להן תמונה בקוד</h1>
  <p class="note">זה מציג את תמונות העיר שקיימות ב-LANDMARK. בחלק מהערים הן עדיין לא מופיעות באפליקציה כי תמונת המדינה מקבלת עדיפות.</p>
  <div class="summary">
    <span class="pill">ערים עם תמונת עיר קיימת: ${galleryRows.length}</span>
    <span class="pill">חסומות כיום ע״י תמונת מדינה: ${galleryRows.filter((row) => row.current_source === 'country-local-image').length}</span>
  </div>
  <section class="grid">${cards}</section>
</body>
</html>`, 'utf8');

console.log({ rows: galleryRows.length, outHtml: OUT_HTML, outCsv: OUT_CSV });
