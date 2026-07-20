/*
 * OFFLINE — no API/DB/writes. Buckets every row of the dry-run sample into a
 * human-readable "problem category" with verifiable examples, so the user can
 * check each case themselves. Reads audit-output/dry-run-matches.csv.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { nameSimilarity } = require('./lib/match-helpers');

const file = path.join(__dirname, '..', 'audit-output', 'dry-run-matches.csv');
const parse = (line) => {
  const o = []; let c = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else { if (ch === ',') { o.push(c); c = ''; } else if (ch === '"') q = true; else c += ch; }
  }
  o.push(c); return o;
};
const t = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').trim().split('\n');
const hdr = t[0].split(',');
const rows = t.slice(1).map((l) => { const a = parse(l); return Object.fromEntries(hdr.map((h, i) => [h, a[i]])); });

const houseNum = (a) => { const m = (a || '').match(/\b(\d{1,4})\b/); return m ? m[1] : ''; };

function category(r) {
  const sim = Number(r.name_sim);
  const dist = Number(r.distance_m);
  const hnOur = houseNum(r.old_address), hnG = houseNum(r.google_address);
  const houseMatch = hnOur && hnG && hnOur === hnG;
  const closed = /CLOSED/.test(r.business_status || '');

  if (r.status === 'verified') return '1. ✅ הצליח — התאמה מלאה (שם+כתובת קרובים)';
  if (closed) return '2. 🔴 עסק סגור בגוגל (CLOSED) — אי אפשר לאמת כפתוח';
  if (r.status === 'flagged' && /proximity-name-mismatch/.test(r.reason))
    return '3. 🏬 עסק שכן/קניון — אותו מקום פיזי, שם אחר (מרפאה/קניון)';
  if (!r.google_name) return '4. ❓ גוגל לא החזיר שום מועמד — המקום כנראה לא בגוגל';
  if (sim >= 0.6 && houseMatch)
    return '5. 📍 אותה מסעדה בדיוק, אבל הקואורדינטה שלנו שבורה (ניתן להצלה!)';
  if (sim >= 0.6 && !houseMatch)
    return '6. 🏘️ שם זהה אבל רחוב/מספר-בית שונה — סניף אחר / המקום עבר';
  if (sim < 0.4)
    return '7. ⛔ גוגל החזיר מקום אחר לגמרי (שם לא דומה)';
  return '8. 🟡 גבולי — התאמה חלקית, צריך בדיקה ידנית';
}

const buckets = {};
for (const r of rows) {
  const c = category(r);
  (buckets[c] = buckets[c] || []).push(r);
}

console.log(`\n=== מפת הבעיות (${rows.length} מסעדות במדגם) ===\n`);
const order = Object.keys(buckets).sort();
for (const c of order) {
  const list = buckets[c];
  const pct = (list.length / rows.length * 100).toFixed(0);
  console.log(`${c}`);
  console.log(`   כמות: ${list.length} (${pct}%)`);
  list.slice(0, 4).forEach((r) => {
    console.log(`     • #${r.id} "${r.old_name}"`);
    console.log(`         שלנו:  ${r.old_address}`);
    console.log(`         גוגל:  "${r.google_name || '—'}"  |  ${r.google_address || '—'}  (${r.distance_m}m)`);
    if (r.google_maps_uri) console.log(`         בדוק:  ${r.google_maps_uri}`);
  });
  console.log('');
}
