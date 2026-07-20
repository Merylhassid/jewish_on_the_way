'use strict';

/*
 * Delete France restaurants explicitly marked by the user as delete candidates.
 *
 * Safety:
 * - DRY-RUN by default.
 * - Deletes only rows with decision=delete_restaurant_candidate in the decisions CSV.
 * - Requires the prepared full backup JSON to exist.
 * - Uses a transaction and verifies the exact affected count.
 *
 * Usage:
 *   node scripts/delete-foreign-fr-candidates.js audit-output/foreign-fr-user-decisions.csv
 *   node scripts/delete-foreign-fr-candidates.js audit-output/foreign-fr-user-decisions.csv --apply
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const inputArg = process.argv[2] || 'audit-output/foreign-fr-user-decisions.csv';
const APPLY = process.argv.includes('--apply');
const inputFile = path.isAbsolute(inputArg) ? inputArg : path.join(__dirname, '..', inputArg);
const backupFile = path.join(path.dirname(inputFile), 'foreign-fr-delete-candidates-backup.json');

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
  if (!fs.existsSync(inputFile)) throw new Error(`missing decisions CSV: ${inputFile}`);
  if (!fs.existsSync(backupFile)) throw new Error(`missing delete backup JSON: ${backupFile}`);

  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const rows = parseCsv(inputFile).filter((row) => row.decision === 'delete_restaurant_candidate');
  const ids = rows.map((row) => Number(row.id)).sort((a, b) => a - b);
  const backupIds = (backup.rows || []).map((row) => Number(row.id)).sort((a, b) => a - b);

  if (ids.length === 0) throw new Error('no delete candidates found');
  if (ids.length !== backupIds.length || ids.some((id, i) => id !== backupIds[i])) {
    throw new Error(`backup IDs do not match delete IDs. delete=${ids.join(',')} backup=${backupIds.join(',')}`);
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

  const existing = (await client.query(
    `select id, name, address from restaurants where id = any($1) order by id`,
    [ids],
  )).rows;

  console.log(`=== DELETE FOREIGN FR CANDIDATES — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);
  console.log(`delete IDs: ${ids.join(', ')}`);
  console.log(`existing before delete: ${existing.length}/${ids.length}`);
  existing.forEach((row) => console.log(`  #${row.id} ${row.name} | ${row.address || ''}`));
  console.log(`backup: ${backupFile}`);

  if (!APPLY) {
    console.log('DRY-RUN only. Re-run with --apply to delete.');
    await client.end();
    return;
  }

  if (existing.length !== ids.length) {
    await client.end();
    throw new Error('refusing to delete because not all IDs exist');
  }

  await client.query('begin');
  try {
    const deleted = (await client.query(
      `delete from restaurants where id = any($1) returning id, name`,
      [ids],
    )).rows;
    if (deleted.length !== ids.length) {
      throw new Error(`deleted ${deleted.length}, expected ${ids.length}`);
    }
    await client.query('commit');
    console.log(`✓ deleted ${deleted.length} restaurants`);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    await client.end();
  }
})();
