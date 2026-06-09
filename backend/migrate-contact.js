const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

client.connect()
  .then(() => client.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id serial PRIMARY KEY,
      first_name varchar NOT NULL,
      last_name varchar NOT NULL,
      email varchar NOT NULL,
      subject varchar(100) NOT NULL,
      message text NOT NULL,
      user_id integer REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now()
    );
  `))
  .then(() => { console.log('Migration OK'); client.end(); })
  .catch(e => { console.error('Migration FAILED:', e.message); client.end(); process.exit(1); });
