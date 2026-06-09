const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

client.connect().then(async () => {
  const before = await client.query(`SELECT id, name, city FROM destinations WHERE id = 529`);
  console.log('Before:', before.rows[0]);

  await client.query(`UPDATE destinations SET name = 'Tzfat', city = 'Tzfat' WHERE id = 529`);

  const after = await client.query(`SELECT id, name, city FROM destinations WHERE id = 529`);
  console.log('After:', after.rows[0]);

  await client.end();
}).catch(e => { console.error('❌', e.message); client.end(); });
