'use strict';

/*
 * Overwrite core restaurant fields from a Google dry-run/decision CSV.
 *
 * This is intentionally NOT the default enrichment path. Use only for rows
 * explicitly approved by the user for replacing source data.
 *
 * Updates only IDs provided via --ids:
 * - name = google_name
 * - address = google_address
 * - lat/lng/location = google_lat/google_lng
 *
 * DRY-RUN by default; use --apply to write.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const inputArg = process.argv[2];
const idsArg = process.argv[process.argv.indexOf('--ids') + 1];
const APPLY = process.argv.includes('--apply');

if (!inputArg || !idsArg || process.argv.indexOf('--ids') < 0) {
  console.error('usage: node scripts/overwrite-core-from-google-csv.js <csv> --ids 1,2,3 [--apply]');
  process.exit(1);
}

const inputFile = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, '..', inputArg);
const ids = new Set(idsArg.split(',').map((x) => String(Number(x.trim()))).filter((x) => x !== 'NaN' && x !== '0'));

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

(async () => {
  const selected = parseCsv(inputFile)
    .filter((row) => ids.has(String(Number(row.id))))
    .sort((a, b) => Number(a.id) - Number(b.id));

  if (selected.length !== ids.size) {
    throw new Error(`selected ${selected.length} rows from CSV, expected ${ids.size}`);
  }
  for (const row of selected) {
    if (!row.google_name || !row.google_address || !row.google_lat || !row.google_lng) {
      throw new Error(`row #${row.id} missing google name/address/lat/lng`);
    }
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const numericIds = selected.map((row) => Number(row.id));
  const dbRows = (await client.query(
    `select * from restaurants where id = any($1) order by id`,
    [numericIds],
  )).rows;
  const byId = new Map(dbRows.map((row) => [Number(row.id), row]));

  const outDir = path.join(__dirname, '..', 'audit-output');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(outDir, `overwrite-core-from-google-backup-${stamp}.json`);
  const previewFile = path.join(outDir, `overwrite-core-from-google-preview-${stamp}.csv`);
  fs.writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), sourceCsv: path.relative(path.join(__dirname, '..'), inputFile), ids: numericIds, count: dbRows.length, rows: dbRows }, null, 2), 'utf8');

  const previewRows = selected.map((row) => {
    const db = byId.get(Number(row.id)) || {};
    return {
      id: row.id,
      old_name: db.name || '',
      new_name: row.google_name,
      old_address: db.address || '',
      new_address: row.google_address,
      old_lat: db.lat ?? '',
      new_lat: row.google_lat,
      old_lng: db.lng ?? '',
      new_lng: row.google_lng,
    };
  });
  const previewCols = ['id', 'old_name', 'new_name', 'old_address', 'new_address', 'old_lat', 'new_lat', 'old_lng', 'new_lng'];
  fs.writeFileSync(previewFile, '\ufeff' + [previewCols.join(','), ...previewRows.map((row) => previewCols.map((col) => csvEsc(row[col])).join(','))].join('\n') + '\n', 'utf8');

  console.log(`=== OVERWRITE CORE FROM GOOGLE — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);
  console.log(`selected: ${selected.length}`);
  console.log(`backup: ${backupFile}`);
  console.log(`preview: ${previewFile}`);
  selected.forEach((row) => console.log(`#${row.id}: ${row.old_name} -> ${row.google_name} | ${row.google_address}`));

  if (!APPLY) {
    console.log('DRY-RUN only. Re-run with --apply to write.');
    await client.end();
    return;
  }

  if (dbRows.length !== selected.length) {
    await client.end();
    throw new Error(`found ${dbRows.length} DB rows, expected ${selected.length}`);
  }

  await client.query('begin');
  try {
    for (const row of selected) {
      await client.query(
        `update restaurants
            set name = $1,
                address = $2,
                lat = $3,
                lng = $4,
                location = ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography
          where id = $5`,
        [row.google_name, row.google_address, Number(row.google_lat), Number(row.google_lng), Number(row.id)],
      );
    }
    await client.query('commit');
    console.log(`✓ updated core fields for ${selected.length} rows`);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    await client.end();
  }
})();
