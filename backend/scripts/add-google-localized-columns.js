'use strict';

/*
 * Adds only the localized Google shadow columns.
 * This is intentionally narrower than `npm run migration:run`, which may run
 * unrelated pending migrations in this dirty workspace.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const SQL = [
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "google_display_name_he" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "google_formatted_address_he" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "google_display_name_en" text`,
  `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "google_formatted_address_en" text`,
];

(async () => {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await db.connect();
  try {
    await db.query('begin');
    for (const sql of SQL) {
      await db.query(sql);
    }
    await db.query('commit');
  } catch (err) {
    await db.query('rollback');
    throw err;
  } finally {
    await db.end();
  }

  console.log('Added/verified localized Google columns only:');
  for (const sql of SQL) {
    console.log(`- ${sql.match(/"google_[^"]+"/)[0]}`);
  }
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
