require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function tableExists(name) {
  const { rows } = await client.query('SELECT to_regclass($1) AS name', [`public.${name}`]);
  return Boolean(rows[0]?.name);
}

async function countIfExists(table, where, params) {
  if (!(await tableExists(table))) return null;
  const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE ${where}`, params);
  return rows[0].count;
}

async function dependencies(id) {
  return {
    user_favorites: await countIfExists('user_favorites', `entity_type = 'restaurant' AND entity_id = $1`, [id]),
    place_reviews: await countIfExists('place_reviews', `entity_type = 'restaurant' AND entity_id = $1`, [id]),
    place_reports: await countIfExists('place_reports', `entity_type = 'restaurant' AND entity_id = $1`, [id]),
  };
}

async function search(namePatterns, locationPatterns) {
  const { rows } = await client.query(
    `
    SELECT
      r.id,
      r.name,
      r.address,
      r.city,
      r.country,
      r.phone,
      r.kashrut_level,
      r.restaurant_type,
      r.google_place_id,
      r.google_display_name,
      r.google_display_name_he,
      r.google_formatted_address_he,
      r.google_maps_uri,
      r.verification_status,
      d.id AS destination_id,
      d.city AS destination_city,
      d.country AS destination_country
    FROM restaurants r
    LEFT JOIN destinations d ON d.id = r."destinationId"
    WHERE
      (
        r.name ILIKE ANY($1)
        OR COALESCE(r.google_display_name, '') ILIKE ANY($1)
        OR COALESCE(r.google_display_name_he, '') ILIKE ANY($1)
      )
      AND (
        COALESCE(r.address, '') ILIKE ANY($2)
        OR COALESCE(r.google_formatted_address_he, '') ILIKE ANY($2)
        OR COALESCE(r.city, '') ILIKE ANY($2)
        OR COALESCE(d.city, '') ILIKE ANY($2)
      )
    ORDER BY r.id
    LIMIT 30
    `,
    [namePatterns, locationPatterns],
  );

  for (const row of rows) row.dependencies = await dependencies(row.id);
  return rows;
}

async function main() {
  await client.connect();
  const result = {
    hummusHarova: await search(
      ['%חומוס הרובע%', '%Hummus Harova%', '%Hummus HaRova%'],
      ['%ירושלים%', '%Jerusalem%', '%הרובע היהודי%', '%Jewish Quarter%'],
    ),
    sabichMalka: await search(
      ['%סביח מלכה%', '%Sabich Malka%', '%סביך מלכה%'],
      ['%תל אביב%', '%Tel Aviv%', '%יפו%', '%Yafo%', '%המלך ג׳ורג%', '%המלך ג׳ורג׳%', '%King George%'],
    ),
  };
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
