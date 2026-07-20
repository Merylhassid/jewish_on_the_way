/*
 * OFFLINE analysis only — no API, no DB, no writes, no apply.
 * Measures how many flagged/no_match rows an ADDRESS-FIRST rule would safely
 * promote to verified (ignoring the broken coordinate distance).
 *
 * Address-first promotion — verified ONLY if ALL hold:
 *   1. Google business_status = OPERATIONAL
 *   2. name similarity very high
 *   3. house-number match (our address vs Google address)
 *   4. street-token match (transliteration-aware)
 *   5. city match, OR city-confidence from a strong street+house match
 *   6. NOT generic; if chain -> require exact address + higher name bar
 * Everything else stays flagged / coordinate_suspect.
 *
 * Reads audit-output/dry-run-matches.csv (has google_address + business_status
 * for every row). Usage: node scripts/analyze-address-first.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { nameSimilarity, normalizeName, consonantSkeleton, skeletonOf, editRatio } =
  require('./lib/match-helpers');

// ── tunables ──
const NAME_HIGH = 0.80; // "very high" name similarity (transliteration caps some real matches ~0.8)
const NAME_CHAIN = 0.90; // stricter bar for chain/brand names

const OUT = path.join(__dirname, '..', 'audit-output');
const parse = (line) => {
  const o = []; let c = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else { if (ch === ',') { o.push(c); c = ''; } else if (ch === '"') q = true; else c += ch; }
  }
  o.push(c); return o;
};
function readCsv(file) {
  const t = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').trim();
  const lines = t.split('\n');
  const hdr = lines[0].split(',');
  return lines.slice(1).map((l) => { const a = parse(l); return Object.fromEntries(hdr.map((h, i) => [h, a[i]])); });
}

// ── chain detection from name frequency across all CSV logs ──
const freq = {};
for (const f of fs.readdirSync(OUT)) {
  if (!/\.csv$/.test(f)) continue;
  let rows; try { rows = readCsv(path.join(OUT, f)); } catch { continue; }
  for (const r of rows) { const nm = r.old_name || r.name; if (nm) { const k = normalizeName(nm); if (k) freq[k] = (freq[k] || 0) + 1; } }
}
const BRANDS = ['ארומה', 'aroma', 'קופיקס', 'cofix', 'קפה קפה', 'פיצה האט', 'pizza hut', 'בורגר קינג',
  'burger king', 'מקדונלד', 'mcdonald', 'בורגרים', 'burgerim', 'ברמן', 'berman', 'רולדין', 'roladin',
  'גרג', 'greg', 'רבר', 'rebar', 'ארקפה', 'arcaffe', 'לנדוור', 'landwer', 'דומינו', 'domino',
  'וופל בר', 'ג\'פניקה', 'japanika', 'אנג\'ל', 'angel', 'מוזס', 'moses', 'שגב', 'bbb', 'ג\'מס',
  'jem', 'פיצה מטר', 'מקס ברנר', 'b-fresh', 'bfresh'];
const GENERIC = new Set(['פיצה', 'פלאפל', 'שווארמה', 'קפה', 'מסעדה', 'מסעדת', 'בר', 'מאפייה', 'מאפה',
  'סושי', 'בורגר', 'המבורגר', 'שניצל', 'חומוס', 'סנדוויץ', 'ביסטרו', 'גריל', 'נודלס', 'קייטרינג',
  'pizza', 'falafel', 'cafe', 'coffee', 'bar', 'grill', 'sushi', 'burger', 'restaurant', 'bakery']);
function nameType(name) {
  const norm = normalizeName(name);
  const meaningful = norm.split(' ').filter((t) => !GENERIC.has(t) && t.length >= 2);
  if (meaningful.length === 0) return 'generic';
  if (BRANDS.some((b) => norm.includes(b)) || (freq[norm] || 0) >= 3) return 'chain';
  return 'unique';
}

// ── address parsing ──
const hasHeb = (s) => /[֐-׿]/.test(s || '');
function ourCity(addr) {
  if (!addr) return '';
  let parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
  parts = parts.filter((x) => !/israel|ישראל|^\d/i.test(x));
  return normalizeName(parts[parts.length - 1] || '');
}
const houseNum = (addr) => { const m = (addr || '').match(/\b(\d{1,4})\b/); return m ? m[1] : ''; };
function streetTokens(addr) {
  return normalizeName((addr || '').split(',')[0] || '')
    .split(' ').filter((t) => t.length >= 3 && !/^\d+$/.test(t));
}
// "Loose key": consonant skeleton with the transliteration-ambiguous letters
// removed/normalized so Hebrew<->English place names align. The Hebrew vav (ו)
// is v OR o/u, and he (ה) is often silent in romanization — both are dropped;
// p/f (פ) and k/q (כ/ק) are folded. This makes רמת השרון == Ramat HaSharon,
// עפולה == Afula, פתח תקווה == Petah Tikva.
const looseKey = (s) => consonantSkeleton(s).replace(/[vhw]/g, '').replace(/f/g, 'p').replace(/k/g, 'q');

// does a street/city token appear in the Google address (loose, script-agnostic)?
function tokenInAddress(token, gNorm) {
  if (!token || token.length < 3) return false;
  if (gNorm.includes(token)) return true; // same-script direct
  const ts = looseKey(token);
  if (ts.length < 3) return false;
  const gl = looseKey(gNorm);
  if (gl.includes(ts)) return true;
  // fuzzy per-token fallback
  return gNorm.split(' ').some((gt) => gt.length >= 3 && editRatio(ts, looseKey(gt)) >= 0.8);
}

function classify(r) {
  const sim = Number(r.name_sim);
  const nt = nameType(r.old_name);
  const active = r.business_status === 'OPERATIONAL';
  const gAddr = r.google_address || '';
  const gNorm = normalizeName(gAddr);
  const gSkel = consonantSkeleton(gAddr);
  const hasData = !!(r.google_rating || r.google_phone || r.has_photo === 'yes');

  const hn1 = Number(houseNum(r.old_address)), hn2 = Number(houseNum(gAddr));
  const houseExact = !!(hn1 && hn2 && hn1 === hn2);
  const houseClose = !!(hn1 && hn2 && Math.abs(hn1 - hn2) <= 12);
  const streetMatch = streetTokens(r.old_address).some((t) => tokenInAddress(t, gNorm));
  const oc = ourCity(r.old_address);
  const cityMatch = !!oc && (gNorm.includes(oc) || tokenInAddress(oc, gNorm));
  const addressExact = streetMatch && houseExact && cityMatch;
  const dist = Number(r.distance_m);

  const reasons = [];
  let promote = false;
  // Hard blocks: closed, generic, or Google returned an address with NO business
  // data (name is just the street, nothing to enrich).
  if (!active) reasons.push('not-operational');
  else if (nt === 'generic') reasons.push('generic-name');
  else if (!hasData && !r.google_name) reasons.push('no-google-candidate');
  else if (!hasData) reasons.push('address-only-no-data');
  else if (nt === 'unique') {
    // Distinctive name: same city + (matching name OR exact address) is enough.
    if (cityMatch && (sim >= 0.6 || addressExact || (dist <= 60 && houseExact))) promote = true;
    else { if (!cityMatch) reasons.push('no-city-match'); if (sim < 0.6) reasons.push('name<0.6'); }
  } else if (nt === 'chain') {
    // Chain: pin to the exact branch — same city + street + house within a few.
    if (cityMatch && streetMatch && houseClose && sim >= 0.75) promote = true;
    else reasons.push('chain-needs-same-street+house');
  }

  const shortName = normalizeName(r.old_name).replace(/[^\p{L}]/gu, '').length <= 3;
  const suspicious = promote && (nt === 'chain' || shortName ||
    (sim < 0.5 && !addressExact) || (hn1 && hn2 && Math.abs(hn1 - hn2) > 5 && !streetMatch));

  return { nt, sim, active, houseExact, streetMatch, cityMatch, addressExact, hasData, promote, suspicious, reasons };
}

const rows = readCsv(path.join(OUT, 'dry-run-matches.csv'));
const total = rows.length;
const curVerified = rows.filter((r) => r.status === 'verified').length;
const nonVerified = rows.filter((r) => r.status !== 'verified');

const promoted = [], rejectedSimilar = [];
const ntCount = { unique: 0, chain: 0, generic: 0 };
for (const r of nonVerified) {
  const c = classify(r);
  if (c.promote) { promoted.push({ r, c }); ntCount[c.nt]++; }
  else if (Number(r.name_sim) >= 0.7) rejectedSimilar.push({ r, c });
}

console.log('\n=== ADDRESS-FIRST offline analysis (sample of ' + total + ', NO API/DB/writes) ===');
console.log(`params: NAME_HIGH=${NAME_HIGH}, NAME_CHAIN=${NAME_CHAIN}`);
console.log(`\nverified BEFORE:        ${curVerified}  (${(curVerified / total * 100).toFixed(1)}%)`);
console.log(`promoted by new rule:   +${promoted.length}`);
console.log(`verified PROJECTED:     ${curVerified + promoted.length}  (${((curVerified + promoted.length) / total * 100).toFixed(1)}%)`);
console.log(`  suspicious among promoted: ${promoted.filter((p) => p.c.suspicious).length}`);
console.log(`\npromoted by name-type: unique=${ntCount.unique} chain=${ntCount.chain} generic=${ntCount.generic}`);

console.log(`\n=== up to 50 PROMOTED (⚠=suspicious) ===`);
promoted.slice(0, 50).forEach(({ r, c }) => console.log(
  `  ${c.suspicious ? '⚠' : ' '} #${r.id} [${c.nt}] sim=${r.name_sim} "${r.old_name}" -> "${r.google_name}"\n       our: ${r.old_address}\n       ggl: ${r.google_address}  (${r.distance_m}m, ${r.business_status})`));

console.log(`\n=== up to 50 REJECTED despite similar name (name_sim>=0.7) — WHY ===`);
rejectedSimilar.slice(0, 50).forEach(({ r, c }) => console.log(
  `  #${r.id} [${c.nt}] sim=${r.name_sim} "${r.old_name}" -> "${r.google_name}" | ${c.reasons.join(', ')}\n       our: ${r.old_address}  |  ggl: ${r.google_address || '(none)'}`));

// projection to full Israel
console.log(`\n=== projection to 5,554 Israel (from this ${total}-row sample rate) ===`);
const projPct = (curVerified + promoted.length) / total;
console.log(`  projected verified across Israel: ~${Math.round(projPct * 5554)} (${(projPct * 100).toFixed(1)}%)`);
