'use strict';

/*
 * Shabbat-hours kashrut audit. READ-ONLY — no DB writes, no Google/API calls.
 *
 * Uses google_opening_hours already stored on verified restaurants (collected
 * during the Google enrichment pass) to flag restaurants that are open during
 * times a kosher-observant restaurant cannot be open:
 *   - Friday: any hours extending past 21:00 (conservative fixed cutoff —
 *     Shabbat can start as early as ~16:00 in winter, so 21:00 is a safe
 *     "definitely already Shabbat" floor, not an attempt at exact zmanim).
 *   - Saturday: any hours overlapping the 08:00-16:00 window, or "Open 24 hours".
 *     (Motzash reopening, e.g. "9:30 PM - 12:00 AM", is fine and not flagged.)
 *
 * Hotels/lodging are downgraded to a separate "needs judgment" section since
 * they may legitimately serve pre-paid Shabbat meals without being "open".
 *
 * Also surfaces the existing is_kosher=false rows (already known in our own
 * data, just never filtered from display) as a top info section.
 *
 * Usage: node scripts/audit-shabbat-hours.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const OUT_DIR = path.join(__dirname, '..', 'audit-output');
const FRIDAY_CUTOFF_MIN = 21 * 60; // 21:00
const SAT_WINDOW_START = 8 * 60; // 08:00
const SAT_WINDOW_END = 16 * 60; // 16:00

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseTimeToMinutes(str) {
  const m = str.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  const min = Number(m[2]);
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + min;
}

function parseRange(str) {
  const s = str.trim();
  const parts = s.split(/[–-]/).map((x) => x.trim());
  if (parts.length !== 2) return null;
  let start = parseTimeToMinutes(parts[0]);
  let end = parseTimeToMinutes(parts[1]);
  if (start == null || end == null) return null;
  if (end < start) end += 24 * 60; // wraps past midnight
  return { start, end };
}

function parseDayEntry(text) {
  const t = text.trim();
  if (/^closed$/i.test(t)) return { ranges: [], allDay: false };
  if (/open 24 hours/i.test(t)) return { ranges: [{ start: 0, end: 24 * 60 }], allDay: true };
  const ranges = t.split(',').map((chunk) => parseRange(chunk)).filter(Boolean);
  return { ranges, allDay: false };
}

// Returns { Sunday: {ranges,allDay}, ... } or null if unparseable
function parseHours(fullString) {
  if (!fullString) return null;
  const out = {};
  for (const part of fullString.split('|')) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const day = part.slice(0, idx).trim();
    const rest = part.slice(idx + 1).trim();
    if (!DAY_NAMES.includes(day)) continue;
    out[day] = parseDayEntry(rest);
  }
  return Object.keys(out).length ? out : null;
}

function fridayViolation(dayEntry) {
  if (!dayEntry) return null;
  if (dayEntry.allDay) return 'פתוח 24 שעות (כולל כניסת שבת)';
  const bad = dayEntry.ranges.find((r) => r.end > FRIDAY_CUTOFF_MIN);
  if (!bad) return null;
  const fmt = (min) => {
    const h24 = Math.floor(min / 60) % 24;
    const m = min % 60;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  return `פתוח עד ${fmt(bad.end)} בערב שישי (אחרי 21:00)`;
}

function saturdayViolation(dayEntry) {
  if (!dayEntry) return null;
  if (dayEntry.allDay) return 'פתוח 24 שעות בשבת';
  const bad = dayEntry.ranges.find((r) => r.start < SAT_WINDOW_END && r.end > SAT_WINDOW_START);
  if (!bad) return null;
  const fmt = (min) => {
    const h24 = Math.floor(min / 60) % 24;
    const m = min % 60;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  return `פתוח ${fmt(bad.start)}–${fmt(Math.min(bad.end, 24 * 60))} בשבת (חופף ל-08:00–16:00)`;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mapsSearch(name, address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address || ''}`)}`;
}

(async () => {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await db.connect();

  // 1. Already-known non-kosher rows (informational — no DB write, just surfacing)
  const knownBad = (await db.query(`
    SELECT r.id, r.name, r.address, r.verification_status, d.name AS dest, d.country
    FROM restaurants r LEFT JOIN destinations d ON d.id = r."destinationId"
    WHERE r.is_kosher = false
    ORDER BY r.verification_status DESC, d.country, d.name
  `)).rows;

  // 2. All verified restaurants with google_opening_hours
  const rows = (await db.query(`
    SELECT r.id, r.name, r.address, r.is_kosher, r.kashrut_level, r.restaurant_type,
           r.google_primary_type, r.google_types, r.google_opening_hours,
           r.google_rating, r.google_rating_count,
           d.name AS dest, d.country, d.country_code
    FROM restaurants r LEFT JOIN destinations d ON d.id = r."destinationId"
    WHERE r.verification_status = 'verified' AND r.google_opening_hours IS NOT NULL
    ORDER BY d.country, d.name, r.id
  `)).rows;
  await db.end();

  const confirmed = []; // red — real business, hours during shabbat, not lodging
  const needsJudgment = []; // orange — lodging/hotel/catering, could be prepaid shabbat meals
  const unparseable = [];
  let cleanCount = 0;

  const LODGING_RE = /hotel|lodging|resort/i;

  for (const r of rows) {
    const parsed = parseHours(r.google_opening_hours);
    if (!parsed) { unparseable.push(r); continue; }

    const friReason = fridayViolation(parsed.Friday);
    const satReason = saturdayViolation(parsed.Saturday);
    if (!friReason && !satReason) { cleanCount += 1; continue; }

    const isLodging = LODGING_RE.test(r.google_primary_type || '') || LODGING_RE.test(r.google_types || '');
    const entry = { ...r, friReason, satReason };
    if (isLodging) needsJudgment.push(entry);
    else confirmed.push(entry);
  }

  const stamp = Date.now();
  const outFile = path.join(OUT_DIR, `audit-shabbat-hours-${stamp}.html`);
  const csvFile = path.join(OUT_DIR, `audit-shabbat-hours-${stamp}.csv`);

  // CSV of the actionable rows (confirmed + needsJudgment)
  const csvCols = ['id', 'name', 'dest', 'country', 'address', 'friReason', 'satReason', 'category'];
  const csvRows = [
    ...confirmed.map((r) => ({ ...r, category: 'confirmed' })),
    ...needsJudgment.map((r) => ({ ...r, category: 'needs_judgment' })),
  ];
  const csvEsc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  fs.writeFileSync(csvFile, '﻿' + [csvCols.join(','), ...csvRows.map((r) => csvCols.map((c) => csvEsc(r[c])).join(','))].join('\n') + '\n', 'utf8');

  const knownBadSection = () => `
    <h2 style="color:#6a1b9a">ℹ️ כבר מסומן אצלנו is_kosher=false — ${knownBad.length}</h2>
    <p class="note">רשומות שכבר יש להן דגל פנימי שהן לא כשרות (לא קשור לשעות) — כרגע לא מסוננות בקוד ה-API, כך שהמאומתות שביניהן מוצגות למשתמשים. לא נגעתי בהן, זה רק תזכורת.</p>
    <table><thead><tr><th>ID</th><th>שם</th><th>יעד</th><th>סטטוס</th><th>כתובת</th></tr></thead><tbody>
    ${knownBad.map((r) => `<tr><td>${r.id}</td><td><b>${esc(r.name)}</b></td><td>${esc(r.dest)}, ${esc(r.country)}</td><td>${esc(r.verification_status)}</td><td>${esc(r.address)}</td></tr>`).join('')}
    </tbody></table>`;

  const section = (title, color, note, items) => `
    <h2 style="color:${color}">${title} — ${items.length}</h2>
    <p class="note">${note}</p>
    <table><thead><tr><th>ID</th><th>שם</th><th>יעד</th><th>כתובת</th><th>סוג עסק (Google)</th><th>שישי</th><th>שבת</th><th>קישור</th></tr></thead><tbody>
    ${items.map((r) => `<tr>
      <td>${r.id}</td>
      <td><b>${esc(r.name)}</b>${r.is_kosher === false ? ' <span class="warn">⚠ is_kosher=false</span>' : ''}</td>
      <td>${esc(r.dest)}, ${esc(r.country)}</td>
      <td>${esc(r.address)}</td>
      <td>${esc(r.google_primary_type || '')}</td>
      <td class="reason">${r.friReason ? esc(r.friReason) : '—'}</td>
      <td class="reason">${r.satReason ? esc(r.satReason) : '—'}</td>
      <td><a href="${esc(mapsSearch(r.name, r.address))}" target="_blank">מפות</a></td>
    </tr>`).join('')}
    </tbody></table>`;

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ביקורת שעות שבת — בדיקת כשרות</title>
<style>
body{font-family:Arial,sans-serif;margin:16px;background:#fafafa;color:#212121}
h1{font-size:20px}h2{font-size:16px;margin-top:26px}
.summary{background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px 14px;margin:12px 0 20px;font-size:13.5px;line-height:1.7}
.note{font-size:12.5px;color:#607d8b;margin:4px 0 10px}
table{border-collapse:collapse;width:100%;background:#fff;font-size:12.5px;margin-bottom:10px}
th,td{border:1px solid #e0e0e0;padding:6px 8px;text-align:right;vertical-align:top}
th{background:#eceff1;position:sticky;top:0}
.reason{max-width:260px}
.warn{color:#b71c1c;font-weight:700;font-size:11px}
a{color:#1565c0;text-decoration:none}a:hover{text-decoration:underline}
</style></head><body>
<h1>ביקורת שעות שבת — בדיקת כשרות (עלות: $0, ללא קריאות API)</h1>
<div class="summary">
נבדקו <b>${rows.length}</b> מסעדות מאומתות עם שעות פתיחה מגוגל.<br>
✅ ללא חשד: <b>${cleanCount}</b> · 🔴 חשד ודאי (עסק רגיל): <b>${confirmed.length}</b> · 🟠 צריך שיקול דעת (מלון/אירוח): <b>${needsJudgment.length}</b> · לא ניתן היה לפרסר: <b>${unparseable.length}</b><br>
בנוסף, <b>${knownBad.length}</b> רשומות כבר מסומנות is_kosher=false במאגר (ללא קשר לשעות).<br>
<b>חוקים:</b> שישי פתוח אחרי 21:00 → חשד · שבת פתוח בין 08:00–16:00 → חשד. פתיחה במוצ"ש (למשל 21:30–00:00) לא נחשבת חשד.
</div>
${knownBad.length ? knownBadSection() : ''}
${section('🔴 חשד ודאי — פתוח בזמן שאסור', '#b71c1c', 'עסקים רגילים (לא מלון/אירוח). אלה החשודים המרכזיים לבדיקה שלך.', confirmed)}
${section('🟠 מלון / אירוח — צריך שיקול דעת', '#e65100', 'מלונות/אירוח עלולים להגיש ארוחות שבת בתשלום מראש בלי להיות "פתוחים" במובן הרגיל. תחליט פרטנית.', needsJudgment)}
</body></html>`;

  fs.writeFileSync(outFile, html, 'utf8');
  console.log('=== SHABBAT HOURS AUDIT — READ ONLY, NO DB WRITES ===');
  console.log(JSON.stringify({
    totalChecked: rows.length, clean: cleanCount, confirmed: confirmed.length,
    needsJudgment: needsJudgment.length, unparseable: unparseable.length,
    knownNonKosher: knownBad.length, htmlFile: outFile, csvFile,
  }, null, 2));
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
