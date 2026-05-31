const { Pool } = require('pg');

const pool = new Pool({
  host: 'ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_4sdzL2HpDruE',
  ssl: { rejectUnauthorized: false },
});

(async () => {
  const client = await pool.connect();
  try {
    const countRes = await client.query('SELECT COUNT(*) FROM synagogues WHERE "destinationId" = $1', [354]);
    console.log(`Current count: ${countRes.rows[0].count}`);
    const del = await client.query('DELETE FROM synagogues WHERE "destinationId" = $1', [354]);
    console.log(`Deleted: ${del.rowCount} rows`);
  } finally {
    client.release();
    await pool.end();
  }
})();
