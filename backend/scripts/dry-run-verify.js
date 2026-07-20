/*
 * DRY-RUN: match existing restaurants against Google Places and emit a CSV of
 * the raw match signals. Does NOT write to the DB and does NOT download photos.
 * Purpose: eyeball match quality + calibrate confidence thresholds before any
 * real update run.
 *
 * Usage:
 *   node scripts/dry-run-verify.js                 # stratified ~150 sample
 *   node scripts/dry-run-verify.js --limit 30      # first N of the sample
 *   node scripts/dry-run-verify.js --ids 1269,1270 # specific restaurant ids
 *
 * Requires GOOGLE_PLACES_API_KEY + DB_* in backend/.env.
 * Cost: Text Search IDs-Only = free; Place Details Enterprise = free under the
 * 1,000/month tier (a 150-row sample stays free). No photo calls here.
 */
'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { GooglePlaces } = require('./lib/google-places');
const {
  nameSimilarity,
  distanceMeters,
  scoreMatch,
} = require('./lib/match-helpers');
const { ISRAEL_JOIN, ISRAEL_WHERE } = require('./lib/israel-filter');

// ── Budget guard (dry-run is free, but guard anyway) ──
const MAX_DETAILS_CALLS = 200;

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function buildClient() {
  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// All selections are scoped to Israel-only.
async function selectRows(c) {
  const idsArg = arg('--ids');
  const limit = arg('--limit');
  const coordCols = `r.id, r.name, r.address,
    ST_Y(r.location::geometry) as lat, ST_X(r.location::geometry) as lng`;
  const base = `from restaurants r ${ISRAEL_JOIN} where ${ISRAEL_WHERE}`;
  if (idsArg) {
    const ids = idsArg.split(',').map((x) => parseInt(x, 10)).filter(Boolean);
    const r = await c.query(
      `select ${coordCols} ${base} and r.id = any($1::int[]) order by r.id`,
      [ids],
    );
    return r.rows;
  }
  const randomN = arg('--random');
  if (randomN) {
    const r = await c.query(
      `select ${coordCols} ${base} order by random() limit $1`,
      [parseInt(randomN, 10)],
    );
    return r.rows;
  }
  // Stratified: 50 random + 50 shortest names + ~60 across destinations (Israel).
  const r = await c.query(`
    select ${coordCols} ${base} and r.id in (
      (select r2.id from restaurants r2 left join destinations d2 on d2.id=r2."destinationId"
        where (d2.country='Israel' or (r2."destinationId" is null and r2.country='Israel'))
        order by random() limit 50)
      union
      (select r2.id from restaurants r2 left join destinations d2 on d2.id=r2."destinationId"
        where (d2.country='Israel' or (r2."destinationId" is null and r2.country='Israel'))
        order by char_length(trim(r2.name)) asc, random() limit 50)
      union
      (select distinct on (r2."destinationId") r2.id from restaurants r2 left join destinations d2 on d2.id=r2."destinationId"
        where (d2.country='Israel' or (r2."destinationId" is null and r2.country='Israel'))
        order by r2."destinationId", random() limit 60)
    ) order by r.id`);
  const rows = r.rows;
  return limit ? rows.slice(0, parseInt(limit, 10)) : rows;
}

(async () => {
  const gp = new GooglePlaces(process.env.GOOGLE_PLACES_API_KEY, { rateMs: 150 });
  const c = buildClient();
  await c.connect();

  const rows = await selectRows(c);
  console.log(`Dry-run over ${rows.length} restaurants...\n`);

  const outDir = path.join(__dirname, '..', 'audit-output');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'dry-run-matches.csv');
  const header = [
    'id', 'old_name', 'google_name', 'name_sim',
    'old_address', 'google_address', 'distance_m',
    'business_status', 'google_phone', 'google_rating', 'google_rating_count',
    'has_photo', 'google_maps_uri', 'confidence', 'status', 'reason',
  ].join(',');
  const lines = [header];

  const tally = { verified: 0, flagged: 0, no_match: 0, error: 0 };
  let processed = 0;

  for (const r of rows) {
    if (gp.calls.details >= MAX_DETAILS_CALLS) {
      console.log(`\n[budget guard] reached MAX_DETAILS_CALLS=${MAX_DETAILS_CALLS}, stopping.`);
      break;
    }
    processed++;
    const query = `${r.name} ${r.address || ''}`.trim();
    let rec = {
      id: r.id, old_name: r.name, old_address: r.address,
      google_name: '', name_sim: '', google_address: '', distance_m: '',
      business_status: '', google_phone: '', google_rating: '',
      google_rating_count: '', has_photo: '', google_maps_uri: '',
      confidence: '', status: '', reason: '',
    };
    try {
      const placeId = await gp.findPlaceId(query, {
        lat: r.lat, lng: r.lng, radius: 500,
      });
      if (!placeId) {
        rec.status = 'no_match';
        rec.reason = 'text-search returned nothing';
        tally.no_match++;
      } else {
        const d = await gp.getDetails(placeId);
        const gName = d.displayName?.text || '';
        const gLat = d.location?.latitude;
        const gLng = d.location?.longitude;
        const distM = distanceMeters(r.lat, r.lng, gLat, gLng);
        const sim = nameSimilarity(r.name, gName);
        const { confidence, status, reason } = scoreMatch({
          nameSim: sim,
          distM,
          businessStatus: d.businessStatus,
        });
        rec = {
          ...rec,
          google_name: gName,
          name_sim: sim.toFixed(3),
          google_address: d.formattedAddress || '',
          distance_m: distM == null ? '' : Math.round(distM),
          business_status: d.businessStatus || '',
          google_phone: d.nationalPhoneNumber || d.internationalPhoneNumber || '',
          google_rating: d.rating ?? '',
          google_rating_count: d.userRatingCount ?? '',
          has_photo: d.photos && d.photos.length ? 'yes' : 'no',
          google_maps_uri: d.googleMapsUri || '',
          confidence,
          status,
          reason,
        };
        tally[status] = (tally[status] || 0) + 1;
      }
    } catch (e) {
      rec.status = 'error';
      rec.reason = e.message;
      tally.error++;
    }
    lines.push(
      [
        rec.id, rec.old_name, rec.google_name, rec.name_sim,
        rec.old_address, rec.google_address, rec.distance_m,
        rec.business_status, rec.google_phone, rec.google_rating,
        rec.google_rating_count, rec.has_photo, rec.google_maps_uri,
        rec.confidence, rec.status, rec.reason,
      ].map(csvEscape).join(','),
    );
    if (processed % 25 === 0) console.log(`  ...${processed}/${rows.length}`);
  }

  fs.writeFileSync(outFile, '﻿' + lines.join('\n') + '\n', 'utf8');
  await c.end();

  console.log('\n=== DRY-RUN SUMMARY ===');
  console.log('processed:', processed);
  console.log('tally:', JSON.stringify(tally));
  console.log('API calls:', JSON.stringify(gp.calls), '(text search free, details free under 1000/mo)');
  console.log('CSV:', path.relative(path.join(__dirname, '..'), outFile));
})().catch((e) => {
  console.error('Dry-run failed:', e.message);
  process.exit(1);
});
