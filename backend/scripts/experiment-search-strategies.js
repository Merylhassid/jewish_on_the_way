/*
 * Read-only experiment (NO DB writes, NO --apply): compare 6 Google search
 * strategies on a stratified 50-row sample to decide whether a better search
 * strategy would raise verified quality/coverage before any real run.
 *
 * Sample (pulled from the latest dryrun CSV):
 *   20 no_match with name_sim>=0.6 AND distance>250m  (likely our coords wrong)
 *   15 flagged 'needs-review'
 *   15 verified (control — should stay verified)
 *
 * Strategies per row:
 *   S1 name+address + locationBias (circle 500m)   [current]
 *   S2 name+address + locationRestriction (rect ~500m)
 *   S3 Nearby Search around coords + name match
 *   S4 name+city, no bias
 *   S5 address only + locationBias
 *   S6 name+address + bias, maxResultCount 5 -> pick best by score
 *
 * Eligibility uses scoreMatch (a close place with a dissimilar name is FLAGGED,
 * not verified — we never verify on location alone).
 *
 * Cost: 50 rows x 6 = 300 Text/Nearby Search (Pro tier) calls. Pro free tier is
 * 5,000/month, so this is $0.
 *
 * Usage: node scripts/experiment-search-strategies.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { nameSimilarity, distanceMeters, scoreMatch } = require('./lib/match-helpers');
const { ISRAEL_JOIN, ISRAEL_WHERE } = require('./lib/israel-filter');

const KEY = process.env.GOOGLE_PLACES_API_KEY;
const MASK = 'places.id,places.displayName,places.location,places.businessStatus';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ourCity(addr) {
  if (!addr) return '';
  let parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
  parts = parts.filter((p) => !/israel|united states|united kingdom|france|usa|uk|^\d/i.test(p));
  return parts[parts.length - 1] || '';
}

async function textSearch(textQuery, { lat, lng, mode, maxResultCount = 1 }) {
  const body = { textQuery, maxResultCount, languageCode: 'he' };
  if (mode === 'bias' && lat != null) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 500 } };
  } else if (mode === 'restrict' && lat != null) {
    const d = 0.0045;
    body.locationRestriction = {
      rectangle: {
        low: { latitude: lat - d, longitude: lng - d },
        high: { latitude: lat + d, longitude: lng + d },
      },
    };
  }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': MASK },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const d = await res.json();
  return (d.places || []).map((p) => ({ name: p.displayName?.text || '', lat: p.location?.latitude, lng: p.location?.longitude, bs: p.businessStatus }));
}

async function nearby({ lat, lng, radius = 350 }) {
  if (lat == null) return [];
  const body = {
    includedTypes: ['restaurant', 'cafe', 'bakery', 'meal_takeaway', 'food'],
    maxResultCount: 15,
    locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
    rankPreference: 'DISTANCE',
    languageCode: 'he',
  };
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': MASK },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const d = await res.json();
  return (d.places || []).map((p) => ({ name: p.displayName?.text || '', lat: p.location?.latitude, lng: p.location?.longitude, bs: p.businessStatus }));
}

// Score a candidate list against a row; return the best by (status rank, confidence).
function best(row, cands) {
  const rank = { verified: 2, flagged: 1, no_match: 0 };
  let bestOne = null;
  for (const cand of cands) {
    if (!cand || cand.lat == null) continue;
    const dist = distanceMeters(row.lat, row.lng, cand.lat, cand.lng);
    const sim = nameSimilarity(row.name, cand.name);
    const { status, confidence } = scoreMatch({ nameSim: sim, distM: dist, businessStatus: cand.bs || 'OPERATIONAL' });
    const cur = { cand, dist, sim, status, confidence };
    if (!bestOne || rank[status] > rank[bestOne.status] ||
      (rank[status] === rank[bestOne.status] && confidence > bestOne.confidence)) {
      bestOne = cur;
    }
  }
  return bestOne || { cand: null, dist: null, sim: 0, status: 'no_match', confidence: 0 };
}

// Same-branch heuristic on the chosen candidate.
function branchAssess(r) {
  if (!r.cand) return 'none';
  if (r.sim >= 0.6 && r.dist != null && r.dist <= 250) return 'same';
  if (r.sim >= 0.6 && r.dist != null && r.dist > 250) return 'other-branch?';
  if (r.sim < 0.4) return 'different-place';
  return 'unclear';
}

// Quote-aware CSV line parser (addresses contain commas/quotes).
function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else { if (ch === ',') { out.push(cur); cur = ''; } else if (ch === '"') q = true; else cur += ch; }
  }
  out.push(cur); return out;
}

function pickSample() {
  const csv = fs.readdirSync(path.join(__dirname, '..', 'audit-output'))
    .filter((f) => f.startsWith('dryrun-log-')).sort().pop();
  const text = fs.readFileSync(path.join(__dirname, '..', 'audit-output', csv), 'utf8').replace(/^﻿/, '');
  const rows = text.trim().split('\n').slice(1).map(parseCsvLine);
  const col = { id: 0, status: 1, sim: 3, dist: 4, reason: 11 };
  const nm = rows.filter((a) => a[col.status] === 'no_match' && Number(a[col.sim]) >= 0.6 && Number(a[col.dist]) > 250);
  const fl = rows.filter((a) => a[col.status] === 'flagged' && /needs-review/.test(a[col.reason] || ''));
  const ve = rows.filter((a) => a[col.status] === 'verified');
  const take = (arr, n) => arr.sort(() => Math.random() - 0.5).slice(0, n).map((a) => ({ id: Number(a[0]), origStatus: a[col.status] }));
  console.log(`sample pools -> no_match(hi-sim,far): ${nm.length}, flagged(needs-review): ${fl.length}, verified: ${ve.length}`);
  return [...take(nm, 20), ...take(fl, 20), ...take(ve, 15)];
}

(async () => {
  const sample = pickSample();
  const c = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await c.connect();
  const q = await c.query(
    `select r.id, r.name, r.address, ST_Y(r.location::geometry) lat, ST_X(r.location::geometry) lng
       from restaurants r ${ISRAEL_JOIN}
      where ${ISRAEL_WHERE} and r.id = any($1::int[])`, [sample.map((s) => s.id)]);
  await c.end();
  const meta = Object.fromEntries(sample.map((s) => [s.id, s.origStatus]));
  const rows = q.rows.map((r) => ({ ...r, origStatus: meta[r.id] }));

  const strategies = ['S1_bias', 'S2_restrict', 'S3_nearby', 'S4_city', 'S5_addr', 'S6_top5'];
  const agg = {};
  strategies.forEach((s) => (agg[s] = { verified: 0, flagged: 0, no_match: 0, falsePos: 0 }));
  const winners = {};
  const outRows = [];

  console.log(`\n=== SEARCH STRATEGY EXPERIMENT: ${rows.length} rows, 6 strategies ===\n`);
  let n = 0;
  for (const row of rows) {
    n++;
    const city = ourCity(row.address);
    const results = {};
    results.S1_bias = best(row, await textSearch(`${row.name} ${row.address || ''}`, { lat: row.lat, lng: row.lng, mode: 'bias' }));
    await sleep(100);
    results.S2_restrict = best(row, await textSearch(`${row.name} ${row.address || ''}`, { lat: row.lat, lng: row.lng, mode: 'restrict' }));
    await sleep(100);
    results.S3_nearby = best(row, await nearby({ lat: row.lat, lng: row.lng, radius: 350 }));
    await sleep(100);
    results.S4_city = best(row, await textSearch(`${row.name} ${city}`, { lat: row.lat, lng: row.lng, mode: 'none' }));
    await sleep(100);
    results.S5_addr = best(row, await textSearch(`${row.address || row.name}`, { lat: row.lat, lng: row.lng, mode: 'bias' }));
    await sleep(100);
    results.S6_top5 = best(row, await textSearch(`${row.name} ${row.address || ''}`, { lat: row.lat, lng: row.lng, mode: 'bias', maxResultCount: 5 }));
    await sleep(100);

    // aggregate + false positives (verified but proximity-only name<0.3)
    for (const s of strategies) {
      const r = results[s];
      agg[s][r.status]++;
      if (r.status === 'verified' && r.sim < 0.3) agg[s].falsePos++;
    }
    // winner = best status then confidence
    const rank = { verified: 2, flagged: 1, no_match: 0 };
    let win = null, winName = null;
    for (const s of strategies) {
      const r = results[s];
      if (!win || rank[r.status] > rank[win.status] || (rank[r.status] === rank[win.status] && r.confidence > win.confidence)) {
        win = r; winName = s;
      }
    }
    winners[winName] = (winners[winName] || 0) + 1;

    outRows.push({
      id: row.id, orig: row.origStatus, name: row.name,
      winner: winName, wStatus: win.status, wCand: win.cand?.name || '',
      wDist: win.dist == null ? '' : Math.round(win.dist), wSim: win.sim.toFixed(2),
      branch: branchAssess(win),
    });
    if (n % 10 === 0) console.log(`  ...${n}/${rows.length}`);
  }

  // ── per-strategy aggregate ──
  console.log('\n=== PER-STRATEGY OUTCOMES (all 50 rows) ===');
  console.log('strategy       verified  flagged  no_match  falsePos');
  for (const s of strategies) {
    const a = agg[s];
    console.log(`  ${s.padEnd(12)} ${String(a.verified).padStart(6)} ${String(a.flagged).padStart(8)} ${String(a.no_match).padStart(9)} ${String(a.falsePos).padStart(9)}`);
  }

  // ── rescue analysis on the 20 no_match sample ──
  const nmIds = new Set(outRows.filter((r) => r.orig === 'no_match').map((r) => r.id));
  console.log(`\n=== RESCUE of the ${nmIds.size} no_match sample rows (best across strategies) ===`);
  let rescuedV = 0, rescuedF = 0;
  outRows.filter((r) => r.orig === 'no_match').forEach((r) => {
    if (r.wStatus === 'verified') rescuedV++;
    else if (r.wStatus === 'flagged') rescuedF++;
  });
  console.log(`  rescued to verified: ${rescuedV}/${nmIds.size}`);
  console.log(`  rescued to flagged:  ${rescuedF}/${nmIds.size}`);

  // ── control: did the 15 verified stay verified? ──
  const ctrl = outRows.filter((r) => r.orig === 'verified');
  const stayed = ctrl.filter((r) => r.wStatus === 'verified').length;
  console.log(`\n=== CONTROL: verified rows still verified by best strategy: ${stayed}/${ctrl.length} ===`);

  // ── winner distribution ──
  console.log('\n=== WINNING STRATEGY DISTRIBUTION ===');
  Object.entries(winners).sort((a, b) => b[1] - a[1]).forEach(([s, cnt]) => console.log(`  ${s}: ${cnt}`));

  // ── per-row table (also to CSV) ──
  const outDir = path.join(__dirname, '..', 'audit-output');
  const outFile = path.join(outDir, `experiment-results-${Date.now()}.csv`);
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const hdr = 'id,orig_status,name,winner_strategy,winner_status,winner_candidate,distance_m,name_sim,branch_assessment';
  fs.writeFileSync(outFile, '﻿' + hdr + '\n' +
    outRows.map((r) => [r.id, r.orig, r.name, r.winner, r.wStatus, r.wCand, r.wDist, r.wSim, r.branch].map(esc).join(',')).join('\n') + '\n', 'utf8');
  console.log('\n=== PER-ROW SAMPLE (first 20) ===');
  outRows.slice(0, 20).forEach((r) => console.log(`  #${r.id} [${r.orig}->${r.wStatus}] ${r.winner} | "${r.name}" -> "${r.wCand}" ${r.wDist}m sim=${r.wSim} (${r.branch})`));
  console.log(`\nfull table: ${path.relative(path.join(__dirname, '..'), outFile)}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
