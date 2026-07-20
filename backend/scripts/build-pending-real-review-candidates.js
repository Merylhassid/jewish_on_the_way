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
const OUT = path.join(
  __dirname,
  '..',
  'audit-output',
  'pending-israel-real-review-candidates.html',
);

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

function searchLink(name, address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${name || ''} ${address || ''}`.trim(),
  )}`;
}

function meters(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1)} ק״מ`;
  return `${Math.round(n)} מ׳`;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[״"׳']/g, '')
    .replace(/\b(israel|ישראל)\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function includesMeaningfully(a, b) {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

function isObviousReject(row) {
  const resolved = row.resolved_final || row.final || '';
  const llmConf = num(row.llm_conf) ?? 0;
  if (resolved === 'no' || resolved === 'no_match') return true;
  if (row.final === 'no_match') return true;
  if (row.source === 'nonfood-reject' || row.source === 'no-candidate') return true;
  if (row.llm_verdict === 'no' && llmConf >= 0.85) return true;
  if (!row.google_place_id) return true;
  return false;
}

function isObviousMatch(row) {
  const resolved = row.resolved_final || row.final || '';
  const sim = num(row.name_sim) ?? 0;
  const dist = num(row.distance_m);
  const llmConf = num(row.llm_conf) ?? 0;

  if (resolved === 'verified' || resolved === 'yes') return true;
  if (row.final === 'verified') return true;
  if (row.llm_verdict === 'yes' && llmConf >= 0.95) return true;
  if (sim >= 0.9 && dist !== null && dist <= 500) return true;
  if (includesMeaningfully(row.old_name, row.google_name) && dist !== null && dist <= 800) {
    return true;
  }
  if (
    includesMeaningfully(row.old_name, row.google_name) &&
    includesMeaningfully(row.old_address, row.google_address)
  ) {
    return true;
  }
  return false;
}

function reviewReason(row) {
  const sim = num(row.name_sim);
  const dist = num(row.distance_m);
  if (!row.google_place_id) return 'אין מועמד Google';
  if (row.final === 'flagged' || row.resolved_final === 'flagged') return 'מסומן flagged';
  if (row.resolved_final === 'uncertain' || row.final === 'uncertain') return 'uncertain';
  if (sim !== null && sim < 0.45) return 'שם לא מספיק דומה';
  if (dist !== null && dist > 1500) return 'מרחק גבוה';
  return 'דורש בדיקה';
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

async function main() {
  const ids = await pendingIds();
  const allPending = readCsv(INPUT)
    .filter((row) => ids.has(String(row.id).trim()))
    .filter((row) => row.google_place_id);

  const obviousMatches = allPending.filter(isObviousMatch);
  const obviousRejects = allPending.filter((row) => !isObviousMatch(row) && isObviousReject(row));
  const reviewRows = allPending
    .filter((row) => !isObviousMatch(row) && !isObviousReject(row))
    .sort((a, b) => {
      const aDist = num(a.distance_m) ?? 999999;
      const bDist = num(b.distance_m) ?? 999999;
      const aSim = num(a.name_sim) ?? 0;
      const bSim = num(b.name_sim) ?? 0;
      const aRisk = (a.final === 'flagged' ? 0 : 1) + (a.resolved_final === 'uncertain' ? 0 : 1);
      const bRisk = (b.final === 'flagged' ? 0 : 1) + (b.resolved_final === 'uncertain' ? 0 : 1);
      if (aRisk !== bRisk) return aRisk - bRisk;
      if (aSim !== bSim) return aSim - bSim;
      return bDist - aDist;
    });

  const chips = [
    ['Pending עם מועמד Google', allPending.length],
    ['הורדו: התאמות ברורות', obviousMatches.length],
    ['הורדו: לא אותה מסעדה ברור', obviousRejects.length],
    ['נשארו לבדיקה אמיתית', reviewRows.length],
  ];

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>Pending Real Review Candidates</title>
<style>
body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#212121}
h1{font-size:20px;margin:0 0 8px}.note{font-size:13px;color:#546e7a;margin:0 0 14px}
.sum{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}.sum span{background:#12344d;color:white;border-radius:5px;padding:7px 11px;font-size:13px}.sum b{font-size:16px}
.panels{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:10px;margin-bottom:14px}
.panel{background:#fff;border:1px solid #d9e2ec;border-radius:8px;padding:10px}.panel h2{font-size:14px;margin:0 0 7px}
.pill{display:flex;justify-content:space-between;border-bottom:1px solid #edf2f7;padding:4px 0;font-size:12px}
table{border-collapse:collapse;width:100%;font-size:12.2px;background:#fff}
th,td{border:1px solid #e0e0e0;padding:5px 7px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0;z-index:2}
tr:nth-child(even){background:#f7f9fa}
.b{font-size:11px;color:#00695c;white-space:nowrap}.v{white-space:nowrap;font-variant-numeric:tabular-nums}
.reason{max-width:360px}.addr{max-width:260px}.name{font-weight:bold}.muted{font-size:11px;color:#607d8b}
.risk{color:#b45309;font-weight:bold}.ok{color:#1b5e20;font-weight:bold}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}
</style>
</head>
<body>
<h1>Pending - רק מועמדים שבאמת צריך לבדוק</h1>
<p class="note">הורדתי מהדוח התאמות ברורות וגם נפילות ברורות. נשאר האמצע: מועמדי Google שיש סיכוי שהם נכונים אבל צריך עין אנושית.</p>
<div class="sum">${chips
    .map(([label, value]) => `<span>${esc(label)}: <b>${esc(value)}</b></span>`)
    .join('')}</div>
<div class="panels">
  <div class="panel"><h2>סיבת בדיקה</h2>${countBy(reviewRows, reviewReason)
    .map(([k, v]) => `<div class="pill"><span>${esc(k)}</span><b>${v}</b></div>`)
    .join('')}</div>
  <div class="panel"><h2>final</h2>${countBy(reviewRows, (r) => r.final)
    .map(([k, v]) => `<div class="pill"><span>${esc(k)}</span><b>${v}</b></div>`)
    .join('')}</div>
  <div class="panel"><h2>source</h2>${countBy(reviewRows, (r) => r.source)
    .map(([k, v]) => `<div class="pill"><span>${esc(k)}</span><b>${v}</b></div>`)
    .join('')}</div>
</div>
<table>
<thead><tr>
<th>#</th><th>ID</th><th>למה לבדוק</th><th>סטטוס</th><th>השם שלנו</th><th>כתובת שלנו</th>
<th>Google מצא</th><th>כתובת Google</th><th>sim</th><th>מרחק</th><th>דירוג</th><th>📷</th><th>סוג Google</th><th>נימוק LLM</th><th>קישורים</th>
</tr></thead>
<tbody>
${reviewRows
  .map(
    (r, i) => `<tr>
<td class="v">${i + 1}</td>
<td class="v">${esc(r.id)}</td>
<td class="risk">${esc(reviewReason(r))}</td>
<td class="b">${esc(r.final)}<br>${esc(r.resolved_final)}<br>${esc(r.source)}${r.llm_verdict ? `<br>${esc(r.llm_verdict)}/${esc(r.llm_conf)}` : ''}</td>
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
</tr>`,
  )
  .join('')}
</tbody>
</table>
</body>
</html>`;

  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log({
    allPendingWithGoogleCandidate: allPending.length,
    obviousMatches: obviousMatches.length,
    obviousRejects: obviousRejects.length,
    reviewRows: reviewRows.length,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
