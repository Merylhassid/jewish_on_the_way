'use strict';

/*
 * Delete France restaurants marked as duplicate_delete_candidate in
 * audit-output/foreign-fr-duplicate-resolution.csv.
 *
 * Safety:
 * - DRY-RUN by default.
 * - Deletes only duplicate_delete_candidate rows.
 * - Creates full-row backup before delete.
 * - Transaction + exact count verification.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const inputArg = process.argv[2] || 'audit-output/foreign-fr-duplicate-resolution.csv';
const APPLY = process.argv.includes('--apply');
const inputFile = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, '..', inputArg);

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

(async () => {
  if (!fs.existsSync(inputFile)) throw new Error(`missing CSV: ${inputFile}`);
  const rows = parseCsv(inputFile).filter((row) => row.duplicate_action === 'duplicate_delete_candidate');
  const ids = rows.map((row) => Number(row.id)).sort((a, b) => a - b);
  if (!ids.length) throw new Error('no duplicate_delete_candidate rows found');

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const existing = (await client.query(
    `select id, name, address, google_place_id, verification_status
       from restaurants
      where id = any($1)
      order by id`,
    [ids],
  )).rows;

  const backupRows = (await client.query(`select * from restaurants where id = any($1) order by id`, [ids])).rows;
  const backupFile = path.join(path.dirname(inputFile), 'foreign-fr-duplicate-delete-backup.json');
  fs.writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), count: backupRows.length, rows: backupRows }, null, 2), 'utf8');

  console.log(`=== DELETE FOREIGN FR DUPLICATES — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);
  console.log(`duplicate delete IDs: ${ids.join(', ')}`);
  console.log(`existing before delete: ${existing.length}/${ids.length}`);
  existing.forEach((row) => console.log(`  #${row.id} ${row.name} | ${row.address || ''} | status=${row.verification_status || ''} | pid=${row.google_place_id || ''}`));
  console.log(`backup: ${backupFile}`);

  if (!APPLY) {
    console.log('DRY-RUN only. Re-run with --apply to delete.');
    await client.end();
    return;
  }

  if (existing.length !== ids.length) {
    await client.end();
    throw new Error(`refusing to delete because existing ${existing.length} != expected ${ids.length}`);
  }
  const withGooglePlaceId = existing.filter((row) => row.google_place_id);
  if (withGooglePlaceId.length) {
    await client.end();
    throw new Error(`refusing to delete rows that already have google_place_id: ${withGooglePlaceId.map((row) => row.id).join(', ')}`);
  }

  await client.query('begin');
  try {
    const deleted = (await client.query(
      `delete from restaurants where id = any($1) returning id, name`,
      [ids],
    )).rows;
    if (deleted.length !== ids.length) throw new Error(`deleted ${deleted.length}, expected ${ids.length}`);
    await client.query('commit');
    console.log(`✓ deleted ${deleted.length} duplicate restaurants`);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    await client.end();
  }
})();
