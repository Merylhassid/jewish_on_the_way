'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

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
  const { rows } = await db.query(`
    select count(*)::int as total,
           count(google_display_name_he)::int as name_he,
           count(google_formatted_address_he)::int as address_he,
           count(google_display_name_en)::int as name_en,
           count(google_formatted_address_en)::int as address_en
      from restaurants
     where verification_status = 'verified'
       and google_place_id is not null
  `);
  console.table(rows);
  await db.end();
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
