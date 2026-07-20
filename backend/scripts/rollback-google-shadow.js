/*
 * Rollback the Google shadow apply from a backup JSON produced by
 * apply-google-shadow.js. Restores ONLY the columns the apply touches, to their
 * exact pre-apply values (from the backup). DRY-RUN by default; --apply to write.
 * Usage: node scripts/rollback-google-shadow.js <apply-backup*.json> [--apply]
 */
'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const file = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!file) { console.error('usage: node scripts/rollback-google-shadow.js <backup.json> [--apply]'); process.exit(1); }

// exactly the columns apply-google-shadow.js writes
const COLS = ['google_place_id', 'google_maps_uri', 'google_display_name', 'google_formatted_address',
  'google_lat', 'google_lng', 'google_rating', 'google_rating_count', 'google_phone',
  'google_opening_hours', 'google_photo_name', 'google_photo_attribution', 'google_business_status',
  'google_primary_type', 'google_types', 'verification_status', 'google_synced_at'];

(async () => {
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = backup.rows || [];
  console.log(`=== ROLLBACK — ${APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)'} ===`);
  console.log(`backup taken: ${backup.takenAt} | rows to restore: ${rows.length}`);
  if (!APPLY) { console.log('\nDRY-RUN only. Re-run with --apply to restore these rows to their pre-apply values.'); return; }

  const c = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT || 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASS, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  await c.connect();
  let restored = 0;
  for (const r of rows) {
    const sets = [], vals = []; let i = 1;
    for (const col of COLS) { sets.push(`"${col}"=$${i++}`); vals.push(r[col] ?? null); }
    vals.push(r.id);
    await c.query(`update restaurants set ${sets.join(', ')} where id=$${i}`, vals);
    restored++;
  }
  console.log(`✓ RESTORED ${restored} rows to their pre-apply values.`);
  await c.end();
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
