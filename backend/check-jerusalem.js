const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

client.connect().then(async () => {
  // What are the 2 existing synagogues — when created?
  const r1 = await client.query(
    `SELECT id, name, address, source, created_at FROM synagogues WHERE "destinationId" = 331 ORDER BY id`
  );
  console.log('=== 2 existing Jerusalem synagogues ===');
  console.log(JSON.stringify(r1.rows, null, 2));

  // Were there more synagogues with destinationId=331 at any point?
  // Check the ID gap — what are IDs around when Jerusalem would have been imported?
  const r2 = await client.query(
    `SELECT id, name, "destinationId", TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created
     FROM synagogues
     ORDER BY id DESC
     LIMIT 20`
  );
  console.log('\n=== Most recently added synagogues (last 20 by ID) ===');
  console.log(JSON.stringify(r2.rows, null, 2));

  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
