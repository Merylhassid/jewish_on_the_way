'use strict';

/*
 * Apply foreign Google shadow layer from a user-decisions CSV.
 *
 * Safety:
 * - DRY-RUN by default; writes only with --apply.
 * - Updates only rows with decision=apply_google_shadow.
 * - Writes only google_* shadow fields + verification_status/google_synced_at.
 * - Never touches original name/address/lat/lng/phone/rating/opening_hours/photo_url.
 * - Creates full-row backup JSON before any write.
 *
 * Usage:
 *   node scripts/apply-foreign-google-shadow.js audit-output/foreign-fr-user-decisions.csv
 *   node scripts/apply-foreign-google-shadow.js audit-output/foreign-fr-user-decisions.csv --apply
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const inputArg = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!inputArg) {
  console.error('usage: node scripts/apply-foreign-google-shadow.js <decisions.csv> [--apply]');
  process.exit(1);
}

const inputFile = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, '..', inputArg);

const DB_COLS = [
  'google_place_id',
  'google_maps_uri',
  'google_display_name',
  'google_formatted_address',
  'google_display_name_en',
  'google_formatted_address_en',
  'google_lat',
  'google_lng',
  'google_rating',
  'google_rating_count',
  'google_phone',
  'google_opening_hours',
  'google_photo_name',
  'google_photo_attribution',
  'google_business_status',
  'google_primary_type',
  'google_types',
];

const NUMERIC = new Set(['google_lat', 'google_lng', 'google_rating', 'google_rating_count']);

function parseCsv(file) {
  const s = fs.readFileSync(file, 'utf8').replace(/^\ufeff/, '');
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  const header = rows[0] || [];
  return rows.slice(1).filter((r) => r.length >= header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function valueFor(row, dbCol) {
  const map = {
    google_place_id: row.place_id,
    google_maps_uri: row.google_maps_uri,
    google_display_name: row.google_name,
    google_formatted_address: row.google_address,
    google_display_name_en: row.google_name,
    google_formatted_address_en: row.google_address,
    google_lat: row.google_lat,
    google_lng: row.google_lng,
    google_rating: row.google_rating,
    google_rating_count: row.google_rating_count,
    google_phone: row.google_phone,
    google_opening_hours: row.google_opening_hours,
    google_photo_name: row.google_photo_name,
    google_photo_attribution: row.google_photo_attribution,
    google_business_status: row.business_status,
    google_primary_type: row.google_primary_type,
    google_types: row.google_types,
  };
  let v = map[dbCol];
  if (v === '' || v == null) return null;
  if (NUMERIC.has(dbCol)) return Number(v);
  return v;
}

(async () => {
  const rows = parseCsv(inputFile);
  const selected = rows
    .filter((row) => row.decision === 'apply_google_shadow')
    .sort((a, b) => Number(a.id) - Number(b.id));

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const ids = selected.map((row) => Number(row.id));
  const dbRows = ids.length
    ? (await client.query(
      `select r.id, r.google_place_id, r.verification_status, d.country_code
         from restaurants r
         left join destinations d on d.id = r."destinationId"
        where r.id = ANY($1)`,
      [ids],
    )).rows
    : [];
  const dbById = new Map(dbRows.map((row) => [Number(row.id), row]));

  const pids = selected.map((row) => row.place_id).filter(Boolean);
  const pidOwners = pids.length
    ? (await client.query(`select id, google_place_id from restaurants where google_place_id = ANY($1)`, [pids])).rows
    : [];
  const pidOwner = new Map(pidOwners.map((row) => [row.google_place_id, Number(row.id)]));
  const pidCounts = new Map();
  selected.forEach((row) => pidCounts.set(row.place_id, (pidCounts.get(row.place_id) || 0) + 1));

  const skips = {
    not_in_db: [],
    missing_place_id: [],
    duplicate_in_set: [],
    place_id_owned_by_other: [],
  };
  const willUpdate = [];
  for (const row of selected) {
    const id = Number(row.id);
    if (!dbById.has(id)) {
      skips.not_in_db.push(id);
      continue;
    }
    if (!row.place_id) {
      skips.missing_place_id.push(id);
      continue;
    }
    if (pidCounts.get(row.place_id) > 1) {
      skips.duplicate_in_set.push(id);
      continue;
    }
    const owner = pidOwner.get(row.place_id);
    if (owner != null && owner !== id) {
      skips.place_id_owned_by_other.push(`${id}->${row.place_id} owned by #${owner}`);
      continue;
    }
    willUpdate.push(row);
  }

  const baseNoExt = inputFile.replace(/\.csv$/i, '');
  const previewFile = `${baseNoExt}-apply-preview.csv`;
  const backupFile = `${baseNoExt}-apply-backup.json`;
  const previewCols = [
    'id',
    'old_name',
    'old_address',
    'google_name',
    'google_address',
    'place_id',
    'google_rating',
    'google_rating_count',
    'google_phone',
    'google_photo_name',
  ];
  fs.writeFileSync(
    previewFile,
    '\ufeff' + [previewCols.join(','), ...willUpdate.map((row) => previewCols.map((col) => csvEsc(row[col])).join(','))].join('\n') + '\n',
    'utf8',
  );

  const backupRows = willUpdate.length
    ? (await client.query(`select * from restaurants where id = ANY($1)`, [willUpdate.map((row) => Number(row.id))])).rows
    : [];
  fs.writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), count: backupRows.length, rows: backupRows }, null, 2), 'utf8');

  console.log(`=== APPLY FOREIGN GOOGLE SHADOW — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);
  console.log(`selected: ${selected.length} -> would update: ${willUpdate.length}`);
  console.log('skips:', skips);
  console.log(`preview: ${previewFile}`);
  console.log(`backup: ${backupFile}`);
  console.log(`columns: ${DB_COLS.join(', ')}, verification_status, google_synced_at`);

  if (!APPLY) {
    console.log('DRY-RUN only. Re-run with --apply to write.');
    await client.end();
    return;
  }

  let written = 0;
  await client.query('begin');
  try {
    for (const row of willUpdate) {
      const vals = [];
      const sets = [];
      let i = 1;
      for (const col of DB_COLS) {
        sets.push(`"${col}"=$${i++}`);
        vals.push(valueFor(row, col));
      }
      sets.push(`"verification_status"=$${i++}`);
      vals.push('verified');
      sets.push(`"google_synced_at"=now()`);
      vals.push(Number(row.id));
      await client.query(`update restaurants set ${sets.join(', ')} where id=$${i}`, vals);
      written += 1;
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    await client.end();
  }

  console.log(`✓ APPLIED ${written} rows.`);
})();
