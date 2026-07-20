require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ids = process.argv.slice(2).map((value) => Number(value)).filter(Number.isInteger);
if (!ids.length) {
  console.error('Usage: node scripts/delete-restaurants-by-id.js <id> [id...]');
  process.exit(1);
}

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  await client.connect();
  await client.query('BEGIN');
  try {
    const before = await client.query(
      `
      SELECT r.*, d.city AS destination_city, d.country AS destination_country
      FROM restaurants r
      LEFT JOIN destinations d ON d.id = r."destinationId"
      WHERE r.id = ANY($1::int[])
      ORDER BY r.id
      `,
      [ids],
    );

    if (before.rows.length !== ids.length) {
      throw new Error(`Expected ${ids.length} rows, found ${before.rows.length}`);
    }

    const backupDir = path.join(__dirname, '..', 'audit-output');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(
      backupDir,
      `deleted-restaurants-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
    fs.writeFileSync(backupPath, JSON.stringify({ ids, rows: before.rows }, null, 2));

    await client.query(`DELETE FROM user_favorites WHERE entity_type = 'restaurant' AND entity_id = ANY($1::int[])`, [ids]);
    await client.query(`DELETE FROM place_reviews WHERE entity_type = 'restaurant' AND entity_id = ANY($1::int[])`, [ids]);
    await client.query(`DELETE FROM place_reports WHERE entity_type = 'restaurant' AND entity_id = ANY($1::int[])`, [ids]);
    const deleted = await client.query(`DELETE FROM restaurants WHERE id = ANY($1::int[]) RETURNING id, name`, [ids]);

    await client.query('COMMIT');
    console.log(JSON.stringify({ deleted: deleted.rows, backupPath }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
