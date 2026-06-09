const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

client.connect().then(async () => {
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='chat_messages' ORDER BY ordinal_position`
  );
  console.log('Current columns:', cols.rows.map(r => r.column_name).join(', '));

  await client.query(
    `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS minyan_id integer REFERENCES minyans(id) ON DELETE CASCADE`
  );
  console.log('✅ minyan_id column added');

  const cols2 = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='chat_messages' ORDER BY ordinal_position`
  );
  console.log('Updated columns:', cols2.rows.map(r => r.column_name).join(', '));

  await client.end();
}).catch(e => { console.error('❌', e.message); client.end(); });
