'use strict';

/*
 * Read-only country breakdown for non-Israel restaurants.
 * No Google API calls, no DB writes.
 */

require('dotenv').config();
const { Client } = require('pg');

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
  const { rows } = await client.query(`
    select
      coalesce(d.country, 'Unknown') as country,
      coalesce(d.country_code, '') as country_code,
      count(r.id)::int as restaurants,
      count(*) filter (where r.verification_status = 'verified')::int as verified,
      count(*) filter (where r.google_place_id is not null)::int as has_google_place_id,
      count(*) filter (where r.photo_url is not null)::int as has_photo
    from restaurants r
    join destinations d on d.id = r."destinationId"
    where coalesce(d.country_code, '') <> 'IL'
    group by 1, 2
    order by restaurants desc, country asc
  `);
  await client.end();

  console.table(rows);
  console.log('TOTAL_NON_IL', rows.reduce((sum, row) => sum + Number(row.restaurants), 0));
})();
