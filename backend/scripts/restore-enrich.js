/*
 * Reverses an enrich run: restores original mutable fields from a backup JSON
 * and clears all Google/verification enrichment so the rows can be re-processed.
 *
 * Usage: node scripts/restore-enrich.js audit-output/enrich-backup-<ts>.json
 */
'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

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

(async () => {
  const file = process.argv[2];
  if (!file) throw new Error('Provide a backup JSON path');
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  const c = buildClient();
  await c.connect();
  let n = 0;
  for (const r of rows) {
    const hasCoords = r.lat != null && r.lng != null;
    await c.query(
      `update restaurants set
         name=$2, address=$3, phone=$4, rating=$5, opening_hours=$6,
         geocoded_at=$7,
         location = case when $8 then ST_SetSRID(ST_MakePoint($10,$9),4326)::geography else location end,
         lat = case when $8 then $9 else lat end,
         lng = case when $8 then $10 else lng end,
         google_display_name=null, google_formatted_address=null, google_lat=null,
         google_lng=null, google_business_status=null, google_maps_uri=null,
         google_rating_count=null, google_synced_at=null,
         verification_status='pending', verification_confidence=null,
         verification_reason=null
       where id=$1`,
      [r.id, r.name, r.address, r.phone, r.rating, r.opening_hours,
       r.geocoded_at, hasCoords, r.lat, r.lng],
    );
    n++;
  }
  await c.end();
  console.log(`restored ${n} rows from ${path.basename(file)}`);
})().catch((e) => {
  console.error('Restore failed:', e.message);
  process.exit(1);
});
