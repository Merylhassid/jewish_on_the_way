/*
 * Apply the VERIFIED Google shadow layer to the DB — offline, from the resolved
 * CSV only. NO Google API, NO LLM. DRY-RUN by default; writes only with --apply.
 *
 * Updates ONLY rows with resolved_final=verified. Writes ONLY google_* shadow
 * columns + verification_status='verified' + google_synced_at. NEVER touches
 * name / address / lat / lng / phone / rating / opening_hours / photo_* / tags.
 *
 * Usage:
 *   node scripts/apply-google-shadow.js <resolved.csv> [--limit N] [--apply]
 * Always writes (read-only, safe):
 *   <resolved>-apply-preview[-N].csv   preview of rows that would update
 *   <resolved>-apply-backup[-N].json   current DB state of those rows (rollback)
 */
'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const file = process.argv[2];
const arg = (f) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes('--apply');
const LIMIT = arg('--limit') ? parseInt(arg('--limit'), 10) : null;
if (!file) { console.error('usage: node scripts/apply-google-shadow.js <resolved.csv> [--limit N] [--apply]'); process.exit(1); }

// CSV column -> DB column. Originals (name/address/phone/rating/opening_hours/
// photo_*/lat/lng) are deliberately absent so they are never written.
const MAP = {
  google_place_id: 'google_place_id',
  google_maps_uri: 'google_maps_uri',
  google_name: 'google_display_name',
  google_address: 'google_formatted_address',
  google_lat: 'google_lat',
  google_lng: 'google_lng',
  google_rating: 'google_rating',
  rating_count: 'google_rating_count',
  google_phone: 'google_phone',
  opening_hours: 'google_opening_hours',
  photo_name: 'google_photo_name',
  photo_attribution: 'google_photo_attribution',
  business_status: 'google_business_status',
  google_primary_type: 'google_primary_type',
  google_types: 'google_types',
};
// CSV lacks a dedicated google_phone/google_rating column name — reuse the
// enriched columns actually present in the resolved CSV.
const CSV_ALIAS = { google_phone: 'google_phone', google_rating: 'google_rating' };
const NUMERIC = new Set(['google_lat', 'google_lng', 'google_rating', 'google_rating_count']);

function parseCsv(f) {
  const s = fs.readFileSync(f, 'utf8').replace(/^﻿/, '');
  const rows = []; let ff = [], c = '', q = false;
  for (let i = 0; i < s.length; i++) { const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { ff.push(c); c = ''; }
    else if (ch === '\n') { ff.push(c); rows.push(ff); ff = []; c = ''; }
    else if (ch !== '\r') c += ch; }
  if (c || ff.length) { ff.push(c); rows.push(ff); }
  return rows;
}
const csvEsc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

(async () => {
  const rows = parseCsv(file);
  const H = rows[0];
  const has = (n) => H.includes(n);
  const data = rows.slice(1).filter((r) => r.length >= H.length).map((r) => Object.fromEntries(H.map((h, i) => [h, r[i]])));
  const fin = (r) => r.resolved_final || r.final;

  let verified = data.filter((r) => fin(r) === 'verified').sort((a, b) => Number(a.id) - Number(b.id));
  const totalVerified = verified.length;
  if (LIMIT) verified = verified.slice(0, LIMIT);

  const c = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT || 5432, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASS, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  await c.connect();

  // which target columns actually exist in the DB right now
  const colsInDb = new Set((await c.query(
    `select column_name from information_schema.columns where table_name='restaurants'`,
  )).rows.map((r) => r.column_name));
  const targetCols = Object.values(MAP).filter((dbCol) => colsInDb.has(dbCol));
  const missingCols = Object.values(MAP).filter((dbCol) => !colsInDb.has(dbCol));

  // Israel scope + existence for the selected ids
  const ids = verified.map((r) => Number(r.id));
  const dbRows = (await c.query(
    `select r.id, r.google_place_id, r.verification_status, r.google_synced_at,
            (d.country='Israel' OR (r."destinationId" IS NULL AND r.country='Israel')) AS is_israel
       from restaurants r left join destinations d on d.id=r."destinationId"
      where r.id = ANY($1)`, [ids],
  )).rows;
  const dbById = new Map(dbRows.map((r) => [Number(r.id), r]));

  // place_id already used by a DIFFERENT restaurant (UNIQUE constraint risk)
  const pids = verified.map((r) => r.google_place_id).filter(Boolean);
  const pidOwners = (await c.query(
    `select id, google_place_id from restaurants where google_place_id = ANY($1)`, [pids],
  )).rows;
  const pidOwner = new Map(pidOwners.map((r) => [r.google_place_id, Number(r.id)]));

  // dup place_id within our own selected set
  const seenPid = new Map();
  verified.forEach((r) => seenPid.set(r.google_place_id, (seenPid.get(r.google_place_id) || 0) + 1));

  const skips = { not_in_db: [], not_israel: [], missing_place_id: [], dup_in_set: [], pid_conflict_other_row: [] };
  const willUpdate = [];
  for (const r of verified) {
    const id = Number(r.id);
    const db = dbById.get(id);
    if (!db) { skips.not_in_db.push(id); continue; }
    if (!db.is_israel) { skips.not_israel.push(id); continue; }
    if (!r.google_place_id) { skips.missing_place_id.push(id); continue; }
    if (seenPid.get(r.google_place_id) > 1) { skips.dup_in_set.push(id); continue; }
    const owner = pidOwner.get(r.google_place_id);
    if (owner != null && owner !== id) { skips.pid_conflict_other_row.push(`${id}->${r.google_place_id} owned by #${owner}`); continue; }
    willUpdate.push(r);
  }

  // preview CSV (requested columns) — [displayName, csvSourceKey]
  const suffix = LIMIT ? `-${LIMIT}` : '';
  // derive output names safely for ANY input filename (never overwrite the input)
  const baseNoExt = file.replace(/\.csv$/i, '').replace(/-resolved$/i, '');
  const previewCols = [
    ['id', 'id'], ['old_name', 'old_name'], ['old_address', 'old_address'],
    ['google_name', 'google_name'], ['google_address', 'google_address'],
    ['google_place_id', 'google_place_id'], ['google_rating', 'google_rating'],
    ['google_phone', 'google_phone'], ['google_photo_name', 'photo_name'],
  ];
  const previewFile = `${baseNoExt}-apply-preview${suffix}.csv`;
  fs.writeFileSync(previewFile, '﻿' + [previewCols.map((p) => p[0]).join(','),
    ...willUpdate.map((r) => previewCols.map(([, src]) => csvEsc(r[src])).join(','))].join('\n') + '\n', 'utf8');

  // backup current DB state of the rows that would update (full row) — rollback source
  const backupIds = willUpdate.map((r) => Number(r.id));
  const backup = backupIds.length ? (await c.query(`select * from restaurants where id = ANY($1)`, [backupIds])).rows : [];
  const backupFile = `${baseNoExt}-apply-backup${suffix}.json`;
  fs.writeFileSync(backupFile, JSON.stringify({ takenAt: new Date().toISOString(), count: backup.length, rows: backup }, null, 2), 'utf8');

  console.log('=== APPLY GOOGLE SHADOW — ' + (APPLY ? 'APPLY (writes)' : 'DRY-RUN (no writes)') + ' ===');
  console.log(`resolved_final=verified in CSV: ${totalVerified}` + (LIMIT ? ` | limited to first ${LIMIT}` : ''));
  console.log(`selected: ${verified.length}  ->  would UPDATE: ${willUpdate.length}`);
  console.log('skips:');
  console.log(`   not found in DB:            ${skips.not_in_db.length}`);
  console.log(`   not Israel-scoped:         ${skips.not_israel.length}`);
  console.log(`   missing google_place_id:   ${skips.missing_place_id.length}`);
  console.log(`   dup place_id within set:   ${skips.dup_in_set.length}` + (skips.dup_in_set.length ? ` (${skips.dup_in_set.slice(0, 5).join(',')})` : ''));
  console.log(`   place_id owned by another: ${skips.pid_conflict_other_row.length}` + (skips.pid_conflict_other_row.length ? `\n     ${skips.pid_conflict_other_row.slice(0, 8).join('\n     ')}` : ''));
  console.log(`columns that WOULD be written (${targetCols.length}): ${targetCols.join(', ')}, verification_status, google_synced_at`);
  if (missingCols.length) console.log(`⚠ columns NOT YET in DB (need migration): ${missingCols.join(', ')}`);
  console.log(`preview CSV: ${path.relative(path.join(__dirname, '..'), previewFile)} (${willUpdate.length} rows)`);
  console.log(`backup JSON: ${path.relative(path.join(__dirname, '..'), backupFile)} (${backup.length} rows)`);

  if (!APPLY) { console.log('\nDRY-RUN only — no rows written. Re-run with --apply to write.'); await c.end(); return; }

  if (missingCols.length) { console.error(`\n✗ REFUSING to apply: ${missingCols.length} target columns missing. Run the migration first.`); await c.end(); process.exit(1); }

  // ── real write (only with --apply) ──
  let written = 0;
  for (const r of willUpdate) {
    const sets = [], vals = []; let i = 1;
    for (const [csvCol, dbCol] of Object.entries(MAP)) {
      const src = CSV_ALIAS[csvCol] || csvCol;
      let v = has(src) ? r[src] : '';
      if (v === '' || v == null) v = null;
      else if (NUMERIC.has(dbCol)) v = Number(v);
      sets.push(`"${dbCol}"=$${i++}`); vals.push(v);
    }
    sets.push(`"verification_status"=$${i++}`); vals.push('verified');
    sets.push(`"google_synced_at"=now()`);
    vals.push(Number(r.id));
    await c.query(`update restaurants set ${sets.join(', ')} where id=$${i}`, vals);
    written++;
  }
  console.log(`\n✓ APPLIED: ${written} rows updated (google_* shadow + verification_status='verified').`);
  await c.end();
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
