'use strict';

/*
 * Apply Cloudinary photo URLs to restaurant photo shadow/display fields.
 *
 * Default mode is dry-run. Use --apply to write.
 * Only updates:
 *   photo_url, photo_attribution, photo_source, photo_fetched_at
 *
 * It never changes source name/address/lat/lng or Google shadow fields.
 *
 * Usage:
 *   node scripts/apply-cloudinary-photo-urls.js audit-output/google-photos-cloudinary-bulk-final-2415.csv
 *   node scripts/apply-cloudinary-photo-urls.js audit-output/google-photos-cloudinary-bulk-final-2415.csv --apply
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const inputArg = process.argv[2];
const APPLY = process.argv.includes('--apply');
const OVERWRITE_EXISTING = process.argv.includes('--overwrite-existing');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes && ch === '"' && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && ch === ',') {
      row.push(cell);
      cell = '';
    } else if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) return [];
  rows[0][0] = rows[0][0].replace(/^\ufeff/, '');
  const headers = rows[0];
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, columns, rows) {
  fs.writeFileSync(
    file,
    '\ufeff' + [columns.join(','), ...rows.map((row) => columns.map((col) => csvEsc(row[col])).join(','))].join('\n') + '\n',
    'utf8',
  );
}

function resolveInput(file) {
  if (!file) throw new Error('Missing CSV path');
  const direct = path.resolve(process.cwd(), file);
  if (fs.existsSync(direct)) return direct;
  const backendRelative = path.resolve(__dirname, '..', file);
  if (fs.existsSync(backendRelative)) return backendRelative;
  throw new Error(`CSV not found: ${file}`);
}

(async () => {
  const inputFile = resolveInput(inputArg);
  const rows = parseCsv(fs.readFileSync(inputFile, 'utf8'));
  const okRows = rows.filter((row) => row.status === 'ok' && row.id && row.cloudinary_url);
  const seen = new Set();
  const duplicateIds = [];
  for (const row of okRows) {
    if (seen.has(row.id)) duplicateIds.push(row.id);
    seen.add(row.id);
  }
  if (duplicateIds.length) {
    throw new Error(`Duplicate ids in CSV: ${duplicateIds.slice(0, 10).join(', ')}`);
  }

  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await db.connect();

  const ids = okRows.map((row) => Number(row.id));
  const dbRows = ids.length
    ? (await db.query(
      `select id, name, verification_status, google_photo_name,
              photo_url, photo_attribution, photo_source, photo_fetched_at
         from restaurants
        where id = any($1::int[])`,
      [ids],
    )).rows
    : [];
  const byId = new Map(dbRows.map((row) => [String(row.id), row]));

  const previewRows = [];
  const backupRows = [];
  const updates = [];
  const skips = {
    csvNotOk: rows.length - okRows.length,
    notFound: 0,
    notVerified: 0,
    photoNameMismatch: 0,
    existingNonGooglePhoto: 0,
    missingUrl: 0,
  };

  for (const row of okRows) {
    const dbRow = byId.get(row.id);
    let action = 'update';
    let reason = '';
    if (!row.cloudinary_url) {
      action = 'skip';
      reason = 'missing cloudinary_url';
      skips.missingUrl += 1;
    } else if (!dbRow) {
      action = 'skip';
      reason = 'not found in DB';
      skips.notFound += 1;
    } else if (dbRow.verification_status !== 'verified') {
      action = 'skip';
      reason = `verification_status=${dbRow.verification_status}`;
      skips.notVerified += 1;
    } else if (dbRow.google_photo_name !== row.google_photo_name) {
      action = 'skip';
      reason = 'google_photo_name mismatch';
      skips.photoNameMismatch += 1;
    } else if (dbRow.photo_url && dbRow.photo_source && dbRow.photo_source !== 'google' && !OVERWRITE_EXISTING) {
      action = 'skip';
      reason = `existing non-google photo_source=${dbRow.photo_source}`;
      skips.existingNonGooglePhoto += 1;
    }

    const preview = {
      id: row.id,
      name: dbRow?.name ?? row.name,
      action,
      reason,
      old_photo_url: dbRow?.photo_url ?? '',
      old_photo_source: dbRow?.photo_source ?? '',
      new_photo_url: row.cloudinary_url,
      new_photo_source: 'google',
      new_photo_attribution: row.google_photo_attribution,
      google_photo_name: row.google_photo_name,
    };
    previewRows.push(preview);

    if (action === 'update') {
      backupRows.push({
        id: dbRow.id,
        name: dbRow.name,
        photo_url: dbRow.photo_url,
        photo_attribution: dbRow.photo_attribution,
        photo_source: dbRow.photo_source,
        photo_fetched_at: dbRow.photo_fetched_at,
      });
      updates.push({
        id: dbRow.id,
        photo_url: row.cloudinary_url,
        photo_attribution: row.google_photo_attribution || null,
        photo_source: 'google',
      });
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, '..', 'audit-output');
  const previewFile = path.join(outDir, `cloudinary-photo-urls-apply-preview-${stamp}.csv`);
  const backupFile = path.join(outDir, `cloudinary-photo-urls-apply-backup-${stamp}.json`);
  writeCsv(
    previewFile,
    ['id', 'name', 'action', 'reason', 'old_photo_url', 'old_photo_source', 'new_photo_url', 'new_photo_source', 'new_photo_attribution', 'google_photo_name'],
    previewRows,
  );
  fs.writeFileSync(
    backupFile,
    JSON.stringify({ takenAt: new Date().toISOString(), sourceCsv: path.relative(path.join(__dirname, '..'), inputFile), count: backupRows.length, rows: backupRows }, null, 2),
    'utf8',
  );

  if (APPLY) {
    await db.query('begin');
    try {
      await db.query(
        `with data as (
           select *
             from jsonb_to_recordset($1::jsonb)
                  as x(id int, photo_url text, photo_attribution text, photo_source text)
         )
         update restaurants r
            set photo_url = data.photo_url,
                photo_attribution = data.photo_attribution,
                photo_source = data.photo_source,
                photo_fetched_at = now()
           from data
          where r.id = data.id`,
        [JSON.stringify(updates)],
      );
      await db.query('commit');
    } catch (err) {
      await db.query('rollback');
      throw err;
    }
  }

  await db.end();

  console.log(`=== APPLY CLOUDINARY PHOTO URLS — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);
  console.log(`csv rows: ${rows.length}`);
  console.log(`ok rows: ${okRows.length}`);
  console.log(`would update: ${updates.length}`);
  console.log('skips:');
  console.log(`  csv not ok:              ${skips.csvNotOk}`);
  console.log(`  not found in DB:         ${skips.notFound}`);
  console.log(`  not verified:            ${skips.notVerified}`);
  console.log(`  photo name mismatch:     ${skips.photoNameMismatch}`);
  console.log(`  existing non-google:     ${skips.existingNonGooglePhoto}`);
  console.log(`  missing URL:             ${skips.missingUrl}`);
  console.log(`preview CSV: ${path.relative(path.join(__dirname, '..'), previewFile)}`);
  console.log(`backup JSON: ${path.relative(path.join(__dirname, '..'), backupFile)}`);
  console.log(APPLY ? 'DB WRITES DONE.' : 'NO DB WRITES.');
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
