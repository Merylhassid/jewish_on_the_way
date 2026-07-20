require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function main() {
  await client.connect();
  const { rows } = await client.query(
    `
    SELECT id, name, address
    FROM restaurants
    WHERE id IN (4444, 4752)
       OR name ILIKE ANY($1)
    ORDER BY id
    `,
    [['%חומוס הרובע%', '%סביח מלכה%', '%Sabich Malka%', '%Hummus Harova%', '%Hummus HaRova%']],
  );
  console.log(JSON.stringify({ remaining: rows }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
