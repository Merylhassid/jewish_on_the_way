/*
 * Verify + enrich existing restaurants from Google Places. Phase 1 = data only,
 * NO photo downloads (photos are phase 2).
 *
 * SAFETY: dry-run by default. Nothing is written to the DB unless --apply is
 * passed. In dry-run mode it still calls Google and produces the CSV log so you
 * can review exactly what WOULD change.
 *
 * Policy (conservative + coordinate-fix), applied only with --apply:
 *   verified  -> update address, phone, rating, opening_hours, coordinates (fix
 *                geocoding), business status, maps uri. Name only overwritten if
 *                the match is very strong AND we don't downgrade Hebrew->Latin.
 *   flagged   -> store google_* shadow fields only; DO NOT overwrite main fields.
 *   no_match  -> mark status only; leave main fields untouched.
 * Every processed row sets google_synced_at so the run is resumable and never
 * re-charges an already-processed row (unless --force).
 *
 * Usage:
 *   node scripts/verify-enrich.js                 # DRY-RUN over remaining rows
 *   node scripts/verify-enrich.js --limit 20      # dry-run, first 20
 *   node scripts/verify-enrich.js --apply         # REAL RUN (writes), resumable
 *   node scripts/verify-enrich.js --apply --force # re-process already-synced rows
 *   node scripts/verify-enrich.js --apply --ids 1,2,3
 *
 * The CSV log is written incrementally (per row), so it is complete even if the
 * process is interrupted. A summary is printed on normal exit AND on Ctrl-C /
 * termination.
 */
'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { GooglePlaces } = require('./lib/google-places');
const {
  nameSimilarity,
  normalizeName,
  distanceMeters,
  scoreMatch,
} = require('./lib/match-helpers');
const { ISRAEL_JOIN, ISRAEL_WHERE } = require('./lib/israel-filter');

// ── Budget guard ──
const MAX_DETAILS_CALLS = 7000; // whole DB is ~6.8k; guard against runaway
const DETAILS_UNIT_USD = 0.02; // Enterprise tier, worst case (ignores free tier)
const MAX_ESTIMATED_COST_USD = 200; // hard stop well below the $250 ceiling
const BATCH_LOG = 50;

const APPLY = process.argv.includes('--apply');
function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}
const hasFlag = (f) => process.argv.includes(f);

function buildClient() {
  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    keepAlive: true,
  });
}

// Neon (serverless) drops idle/long-lived connections. Connect with an attached
// error handler so a dropped socket never crashes the process via an unhandled
// 'error' event, and expose a reconnect + resilient-update helper for --apply.
async function connect() {
  const client = buildClient();
  client.on('error', (e) => console.error('[pg] connection error:', e.message));
  await client.connect();
  return client;
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Our stored name is unusable if it has < 3 letters or contains no letters.
function nameLooksBroken(name) {
  const n = normalizeName(name).replace(/[^\p{L}]/gu, '');
  return n.length < 3;
}

const hasHebrew = (s) => /[֐-׿]/.test(s || '');

// Overwrite our name only when it's clearly safe: our name is broken, OR the
// match is strong AND Google wouldn't downgrade a Hebrew name to a Latin
// transliteration (this app is Hebrew-first — keep the Hebrew name).
function shouldUpdateName(ours, google, sim) {
  if (nameLooksBroken(ours)) return true;
  if (sim < 0.85 || !google) return false;
  if (hasHebrew(ours) && !hasHebrew(google)) return false;
  return true;
}

// Every selection is scoped to Israel-only via ISRAEL_JOIN/ISRAEL_WHERE.
async function selectRows(c) {
  const coordCols = `r.id, r.name, r.address,
    ST_Y(r.location::geometry) as lat, ST_X(r.location::geometry) as lng`;
  const idsArg = arg('--ids');
  const limit = arg('--limit');
  if (idsArg) {
    const ids = idsArg.split(',').map((x) => parseInt(x, 10)).filter(Boolean);
    const r = await c.query(
      `select ${coordCols} from restaurants r ${ISRAEL_JOIN}
         where ${ISRAEL_WHERE} and r.id = any($1::int[]) order by r.id`,
      [ids],
    );
    return r.rows;
  }
  const syncedFilter = hasFlag('--force') ? '' : 'and r.google_synced_at is null';
  const r = await c.query(
    `select ${coordCols} from restaurants r ${ISRAEL_JOIN}
       where ${ISRAEL_WHERE} ${syncedFilter}
       order by r.id ${limit ? 'limit ' + parseInt(limit, 10) : ''}`,
  );
  return r.rows;
}

(async () => {
  const gp = new GooglePlaces(process.env.GOOGLE_PLACES_API_KEY, { rateMs: 150 });
  let c = await connect();

  // Resilient write: only runs in --apply; reconnects once on a dropped socket.
  async function dbRun(sql, params) {
    if (!APPLY) return;
    try {
      await c.query(sql, params);
    } catch (e) {
      if (/terminat|connection|ECONNRESET|ETIMEDOUT|socket/i.test(e.message)) {
        console.error('[pg] reconnecting after:', e.message);
        try { await c.end(); } catch { /* ignore */ }
        c = await connect();
        await c.query(sql, params);
      } else {
        throw e;
      }
    }
  }

  const outDir = path.join(__dirname, '..', 'audit-output');
  fs.mkdirSync(outDir, { recursive: true });

  // ── (6) Report Israel-scoped counts so we don't double-run ──
  const totalRow = await c.query('select count(*) c from restaurants');
  const ilRow = await c.query(
    `select count(*) c from restaurants r ${ISRAEL_JOIN} where ${ISRAEL_WHERE}`,
  );
  const syncedRow = await c.query(
    `select count(*) c from restaurants r ${ISRAEL_JOIN}
       where ${ISRAEL_WHERE} and r.google_synced_at is not null`,
  );
  const total = Number(totalRow.rows[0].c);
  const ilTotal = Number(ilRow.rows[0].c);
  const alreadySynced = Number(syncedRow.rows[0].c);

  const rows = await selectRows(c);

  console.log(`\n=== MODE: ${APPLY ? 'APPLY (writes to DB)' : 'DRY-RUN (no DB writes)'} — ISRAEL ONLY ===`);
  console.log(`total restaurants (all countries): ${total}`);
  console.log(`Israel restaurants: ${ilTotal}`);
  console.log(`Israel already google_synced_at: ${alreadySynced}  (skipped unless --force)`);
  console.log(`selected for this run (Israel): ${rows.length}`);
  console.log(`photos: OFF (phase 1)\n`);

  // ── (5) Backup + rollback command (only when we actually write) ──
  let backupFile = null;
  if (APPLY && rows.length) {
    backupFile = path.join(outDir, `enrich-backup-${Date.now()}.json`);
    const backup = await c.query(
      `select id, name, address, phone, rating, opening_hours,
              ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng, geocoded_at
         from restaurants where id = any($1::int[])`,
      [rows.map((r) => r.id)],
    );
    fs.writeFileSync(backupFile, JSON.stringify(backup.rows), 'utf8');
    const rel = path.relative(path.join(__dirname, '..'), backupFile);
    console.log(`backup written: ${rel}`);
    console.log(`ROLLBACK:  node scripts/restore-enrich.js ${rel}\n`);
  }

  // ── (3) CSV log opened now, header written, appended per row ──
  const stamp = Date.now();
  const logFile = path.join(
    outDir,
    `${APPLY ? 'enrich' : 'dryrun'}-log-${stamp}.csv`,
  );
  const HEADER =
    'id,status,confidence,name_sim,distance_m,old_name,google_name,name_updated,old_address,new_address,coords_fixed,reason';
  fs.writeFileSync(logFile, '﻿' + HEADER + '\n', 'utf8');
  const appendRow = (arr) => fs.appendFileSync(logFile, arr.join(',') + '\n', 'utf8');

  // Dry-run makes no DB calls inside the loop, so release the connection now
  // (avoids Neon dropping an idle socket over a long API-bound run).
  if (!APPLY) {
    await c.end();
  }

  const tally = { verified: 0, flagged: 0, no_match: 0, error: 0 };
  let processed = 0;
  let estCost = 0;
  let stopped = false;

  // ── (4) Accurate summary even if interrupted ──
  const relLog = path.relative(path.join(__dirname, '..'), logFile);
  function printSummary(interrupted) {
    console.log(`\n=== ${interrupted ? 'INTERRUPTED' : 'RUN COMPLETE'} (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
    console.log('processed:', processed, '/', rows.length);
    console.log('tally:', JSON.stringify(tally));
    console.log('API calls:', JSON.stringify(gp.calls));
    console.log(`est. billable cost (details, worst case): $${estCost.toFixed(2)}`);
    console.log('CSV log:', relLog, '(written incrementally — complete as of last processed row)');
    if (APPLY && backupFile) {
      console.log(`ROLLBACK:  node scripts/restore-enrich.js ${path.relative(path.join(__dirname, '..'), backupFile)}`);
    } else {
      console.log('no DB writes were made (dry-run).');
    }
  }

  // Handle Ctrl-C / termination: print summary from whatever we have on disk.
  const onSignal = (sig) => {
    if (stopped) return;
    stopped = true;
    console.log(`\n[signal ${sig}] stopping after current row...`);
  };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  for (const r of rows) {
    if (stopped) break;
    if (gp.calls.details >= MAX_DETAILS_CALLS) {
      console.log(`\n[budget] MAX_DETAILS_CALLS reached, stopping.`);
      break;
    }
    if (estCost >= MAX_ESTIMATED_COST_USD) {
      console.log(`\n[budget] MAX_ESTIMATED_COST_USD ($${MAX_ESTIMATED_COST_USD}) reached, stopping.`);
      break;
    }
    processed++;
    const query = `${r.name} ${r.address || ''}`.trim();
    try {
      const placeId = await gp.findPlaceId(query, { lat: r.lat, lng: r.lng, radius: 500 });
      if (!placeId) {
        await dbRun(
          `update restaurants set verification_status='no_match',
             verification_reason=$2, verification_confidence=0.2,
             google_synced_at=now() where id=$1`,
          [r.id, 'text-search returned nothing'],
        );
        tally.no_match++;
        appendRow([r.id, 'no_match', 0.2, '', '', csvEscape(r.name), '', 'no', csvEscape(r.address), '', 'no', 'no-candidate']);
        continue;
      }

      const d = await gp.getDetails(placeId);
      estCost += DETAILS_UNIT_USD;
      const gName = d.displayName?.text || '';
      const gLat = d.location?.latitude;
      const gLng = d.location?.longitude;
      const distM = distanceMeters(r.lat, r.lng, gLat, gLng);
      const sim = nameSimilarity(r.name, gName);
      const { confidence, status, reason } = scoreMatch({
        nameSim: sim, distM, businessStatus: d.businessStatus,
      });

      const hours = d.regularOpeningHours?.weekdayDescriptions?.join('; ') || null;
      const phone = d.nationalPhoneNumber || d.internationalPhoneNumber || null;
      const shadow = {
        gdn: gName || null,
        gfa: d.formattedAddress || null,
        glat: gLat ?? null,
        glng: gLng ?? null,
        gbs: d.businessStatus || null,
        gmu: d.googleMapsUri || null,
        grc: d.userRatingCount ?? null,
      };

      if (status === 'verified') {
        const updateName = shouldUpdateName(r.name, gName, sim);
        const coordsFixed = gLat != null && gLng != null;
        await dbRun(
          `update restaurants set
             google_display_name=$2, google_formatted_address=$3, google_lat=$4,
             google_lng=$5, google_business_status=$6, google_maps_uri=$7,
             google_rating_count=$8, google_synced_at=now(),
             verification_status='verified', verification_confidence=$9,
             verification_reason=$10,
             name = case when $11 then $12 else name end,
             address = coalesce($3, address),
             phone = coalesce($13, phone),
             rating = coalesce($14, rating),
             opening_hours = coalesce($15, opening_hours),
             lat = case when $16 then $4 else lat end,
             lng = case when $16 then $5 else lng end,
             location = case when $16 then ST_SetSRID(ST_MakePoint($5,$4),4326)::geography else location end,
             geocoded_at = case when $16 then now() else geocoded_at end
           where id=$1`,
          [
            r.id, shadow.gdn, shadow.gfa, shadow.glat, shadow.glng, shadow.gbs,
            shadow.gmu, shadow.grc, confidence, reason,
            updateName, gName || r.name, phone, d.rating ?? null, hours, coordsFixed,
          ],
        );
        tally.verified++;
        appendRow([r.id, 'verified', confidence, sim.toFixed(3), distM == null ? '' : Math.round(distM), csvEscape(r.name), csvEscape(gName), updateName ? 'yes' : 'no', csvEscape(r.address), csvEscape(shadow.gfa), coordsFixed ? 'yes' : 'no', csvEscape(reason)]);
      } else if (status === 'flagged') {
        await dbRun(
          `update restaurants set
             google_display_name=$2, google_formatted_address=$3, google_lat=$4,
             google_lng=$5, google_business_status=$6, google_maps_uri=$7,
             google_rating_count=$8, google_synced_at=now(),
             verification_status='flagged', verification_confidence=$9,
             verification_reason=$10 where id=$1`,
          [r.id, shadow.gdn, shadow.gfa, shadow.glat, shadow.glng, shadow.gbs, shadow.gmu, shadow.grc, confidence, reason],
        );
        tally.flagged++;
        appendRow([r.id, 'flagged', confidence, sim.toFixed(3), distM == null ? '' : Math.round(distM), csvEscape(r.name), csvEscape(gName), 'no', csvEscape(r.address), '', 'no', csvEscape(reason)]);
      } else {
        await dbRun(
          `update restaurants set verification_status='no_match',
             verification_confidence=$2, verification_reason=$3,
             google_synced_at=now() where id=$1`,
          [r.id, confidence, reason],
        );
        tally.no_match++;
        appendRow([r.id, 'no_match', confidence, sim.toFixed(3), distM == null ? '' : Math.round(distM), csvEscape(r.name), csvEscape(gName), 'no', csvEscape(r.address), '', 'no', csvEscape(reason)]);
      }
    } catch (e) {
      await dbRun(
        `update restaurants set verification_status='error', verification_reason=$2 where id=$1`,
        [r.id, e.message.slice(0, 300)],
      ).catch(() => {});
      tally.error++;
      appendRow([r.id, 'error', '', '', '', csvEscape(r.name), '', 'no', csvEscape(r.address), '', 'no', csvEscape(e.message)]);
    }
    if (processed % BATCH_LOG === 0) {
      console.log(`  ...${processed}/${rows.length}  verified=${tally.verified} flagged=${tally.flagged} no_match=${tally.no_match} err=${tally.error}  ~$${estCost.toFixed(2)}`);
    }
  }

  if (APPLY) {
    try { await c.end(); } catch { /* already closed */ }
  }
  printSummary(stopped);
})().catch((e) => {
  console.error('Enrich run failed:', e.message);
  process.exit(1);
});
