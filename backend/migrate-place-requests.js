const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require',
});
client.connect()
  .then(() => client.query(`
    ALTER TABLE place_requests
      ALTER COLUMN destination_id DROP NOT NULL,
      ALTER COLUMN destination_id DROP DEFAULT;
  `))
  .then(() => { console.log('Migration OK'); client.end(); })
  .catch(e => { console.error('Migration FAILED:', e.message); client.end(); process.exit(1); });
