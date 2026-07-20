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
  const { rows } = await client.query(
    `SELECT to_regclass($1) AS name`,
    [`public.${name}`],
  );
  return Boolean(rows[0]?.name);
}

async function countIfExists(table, where, params) {
  if (!(await tableExists(table))) return null;
  const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE ${where}`, params);
  return rows[0].count;
}

async function hasColumns(table, columns) {
  if (!(await tableExists(table))) return false;
  const { rows } = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = ANY($2)
    `,
    [table, columns],
  );
  const present = new Set(rows.map((row) => row.column_name));
  return columns.every((column) => present.has(column));
}

async function main() {
  await client.connect();

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
      r.created_at,
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
    ORDER BY
      CASE WHEN r.name ILIKE '%חומוס הרובע%' THEN 0 ELSE 1 END,
      r.id
    LIMIT 30
    `,
    [
      ['%חומוס הרובע%', '%Hummus Harova%', '%Hummus HaRova%', '%Harova%', '%הרובע%'],
      ['%ירושלים%', '%Jerusalem%', '%הרובע היהודי%', '%Jewish Quarter%'],
    ],
  );

  for (const row of rows) {
    row.dependencies = {
      user_favorites: await countIfExists('user_favorites', `entity_type = 'restaurant' AND entity_id = $1`, [row.id]),
      place_reviews: await countIfExists('place_reviews', `entity_type = 'restaurant' AND entity_id = $1`, [row.id]),
      place_reports: await countIfExists('place_reports', `entity_type = 'restaurant' AND entity_id = $1`, [row.id]),
      search_feedback_clicked: await hasColumns('search_feedback', ['clicked_entity_type', 'clicked_entity_id'])
        ? await countIfExists('search_feedback', `clicked_entity_type = 'restaurant' AND clicked_entity_id = $1`, [row.id])
        : null,
    };
  }

  console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
