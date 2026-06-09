const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

client.connect().then(async () => {
  const ID = 495;

  const dest = await client.query(`SELECT id, name, city FROM destinations WHERE id = $1`, [ID]);
  console.log('Destination:', dest.rows[0]);

  const syns = await client.query(`SELECT COUNT(*) FROM synagogues WHERE "destinationId" = $1`, [ID]);
  console.log('Synagogues:', syns.rows[0].count);

  const rests = await client.query(`SELECT COUNT(*) FROM restaurants WHERE "destinationId" = $1`, [ID]);
  console.log('Restaurants:', rests.rows[0].count);

  const children = await client.query(`SELECT COUNT(*) FROM destinations WHERE parent_id = $1`, [ID]);
  console.log('Child destinations:', children.rows[0].count);

  await client.query(`DELETE FROM synagogues WHERE "destinationId" = $1`, [ID]);
  console.log('✅ Deleted synagogues');

  await client.query(`DELETE FROM restaurants WHERE "destinationId" = $1`, [ID]);
  console.log('✅ Deleted restaurants');

  await client.query(`UPDATE destinations SET parent_id = NULL WHERE parent_id = $1`, [ID]);
  console.log('✅ Unlinked child destinations');

  await client.query(`DELETE FROM destinations WHERE id = $1`, [ID]);
  console.log(`✅ Deleted destination ${ID} (מעלות)`);

  await client.end();
}).catch(e => { console.error('❌', e.message); client.end(); });
