'use strict';

/*
 * Delete explicit restaurant IDs only.
 *
 * Safety:
 * - DRY-RUN by default.
 * - Requires comma-separated IDs as first argument.
 * - Creates full-row backup before delete.
 * - Transaction + exact count verification.
 *
 * Usage:
 *   node scripts/delete-specific-restaurants.js 8265
 *   node scripts/delete-specific-restaurants.js 8265 --apply
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const idsArg = process.argv[2];
const APPLY = process.argv.includes('--apply');

if (!idsArg) {
  console.error('usage: node scripts/delete-specific-restaurants.js <id[,id...]> [--apply]');
  process.exit(1);
}

const ids = idsArg
  .split(',')
  .map((x) => Number(x.trim()))
  .filter((x) => Number.isInteger(x) && x > 0)
  .sort((a, b) => a - b);

if (!ids.length) {
  console.error('no valid IDs provided');
  process.exit(1);
}

(async () => {
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
  const backupFile = path.join(__dirname, '..', 'audit-output', `delete-specific-restaurants-${ids.join('-')}-backup.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), count: backupRows.length, rows: backupRows }, null, 2), 'utf8');

  console.log(`=== DELETE SPECIFIC RESTAURANTS — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);
  console.log(`delete IDs: ${ids.join(', ')}`);
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

  await client.query('begin');
  try {
    const deleted = (await client.query(
      `delete from restaurants where id = any($1) returning id, name`,
      [ids],
    )).rows;
    if (deleted.length !== ids.length) throw new Error(`deleted ${deleted.length}, expected ${ids.length}`);
    await client.query('commit');
    console.log(`✓ deleted ${deleted.length} restaurants`);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    await client.end();
  }
})();
