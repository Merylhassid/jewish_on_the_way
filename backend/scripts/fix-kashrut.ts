import 'reflect-metadata';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '../.env') });

import { DataSource } from 'typeorm';

const db = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [],
  synchronize: false,
});

async function main() {
  await db.initialize();

  // Fix kashrut level from embedded name keywords
  const mehadrin = await db.query(`
    UPDATE restaurants SET kashrut_level = 'mehadrin'
    WHERE kashrut_level = 'rabbinate'
      AND (name LIKE '%מהדרין%' OR name LIKE '%למהדרין%')
  `);
  console.log(`Mehadrin level updated: ${mehadrin[1]} rows`);

  // Strip kashrut qualifiers from restaurant names: "אלברטו (כשר למהדרין)" → "אלברטו"
  const cleaned = await db.query(`
    UPDATE restaurants
    SET name = TRIM(REGEXP_REPLACE(name, '\\s*\\([^)]*כשר[^)]*\\)', '', 'g'))
    WHERE name ~ '\\([^)]*כשר[^)]*\\)'
  `);
  console.log(`Name qualifiers stripped: ${cleaned[1]} rows`);

  const badatz = await db.query(`
    UPDATE restaurants SET kashrut_level = 'badatz'
    WHERE kashrut_level != 'badatz'
      AND (name LIKE $1 OR name LIKE $2 OR name LIKE '%בדץ%')
  `, ['%בד"ץ%', '%בד״ץ%']);
  console.log(`Badatz updated: ${badatz[1]} rows`);

  const counts: { kashrut_level: string; total: string }[] = await db.query(`
    SELECT kashrut_level, COUNT(*) AS total
    FROM restaurants
    GROUP BY kashrut_level
    ORDER BY kashrut_level
  `);

  console.log('\nKashrut breakdown:');
  counts.forEach((r) => console.log(`  ${r.kashrut_level}: ${r.total}`));

  await db.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
