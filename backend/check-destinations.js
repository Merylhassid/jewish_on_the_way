const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

client.connect().then(async () => {
  // Check columns
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='destinations' ORDER BY ordinal_position`
  );
  console.log('Columns:', cols.rows.map(r => r.column_name).join(', '));

  // Root destinations
  const r1 = await client.query(
    `SELECT id, name, country, "parent_id" FROM destinations WHERE "parent_id" IS NULL ORDER BY country, name`
  );
  console.log('\n=== ROOT destinations ===');
  r1.rows.forEach(r => console.log(`  [${r.id}] ${r.name} | ${r.country}`));

  const r2 = await client.query(
    `SELECT COUNT(*) FILTER (WHERE "parent_id" IS NULL) as root_count,
            COUNT(*) FILTER (WHERE "parent_id" IS NOT NULL) as child_count,
            COUNT(*) as total FROM destinations`
  );
  console.log('\n=== Stats ===', r2.rows[0]);

  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
