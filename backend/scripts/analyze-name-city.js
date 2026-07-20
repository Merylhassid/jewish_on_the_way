/*
 * OFFLINE analysis only — no API, no DB, no writes. Reads existing CSV logs.
 * Measures how many flagged/no_match rows a strict name+city rule would promote
 * to verified, split by name type (chain / generic / unique) and address match.
 *
 * Strict promotion rule (proposed):
 *   promote to verified ONLY if ALL hold:
 *     - name_sim >= 0.85 (very high)
 *     - city match (our city appears in Google's formatted address)
 *     - some address-token match (shared house number OR street skeleton)
 *     - NOT a chain and NOT a generic name
 *     - Google business status is OPERATIONAL
 *   everything else -> coordinate_suspect / flagged (NOT verified).
 *
 * Usage: node scripts/analyze-name-city.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { nameSimilarity, normalizeName } = require('./lib/match-helpers');

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

// ── Build name-frequency map from ALL available CSV logs (chain detection) ──
const freq = {};
for (const f of fs.readdirSync(OUT)) {
  if (!/\.csv$/.test(f)) continue;
  let rows;
  try { rows = readCsv(path.join(OUT, f)); } catch { continue; }
  for (const r of rows) {
    const nm = r.old_name || r.name;
    if (!nm) continue;
    const k = normalizeName(nm);
    if (k) freq[k] = (freq[k] || 0) + 1;
  }
}

// Curated Israeli chain/brand names (normalized fragments).
const BRANDS = ['ארומה', 'aroma', 'קופיקס', 'cofix', 'קפה קפה', 'פיצה האט', 'pizza hut',
  'בורגר קינג', 'burger king', 'מקדונלד', 'mcdonald', 'בורגרים', 'burgerim', 'ברמן', 'berman',
  'רולדין', 'roladin', 'גרג', 'greg', 'רבר', 'rebar', 'ארקפה', 'arcaffe', 'לנדוור', 'landwer',
  'דומינו', 'domino', 'וופל בר', 'ג\'פניקה', 'japanika', 'אנג\'ל', 'angel', 'מוזס', 'moses',
  'אגדיר', 'שגב', 'bbb', 'ג\'מס', 'jem', 'פיצה מטר', 'סופר פארם', 'מקס ברנר'];
// Generic category words: a name made only of these is "generic".
const GENERIC = new Set(['פיצה', 'פלאפל', 'שווארמה', 'קפה', 'מסעדה', 'מסעדת', 'בר', 'מאפייה',
  'מאפה', 'סושי', 'בורגר', 'המבורגר', 'שניצל', 'חומוס', 'סנדוויץ', 'ביסטרו', 'גריל', 'נודלס',
  'pizza', 'falafel', 'cafe', 'coffee', 'bar', 'grill', 'sushi', 'burger', 'restaurant', 'bakery']);

function nameType(name) {
  const norm = normalizeName(name);
  const toks = norm.split(' ').filter(Boolean);
  const meaningful = toks.filter((t) => !GENERIC.has(t) && t.length >= 2);
  if (meaningful.length === 0) return 'generic';
  if (BRANDS.some((b) => norm.includes(b)) || (freq[norm] || 0) >= 3) return 'chain';
  return 'unique';
}

function ourCity(addr) {
  if (!addr) return '';
  let parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
  parts = parts.filter((x) => !/israel|ישראל|^\d/i.test(x));
  return normalizeName(parts[parts.length - 1] || '');
}
const houseNum = (addr) => { const m = (addr || '').match(/\b(\d{1,4})\b/); return m ? m[1] : ''; };
function addressMatch(ourAddr, gAddr) {
  if (!gAddr) return 'no-google-address';
  const hn1 = houseNum(ourAddr), hn2 = houseNum(gAddr);
  if (hn1 && hn2 && hn1 === hn2) return 'house-number';
  // token-based street check (street name token appears in Google address)
  const streetToks = normalizeName((ourAddr || '').split(',')[0] || '').split(' ').filter((t) => t.length >= 3 && !/^\d+$/.test(t));
  const gn = normalizeName(gAddr);
  if (streetToks.some((t) => gn.includes(t))) return 'street';
  return 'no-address-match';
}

// ── Analyze the review target: the 202-row sample ──
const rows = readCsv(path.join(OUT, 'dry-run-matches.csv'));
const nonVerified = rows.filter((r) => r.status !== 'verified');

const cat = {};
const promoted = [];
for (const r of nonVerified) {
  const sim = Number(r.name_sim);
  const nt = nameType(r.old_name);
  const oc = ourCity(r.old_address);
  const gAddr = r.google_address || '';
  const gHeb = /[֐-׿]/.test(gAddr);
  const gc = normalizeName(gAddr);
  let cityMatch;
  if (!gAddr) cityMatch = 'no-google-address';
  else if (oc && oc.length >= 2 && gc.includes(oc)) cityMatch = 'city-match';
  else if (!gHeb) {
    // Google address is Latin-only: transliteration-aware check on city tokens.
    const gTokens = gc.split(' ').filter((t) => t.length >= 3);
    const hit = gTokens.some((t) => nameSimilarity(oc, t) >= 0.8);
    cityMatch = hit ? 'city-match' : 'google-english-uncertain';
  } else cityMatch = 'city-mismatch';
  const addrM = addressMatch(r.old_address, r.google_address);
  const active = r.business_status === 'OPERATIONAL';

  const key = `${nt} | ${cityMatch}`;
  cat[key] = (cat[key] || 0) + 1;

  // strict rule
  const wouldPromote = sim >= 0.85 && cityMatch === 'city-match' &&
    (addrM === 'house-number' || addrM === 'street') && nt === 'unique' && active;
  if (wouldPromote) {
    // suspicious heuristic: name still short/ambiguous, or only-street (not house) match
    const suspicious = normalizeName(r.old_name).replace(/[^\p{L}]/gu, '').length <= 4 || addrM === 'street';
    promoted.push({ ...r, nt, oc, addrM, suspicious });
  }
}

console.log('\n=== OFFLINE name+city analysis (on 202-row sample, NO API/DB/writes) ===');
console.log('non-verified rows:', nonVerified.length, `(of ${rows.length})`);
console.log('\n-- category breakdown (name-type | city) --');
Object.entries(cat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// name-type totals
const ntTotals = {};
nonVerified.forEach((r) => { const t = nameType(r.old_name); ntTotals[t] = (ntTotals[t] || 0) + 1; });
console.log('\n-- name-type totals (non-verified) --');
Object.entries(ntTotals).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

// address-match totals
const amTotals = {};
nonVerified.forEach((r) => { const a = addressMatch(r.old_address, r.google_address); amTotals[a] = (amTotals[a] || 0) + 1; });
console.log('\n-- address-match totals (non-verified) --');
Object.entries(amTotals).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

const curVerified = rows.filter((r) => r.status === 'verified').length;
console.log(`\n=== STRICT RULE would promote ${promoted.length} of ${nonVerified.length} non-verified ===`);
console.log(`projected verified: ${curVerified} + ${promoted.length} = ${((curVerified + promoted.length) / rows.length * 100).toFixed(1)}% (was ${(curVerified / rows.length * 100).toFixed(1)}%)`);
console.log(`  of promoted, flagged SUSPICIOUS: ${promoted.filter((p) => p.suspicious).length}`);

console.log('\n=== up to 30 PROMOTED examples (⚠ = suspicious) ===');
promoted.slice(0, 30).forEach((p) => console.log(`  ${p.suspicious ? '⚠' : ' '} #${p.id} "${p.old_name}" -> "${p.google_name}" | ${p.distance_m}m sim=${p.name_sim} city="${p.oc}" addr=${p.addrM} ${p.business_status}`));
