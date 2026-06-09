const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

client.connect().then(async () => {
  const res = await client.query(`
    SELECT r.id, r.name, r.address, d.city
    FROM restaurants r
    LEFT JOIN destinations d ON d.id = r."destinationId"
    WHERE r.location IS NULL
    ORDER BY d.city, r.name
  `);

  console.log(`סה"כ מסעדות ללא קורדינטות: ${res.rows.length}\n`);
  for (const row of res.rows) {
    console.log(`[${row.id}] ${row.name} | ${row.address} | ${row.city}`);
  }

  await client.end();
}).catch(e => { console.error('❌', e.message); client.end(); });
