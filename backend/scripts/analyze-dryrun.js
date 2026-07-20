/*
 * Read-only analysis of a dryrun/enrich CSV log: root-cause breakdown of
 * no_match and flagged, and how many flagged look promotable to verified.
 * No DB, no API. Usage: node scripts/analyze-dryrun.js [path-to-csv]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const file = process.argv[2] ||
  fs.readdirSync(path.join(__dirname, '..', 'audit-output'))
    .filter((f) => f.startsWith('dryrun-log-'))
    .sort()
    .map((f) => path.join('audit-output', f))
    .pop();

function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').trim().split('\n');
  const hdr = lines[0].split(',');
  const parse = (line) => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else { if (ch === ',') { out.push(cur); cur = ''; } else if (ch === '"') q = true; else cur += ch; }
    }
    out.push(cur); return out;
  };
  return lines.slice(1).map((l) => {
    const a = parse(l);
    return Object.fromEntries(hdr.map((h, i) => [h, a[i]]));
  });
}

const rows = parseCsv(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
const num = (v) => (v === '' || v == null ? null : Number(v));
const by = (s) => rows.filter((r) => r.status === s);
const hasDigit = (a) => /[0-9]/.test(a || '');

console.log(`\n=== ANALYSIS of ${file} (${rows.length} rows) ===`);
const counts = {};
rows.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));
console.log('status counts:', JSON.stringify(counts));

// ── no_match root cause (the 5 buckets) ──
const nm = by('no_match');
const nmNoCand = nm.filter((r) => !r.google_name);
const nmCand = nm.filter((r) => r.google_name);
const nmStrongNameFar = nmCand.filter((r) => (num(r.name_sim) ?? 0) >= 0.6 && (num(r.distance_m) ?? 9e9) > 250);
const nmCloseDissimilar = nmCand.filter((r) => (num(r.distance_m) ?? 9e9) <= 250 && (num(r.name_sim) ?? 0) < 0.5);
const accounted = new Set([...nmStrongNameFar, ...nmCloseDissimilar, ...nmNoCand].map((r) => r.id));
const nmOther = nmCand.filter((r) => !accounted.has(r.id));
const nmNoHouseNum = nm.filter((r) => !hasDigit(r.old_address)).length;
const dists = nmCand.map((r) => num(r.distance_m)).filter((x) => x != null).sort((a, b) => a - b);
const medDist = dists.length ? dists[Math.floor(dists.length / 2)] : '-';
console.log(`\n-- no_match (${nm.length}) ROOT CAUSE --`);
console.log(`  (4) no Google candidate at all: ${nmNoCand.length}`);
console.log(`  (2) name matches (>=0.6) but coords FAR (>250m) => OUR coords wrong: ${nmStrongNameFar.length}`);
console.log(`  (3) candidate CLOSE (<=250m) but name dissimilar (<0.5): ${nmCloseDissimilar.length}`);
console.log(`  (5) other far candidate (weak bias / genuinely different): ${nmOther.length}`);
console.log(`      median candidate distance: ${medDist}m`);
console.log(`  info: no_match rows whose address has NO house number: ${nmNoHouseNum}`);

// ── flagged root cause + promotable ──
const fl = by('flagged');
const flClosed = fl.filter((r) => /business=/.test(r.reason)).length;
const flProxMismatch = fl.filter((r) => /proximity-name-mismatch/.test(r.reason)).length;
const flReview = fl.filter((r) => /needs-review/.test(r.reason)).length;
// promotable heuristic: needs-review, close-ish, decent name
const flPromotable = fl.filter((r) => /needs-review/.test(r.reason) &&
  (num(r.distance_m) ?? 9e9) <= 400 && (num(r.name_sim) ?? 0) >= 0.6).length;
console.log(`\n-- flagged (${fl.length}) root cause --`);
console.log(`  non-operational (closed): ${flClosed}`);
console.log(`  proximity-name-mismatch (co-located biz): ${flProxMismatch}`);
console.log(`  needs-review (distance/name borderline): ${flReview}`);
console.log(`  => promotable to verified (<=400m & name>=0.6): ${flPromotable}`);

module.exports = { rows };
