/*
 * POST-RUN de-dup pass (read-only on DB, no writes, no Google/LLM calls).
 *
 * When the same google_place_id is claimed by more than one VERIFIED row, at
 * most one of our restaurants is really that Google business. This keeps the
 * single best match verified and demotes the rest to 'uncertain' for manual
 * review, so apply never assigns one Google identity (phone/photo/coords) to
 * two different restaurants. (Codex rule.)
 *
 * Winner = highest score:
 *   address (exact street+house+city > street+city > city) * 10
 *   + name_sim * 3
 *   + llm_conf * 1
 * ties -> higher name_sim -> smaller distance_m -> lower id (stable).
 *
 * Usage: node scripts/resolve-place-collisions.js <combined-dryrun.csv>
 * Output: <same>-resolved.csv  (adds resolved_final + collision columns; the
 *         original final column is preserved untouched).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { classifyAddressFirst } = require('./lib/address-match');

const csvEsc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

function parseCsv(file) {
  const s = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const rows = []; let f = [], c = '', q = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { f.push(c); c = ''; }
    else if (ch === '\n') { f.push(c); rows.push(f); f = []; c = ''; }
    else if (ch !== '\r') c += ch; }
  if (c || f.length) { f.push(c); rows.push(f); }
  return rows;
}

function addressScore(rec) {
  const cls = classifyAddressFirst({
    old_name: rec.old_name, old_address: rec.old_address,
    google_name: rec.google_name, google_address: rec.google_address,
    name_sim: rec.name_sim, business_status: rec.business_status,
    google_rating: rec.google_rating, google_phone: rec.google_phone,
    has_photo: rec.has_photo, distance_m: rec.distance_m,
  });
  if (cls.addressExact) return 3;
  if (cls.streetMatch && cls.cityMatch) return 2;
  if (cls.cityMatch) return 1;
  return 0;
}

function score(rec) {
  const nameSim = Number(rec.name_sim) || 0;
  const conf = Number(rec.llm_conf) || 0;
  return addressScore(rec) * 10 + nameSim * 3 + conf;
}

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/resolve-place-collisions.js <combined-dryrun.csv>'); process.exit(1); }

const rows = parseCsv(file);
const H = rows[0];
const col = Object.fromEntries(H.map((h, i) => [h, i]));
const data = rows.slice(1).filter((r) => r.length >= H.length).map((r) => Object.fromEntries(H.map((h, i) => [h, r[i]])));

// group VERIFIED rows by place_id
const groups = {};
for (const rec of data) {
  if (rec.final === 'verified' && rec.google_place_id) {
    (groups[rec.google_place_id] = groups[rec.google_place_id] || []).push(rec);
  }
}

let collisions = 0, demoted = 0;
const demoteIds = new Map(); // id -> reason
for (const [pid, g] of Object.entries(groups)) {
  if (g.length < 2) continue;
  collisions++;
  const ranked = g.map((rec) => ({ rec, s: score(rec) }))
    .sort((a, b) => b.s - a.s
      || (Number(b.rec.name_sim) || 0) - (Number(a.rec.name_sim) || 0)
      || (Number(a.rec.distance_m) || 1e9) - (Number(b.rec.distance_m) || 1e9)
      || Number(a.rec.id) - Number(b.rec.id));
  const winner = ranked[0].rec;
  for (let i = 1; i < ranked.length; i++) {
    demoted++;
    demoteIds.set(ranked[i].rec.id, `dup-place ${pid.slice(0, 14)} (winner #${winner.id} "${winner.old_name}")`);
  }
}

// write resolved CSV: preserve everything, add resolved_final + collision
const outFile = file.replace(/\.csv$/i, '-resolved.csv');
const OUT_H = [...H, 'resolved_final', 'collision'];
const lines = [OUT_H.join(',')];
for (const rec of data) {
  const isLoser = demoteIds.has(rec.id);
  const resolved = isLoser ? 'uncertain' : rec.final;
  const collision = isLoser ? demoteIds.get(rec.id) : '';
  lines.push([...H.map((h) => rec[h]), resolved, collision].map(csvEsc).join(','));
}
fs.writeFileSync(outFile, '﻿' + lines.join('\n') + '\n', 'utf8');

const verifiedBefore = data.filter((r) => r.final === 'verified').length;
console.log('=== PLACE-ID COLLISION RESOLUTION (no DB writes) ===');
console.log(`rows: ${data.length}`);
console.log(`place_ids claimed by >=2 verified rows: ${collisions}`);
console.log(`rows demoted verified -> uncertain: ${demoted}`);
console.log(`verified before: ${verifiedBefore}  ->  after: ${verifiedBefore - demoted}`);
console.log(`resolved CSV: ${path.relative(path.join(__dirname, '..'), outFile)}`);
