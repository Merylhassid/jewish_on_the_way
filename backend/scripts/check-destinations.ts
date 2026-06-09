import 'reflect-metadata';
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.join(__dirname, '../.env') });
import { DataSource } from 'typeorm';

const db = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
  username: process.env.DB_USER, password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
  entities: [], synchronize: false,
});

async function main() {
  await db.initialize();
  const rows: { name: string; city: string; country: string }[] = await db.query(
    `SELECT name, city, country FROM destinations WHERE country = 'Israel' ORDER BY name`
  );
  console.log('Israeli destinations in DB:');
  rows.forEach((r) => console.log(`  "${r.name}" — ${r.city}`));
  await db.destroy();
}
main().catch(console.error);
