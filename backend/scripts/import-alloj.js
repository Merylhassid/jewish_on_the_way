const { Client } = require('pg');
const fs = require('fs');

const DB = {
  host: 'ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech',
  port: 5432, user: 'neondb_owner', password: 'npg_4sdzL2HpDruE',
  database: 'neondb', ssl: { rejectUnauthorized: false }
};

async function main() {
  const client = new Client(DB);
  await client.connect();
  const data = JSON.parse(fs.readFileSync('scraped/alloj-all.json', 'utf-8'));
  let inserted = 0, skipped = 0;

  for (const r of data) {
    // Check for duplicate: same name + destinationId
    const dup = await client.query(
      'SELECT id FROM restaurants WHERE LOWER(TRIM(name))=LOWER($1) AND "destinationId"=$2',
      [r.name.trim(), r.destinationId]
    );
    if (dup.rows.length > 0) { skipped++; console.log('  skip (dup):', r.name); continue; }

    await client.query(
      `INSERT INTO restaurants (name, address, phone, kashrut_level, restaurant_type, is_kosher,
        website_url, "destinationId", created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [
        r.name, r.address, r.phone || null, r.kashrut_level,
        r.restaurant_type || null, true, r.website_url || null, r.destinationId
      ]
    );
    inserted++;
    console.log('  inserted:', r.name, '(', r.city, ')');
  }

  await client.end();
  console.log('\nDone. Inserted:', inserted, 'Skipped:', skipped);
}
main().catch(console.error);
