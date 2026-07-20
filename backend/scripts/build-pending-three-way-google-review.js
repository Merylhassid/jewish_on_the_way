/* eslint-disable no-console */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const INPUT = path.join(
  __dirname,
  '..',
  'audit-output',
  'combined-dryrun-1783240537425-resolved.csv',
);

const OUT_DIR = path.join(__dirname, '..', 'audit-output');
const OUTPUTS = {
  same: path.join(OUT_DIR, 'pending-israel-definite-same.html'),
  notSame: path.join(OUT_DIR, 'pending-israel-definite-not-same.html'),
  maybe: path.join(OUT_DIR, 'pending-israel-maybe-review.html'),
};

const NON_RESTAURANT_PRIMARY_TYPES = new Set([
  'bus_stop',
  'transit_station',
  'transit_stop',
  'parking',
  'gas_station',
  'lodging',
  'shopping_mall',
  'school',
  'university',
  'synagogue',
  'place_of_worship',
  'bank',
  'atm',
  'hospital',
  'pharmacy',
  'store',
]);

const BRAND_ALIASES = [
  ['burgerstation', [/בורגר\s*סטיישן/u, /burger\s*station/i]],
  ['burgeranch', [/בורגראנץ/u, /burgeranch/i]],
  ['cafecafe', [/קפה\s*קפה/u, /cafe\s*cafe/i, /café\s*café/i, /coffee\s*coffee/i]],
  ['arcaffe', [/ארקפה/u, /arcaff/i]],
  ['cofix', [/קופיקס/u, /\bcofix\b/i]],
  ['cofizz', [/\bcofizz\b/i, /קופיז/u]],
  ['aroma', [/ארומה/u, /\baroma\b/i]],
  ['roladin', [/רולדין/u, /\broladin\b/i]],
  ['pizzahut', [/פיצה\s*האט/u, /pizza\s*hut/i]],
  ['pizzashemesh', [/פיצה\s*שמש/u, /pizza\s*shemesh/i]],
  ['dominospizza', [/דומינו/u, /domino/i]],
  ['japanika', [/ג['׳]?פניקה/u, /japanika/i]],
  ['burgerim', [/בורגרים/u, /\bburgerim\b/i]],
  ['burgersbar', [/burgers\s*bar/i, /בורגרס\s*בר/u]],
  ['biga', [/\bbiga\b/i, /ביגה/u]],
  ['woktowalk', [/wok\s*to\s*walk/i, /ווק\s*טו\s*ווק/u]],
  ['bfresh', [/b[\s-]*fresh/i, /בי\s*פרש/u]],
  ['falafelbaribua', [/פלאפל\s*בריבוע/u, /falafel\s*baribua/i]],
  ['pizzagolda', [/פיצה\s*גולדה/u, /pizza\s*golda/i]],
  ['pizzarondo', [/פיצה\s*רונדו/u, /pizza\s*rondo/i]],
  ['pizzasmiley', [/פיצה\s*סמיילי/u, /pizza\s*smiley/i]],
  ['nagisa', [/נגיסה/u, /nagisa/i]],
  ['luciana', [/luciana/i, /לוצ['׳]?יאנה/u]],
  ['rebar', [/\brebar\b/i, /רי\s*בר/u]],
  ['river', [/\briver\b/i, /ריבר/u]],
];

const STOPWORDS = new Set([
  'restaurant',
  'resturant',
  'cafe',
  'coffee',
  'pizza',
  'burger',
  'burgers',
  'bar',
  'grill',
  'kosher',
  'branch',
  'mall',
  'center',
  'centre',
  'city',
  'food',
  'מסעדה',
  'קפה',
  'פיצה',
  'בורגר',
  'בורגרים',
  'בר',
  'גריל',
  'כשר',
  'כשרה',
  'קניון',
  'מרכז',
  'סניף',
  'בעמ',
]);

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
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
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function readCsv(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]).map((key) => key.replace(/^\uFEFF/, '').trim());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(header.map((key, index) => [key, values[index] ?? '']));
  });
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeText(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[״"׳'`]/g, '')
    .replace(/\b(israel|ישראל|il)\b/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function meters(value) {
  const n = num(value);
  if (n === null) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1)} ק״מ`;
  return `${Math.round(n)} מ׳`;
}

function searchLink(name, address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${name || ''} ${address || ''}`.trim(),
  )}`;
}

function brandAlias(value) {
  const raw = String(value || '');
  for (const [brand, patterns] of BRAND_ALIASES) {
    if (patterns.some((pattern) => pattern.test(raw))) return brand;
  }
  return '';
}

function nameTokens(value) {
  const alias = brandAlias(value);
  const tokens = normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (/^\d+$/.test(token)) return '';
      return token;
    })
    .filter(Boolean)
    .filter((token) => !STOPWORDS.has(token));
  if (alias) tokens.push(alias);
  return [...new Set(tokens)];
}

function tokenOverlap(a, b) {
  const aTokens = nameTokens(a);
  const bTokens = nameTokens(b);
  if (!aTokens.length || !bTokens.length) return { overlap: 0, ratio: 0 };
  const bSet = new Set(bTokens);
  const overlap = aTokens.filter((token) => bSet.has(token)).length;
  return {
    overlap,
    ratio: overlap / Math.min(aTokens.length, bTokens.length),
  };
}

function houseNumbers(address) {
  const matches = String(address || '').match(/\b\d{1,4}\b/g) || [];
  return [...new Set(matches.filter((value) => value !== '0'))];
}

function sharedHouseNumber(a, b) {
  const aNums = houseNumbers(a);
  const bNums = houseNumbers(b);
  if (!aNums.length || !bNums.length) {
    return { shared: false, bothHaveNumbers: aNums.length > 0 && bNums.length > 0 };
  }
  const bSet = new Set(bNums);
  return {
    shared: aNums.some((value) => bSet.has(value)),
    bothHaveNumbers: true,
  };
}

function hasHebrew(value) {
  return /[א-ת]/.test(String(value || ''));
}

function nameIncludes(a, b) {
  const x = compactText(a);
  const y = compactText(b);
  if (!x || !y) return false;
  return (x.length >= 5 && y.includes(x)) || (y.length >= 5 && x.includes(y));
}

function isNonRestaurantCandidate(row) {
  const primary = normalizeText(row.google_primary_type).replace(/\s+/g, '_');
  if (!primary) return false;
  if (row.food_signal === 'food') return false;
  return NON_RESTAURANT_PRIMARY_TYPES.has(primary);
}

function llmNo(row, min = 0.85) {
  return row.llm_verdict === 'no' && (num(row.llm_conf) ?? 0) >= min;
}

function llmYes(row, min = 0.95) {
  return row.llm_verdict === 'yes' && (num(row.llm_conf) ?? 0) >= min;
}

function analyze(row) {
  const oldBrand = brandAlias(row.old_name);
  const googleBrand = brandAlias(row.google_name);
  const dist = num(row.distance_m);
  const sim = num(row.name_sim) ?? 0;
  const house = sharedHouseNumber(row.old_address, row.google_address);
  const tokens = tokenOverlap(row.old_name, row.google_name);
  const sameKnownBrand = Boolean(oldBrand && googleBrand && oldBrand === googleBrand);
  const knownBrandConflict = Boolean(oldBrand && googleBrand && oldBrand !== googleBrand);
  const nameStrong =
    sameKnownBrand ||
    nameIncludes(row.old_name, row.google_name) ||
    tokens.overlap >= 2 ||
    (tokens.overlap >= 1 && tokens.ratio >= 0.75) ||
    sim >= 0.82;
  const addressStrong = house.shared && (dist === null || dist <= 5000);
  const veryClose = dist !== null && dist <= 80;
  const close = dist !== null && dist <= 500;
  const far = dist !== null && dist > 1500;
  const veryFar = dist !== null && dist > 5000;

  return {
    oldBrand,
    googleBrand,
    sameKnownBrand,
    knownBrandConflict,
    nameStrong,
    addressStrong,
    houseShared: house.shared,
    bothHaveHouseNumbers: house.bothHaveNumbers,
    veryClose,
    close,
    far,
    veryFar,
    dist,
    sim,
    tokenOverlap: tokens.overlap,
    tokenRatio: tokens.ratio,
  };
}

function classify(row) {
  const a = analyze(row);
  const resolved = row.resolved_final || row.final || '';

  if (!row.google_place_id) {
    return { bucket: 'notSame', reason: 'אין מועמד Google' };
  }

  if (isNonRestaurantCandidate(row)) {
    return { bucket: 'notSame', reason: `Google מצא סוג לא מסעדה: ${row.google_primary_type}` };
  }

  if (a.knownBrandConflict) {
    return {
      bucket: 'notSame',
      reason: `מותג שונה ברור: ${a.oldBrand} מול ${a.googleBrand}`,
    };
  }

  if (a.sameKnownBrand && a.bothHaveHouseNumbers && !a.houseShared && llmNo(row, 0.85)) {
    return { bucket: 'notSame', reason: 'אותו מותג אבל כתובת/סניף אחר לפי מספר בית ו-LLM' };
  }

  if (llmNo(row, 0.95) && !a.nameStrong && !a.addressStrong) {
    return { bucket: 'notSame', reason: 'LLM שלל בביטחון גבוה, בלי התאמת שם/כתובת חזקה' };
  }

  if (!a.nameStrong && !a.addressStrong && (a.veryFar || a.far || llmNo(row, 0.85))) {
    return { bucket: 'notSame', reason: 'שם לא תואם ואין כתובת חזקה' };
  }

  if (!a.nameStrong && a.close && llmNo(row, 0.85)) {
    return { bucket: 'notSame', reason: 'קרוב פיזית אבל שם עסק שונה' };
  }

  if (a.sameKnownBrand && a.addressStrong) {
    return { bucket: 'same', reason: 'אותו מותג מוכר + מספר כתובת תואם' };
  }

  if (a.nameStrong && a.addressStrong && (a.dist === null || a.dist <= 5000)) {
    return { bucket: 'same', reason: 'שם תואם + מספר כתובת תואם' };
  }

  if ((resolved === 'verified' || resolved === 'yes') && a.nameStrong && (a.addressStrong || a.close)) {
    return { bucket: 'same', reason: 'כבר סומן verified/yes וגם יש התאמת שם וכתובת/מרחק' };
  }

  if (llmYes(row, 0.95) && a.nameStrong && (a.addressStrong || a.close || a.sameKnownBrand)) {
    return { bucket: 'same', reason: 'LLM אישר בביטחון גבוה + שם/כתובת תומכים' };
  }

  if (a.nameStrong && a.veryClose) {
    return { bucket: 'same', reason: 'שם תואם ומרחק זניח' };
  }

  if (a.sameKnownBrand && !a.addressStrong && a.far) {
    return { bucket: 'maybe', reason: 'אותו מותג, אבל ייתכן סניף אחר' };
  }

  if (a.nameStrong && !a.addressStrong && a.far) {
    return { bucket: 'maybe', reason: 'שם דומה אבל כתובת/מרחק לא מספיקים' };
  }

  if (!a.nameStrong && a.addressStrong) {
    return { bucket: 'maybe', reason: 'כתובת דומה אבל שם העסק לא מספיק דומה' };
  }

  return { bucket: 'maybe', reason: 'דורש בדיקה ידנית' };
}

function countBy(rows, getKey) {
  const counts = new Map();
  for (const row of rows) {
    const key = getKey(row) || 'empty';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

async function pendingIds() {
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
    "(coalesce(address,'') ilike '%Israel%' or coalesce(address,'') ~ '[א-ת]')";
  const rows = (
    await client.query(
      `select id from restaurants where verification_status = 'pending' and ${israelWhere}`,
    )
  ).rows;
  await client.end();
  return new Set(rows.map((r) => String(r.id).trim()));
}

function rowSort(a, b) {
  const aDist = num(a.distance_m) ?? 999999;
  const bDist = num(b.distance_m) ?? 999999;
  const aSim = num(a.name_sim) ?? 0;
  const bSim = num(b.name_sim) ?? 0;
  if (a.classification.bucket === 'same') {
    if (aSim !== bSim) return bSim - aSim;
    return aDist - bDist;
  }
  if (a.classification.bucket === 'notSame') {
    if (aDist !== bDist) return bDist - aDist;
    return aSim - bSim;
  }
  if (aSim !== bSim) return aSim - bSim;
  return bDist - aDist;
}

function renderReport({ title, note, rows, allCounts, outPath }) {
  const chips = [
    ['בטוח אותו דבר', allCounts.same],
    ['בטוח לא אותו דבר', allCounts.notSame],
    ['אולי', allCounts.maybe],
    ['בקובץ הזה', rows.length],
  ];

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#212121}
h1{font-size:20px;margin:0 0 8px}.note{font-size:13px;color:#546e7a;margin:0 0 14px;line-height:1.5}
.sum{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}.sum span{background:#12344d;color:white;border-radius:5px;padding:7px 11px;font-size:13px}.sum b{font-size:16px}
.panels{display:grid;grid-template-columns:repeat(3,minmax(190px,1fr));gap:10px;margin-bottom:14px}
.panel{background:#fff;border:1px solid #d9e2ec;border-radius:8px;padding:10px}.panel h2{font-size:14px;margin:0 0 7px}
.pill{display:flex;justify-content:space-between;border-bottom:1px solid #edf2f7;padding:4px 0;font-size:12px;gap:10px}
table{border-collapse:collapse;width:100%;font-size:12.2px;background:#fff}
th,td{border:1px solid #e0e0e0;padding:5px 7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0;z-index:2}
tr:nth-child(even){background:#f7f9fa}
.b{font-size:11px;color:#00695c;white-space:nowrap}.v{white-space:nowrap;font-variant-numeric:tabular-nums}
.reason{max-width:360px}.addr{max-width:260px}.name{font-weight:bold}.muted{font-size:11px;color:#607d8b}
.same{color:#1b5e20;font-weight:bold}.notSame{color:#b71c1c;font-weight:bold}.maybe{color:#ef6c00;font-weight:bold}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<p class="note">${esc(note)}</p>
<div class="sum">${chips
    .map(([label, value]) => `<span>${esc(label)}: <b>${esc(value)}</b></span>`)
    .join('')}</div>
<div class="panels">
  <div class="panel"><h2>סיבת סיווג</h2>${countBy(rows, (r) => r.classification.reason)
    .slice(0, 12)
    .map(([k, v]) => `<div class="pill"><span>${esc(k)}</span><b>${v}</b></div>`)
    .join('')}</div>
  <div class="panel"><h2>LLM</h2>${countBy(
    rows,
    (r) => `${r.llm_verdict || 'empty'} ${r.llm_conf || ''}`.trim(),
  )
    .slice(0, 12)
    .map(([k, v]) => `<div class="pill"><span>${esc(k)}</span><b>${v}</b></div>`)
    .join('')}</div>
  <div class="panel"><h2>final/source</h2>${countBy(rows, (r) => `${r.final}/${r.source}`)
    .slice(0, 12)
    .map(([k, v]) => `<div class="pill"><span>${esc(k)}</span><b>${v}</b></div>`)
    .join('')}</div>
</div>
<table>
<thead><tr>
<th>#</th><th>ID</th><th>סיווג</th><th>השם שלנו</th><th>כתובת שלנו</th>
<th>Google מצא</th><th>כתובת Google</th><th>sim</th><th>מרחק</th><th>דירוג</th><th>📷</th><th>סוג Google</th><th>נימוק LLM</th><th>קישורים</th>
</tr></thead>
<tbody>
${rows
  .map((r, i) => {
    const a = analyze(r);
    return `<tr>
<td class="v">${i + 1}</td>
<td class="v">${esc(r.id)}</td>
<td class="b"><span class="${r.classification.bucket}">${esc(r.classification.reason)}</span><br>${esc(r.final)} / ${esc(r.resolved_final)}<br>${esc(r.source)}${r.llm_verdict ? `<br>${esc(r.llm_verdict)}/${esc(r.llm_conf)}` : ''}<div class="muted">brand: ${esc(a.oldBrand || '-')} מול ${esc(a.googleBrand || '-')} · house: ${a.houseShared ? 'same' : 'diff/none'}</div></td>
<td class="name">${esc(r.old_name)}</td>
<td class="addr">${esc(r.old_address)}<div class="muted">${esc(r.old_lat)}, ${esc(r.old_lng)}</div></td>
<td class="name">${esc(r.google_name)}</td>
<td class="addr">${esc(r.google_address)}<div class="muted">${esc(r.google_lat)}, ${esc(r.google_lng)}</div></td>
<td class="v">${esc(r.name_sim)}</td>
<td class="v">${esc(meters(r.distance_m))}</td>
<td class="v">${esc(r.google_rating)}${r.rating_count ? ` (${esc(r.rating_count)})` : ''}</td>
<td>${r.has_photo === 'yes' ? '✔' : ''}</td>
<td>${esc(r.google_primary_type)}<div class="muted">${esc(r.google_types)}</div></td>
<td class="reason">${esc(r.llm_reason)}</td>
<td><a target="_blank" href="${esc(searchLink(r.old_name, r.old_address))}">שלנו</a>${r.google_maps_uri ? ` · <a target="_blank" href="${esc(r.google_maps_uri)}">פין גוגל</a>` : ''}</td>
</tr>`;
  })
  .join('')}
</tbody>
</table>
</body>
</html>`;

  fs.writeFileSync(outPath, html, 'utf8');
}

async function main() {
  const ids = await pendingIds();
  const rowsInCsv = readCsv(INPUT).filter((row) => ids.has(String(row.id).trim()));
  const csvIds = new Set(rowsInCsv.map((row) => String(row.id).trim()));
  const missingFromDryRun = [...ids].filter((id) => !csvIds.has(id)).length;

  const classified = rowsInCsv.map((row) => ({
    ...row,
    classification: classify(row),
  }));

  const groups = {
    same: classified
      .filter((row) => row.classification.bucket === 'same')
      .sort(rowSort),
    notSame: classified
      .filter((row) => row.classification.bucket === 'notSame')
      .sort(rowSort),
    maybe: classified
      .filter((row) => row.classification.bucket === 'maybe')
      .sort(rowSort),
  };

  const allCounts = {
    same: groups.same.length,
    notSame: groups.notSame.length,
    maybe: groups.maybe.length,
  };

  renderReport({
    title: 'Pending - בטוח אותה מסעדה',
    note:
      'התאמות חזקות בלבד: אותו מותג/שם וגם כתובת או מרחק שתומכים בזה. זה קובץ מועמד לאישור מהיר, לא כתיבה אוטומטית.',
    rows: groups.same,
    allCounts,
    outPath: OUTPUTS.same,
  });

  renderReport({
    title: 'Pending - בטוח לא אותה מסעדה',
    note:
      'דחיות חזקות: מותג שונה ברור, סוג Google שאינו מסעדה, אין מועמד Google, או שם/כתובת שלא מסתדרים. כאן אמורות להופיע דוגמאות כמו קפה קפה מול Arcaffe או בורגראנץ מול בורגר סטיישן.',
    rows: groups.notSame,
    allCounts,
    outPath: OUTPUTS.notSame,
  });

  renderReport({
    title: 'Pending - אולי, דורש בדיקה',
    note:
      'כל מה שלא מספיק חזק לאישור ולא מספיק חזק לדחייה. אלה השורות שבאמת שווה לבדוק ידנית.',
    rows: groups.maybe,
    allCounts,
    outPath: OUTPUTS.maybe,
  });

  for (const [key, file] of Object.entries(OUTPUTS)) {
    console.log(`${key}: ${file}`);
  }
  console.log({
    pendingInDb: ids.size,
    rowsInDryRun: rowsInCsv.length,
    missingFromDryRun,
    ...allCounts,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
