/**
 * dedup.js – removes duplicate synagogues for destination 348 (Tel Aviv)
 * Keeps the record that has "תל אביב" in the address; otherwise keeps latest.
 *
 * Usage:  node dedup.js
 *         node dedup.js --dry-run   (preview only, no deletions)
 */

'use strict';

const { Client } = require('pg');

const DRY_RUN = process.argv.includes('--dry-run');
const DESTINATION_ID = 348;

const client = new Client({
  host:     'ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech',
  port:     5432,
  database: 'neondb',
  user:     'neondb_owner',
  password: 'npg_4sdzL2HpDruE',
  ssl:      { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Connected to DB\n');

  // ── Step 1: preview duplicates ──────────────────────────────────────────────
  const preview = await client.query(`
    SELECT
      "normalizedName",
      COUNT(*)                        AS copies,
      array_agg(id ORDER BY id)       AS ids,
      array_agg(address ORDER BY id)  AS addresses
    FROM synagogues
    WHERE "destinationId" = $1
    GROUP BY "normalizedName"
    HAVING COUNT(*) > 1
    ORDER BY copies DESC
  `, [DESTINATION_ID]);

  if (preview.rows.length === 0) {
    console.log('No duplicates found — nothing to do.');
    await client.end();
    return;
  }

  let totalDuplicates = 0;
  preview.rows.forEach(r => { totalDuplicates += Number(r.copies) - 1; });

  console.log(`Found ${preview.rows.length} names with duplicates (${totalDuplicates} extra rows to delete):\n`);
  preview.rows.slice(0, 10).forEach(r => {
    console.log(`  "${r.normalizedname}"  →  ${r.copies} copies  (ids: ${r.ids.join(', ')})`);
    r.addresses.forEach((a, i) => console.log(`      [${r.ids[i]}] ${a ?? '(no address)'}`));
  });
  if (preview.rows.length > 10) {
    console.log(`  ... and ${preview.rows.length - 10} more\n`);
  }

  if (DRY_RUN) {
    console.log('\nDry run — no changes made. Remove --dry-run to execute.');
    await client.end();
    return;
  }

  // ── Step 2: delete duplicates, keep the one with תל אביב (or latest) ───────
  console.log('\nDeleting duplicates...');
  const del = await client.query(`
    DELETE FROM synagogues
    WHERE "destinationId" = $1
      AND id NOT IN (
        SELECT DISTINCT ON (COALESCE("normalizedName", id::text))
          id
        FROM synagogues
        WHERE "destinationId" = $1
        ORDER BY
          COALESCE(NULLIF("normalizedName", ''), id::text),
          CASE WHEN address LIKE '%תל אביב%' THEN 0 ELSE 1 END ASC,
          id DESC
      )
  `, [DESTINATION_ID]);

  console.log(`Deleted ${del.rowCount} duplicate rows ✓`);

  // ── Step 3: verify ──────────────────────────────────────────────────────────
  const verify = await client.query(`
    SELECT COUNT(*) AS remaining
    FROM synagogues
    WHERE "destinationId" = $1
  `, [DESTINATION_ID]);

  console.log(`Remaining synagogues for destination ${DESTINATION_ID}: ${verify.rows[0].remaining}`);

  await client.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
