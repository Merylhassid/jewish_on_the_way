/**
 * Runs insert_restaurants.sql and insert_restaurants_part2.sql against the DB.
 * After running, call fix-all-destinations.ts to dedup.
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.join(__dirname, '../.env') });

import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [path.join(__dirname, '../src/**/*.entity{.ts,.js}')],
  synchronize: false,
});

async function runSqlFile(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Remove comment-only lines, then split on semicolons
  const noComments = raw
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  const statements = noComments
    .split(';')
    .map(s => s.trim())
    .filter(s => s.toUpperCase().includes('INSERT INTO'));

  let destCount = 0;
  let restCount = 0;

  for (const stmt of statements) {
    try {
      const res = await AppDataSource.query(stmt);
      if (stmt.includes('INTO destinations')) destCount++;
      else if (stmt.includes('INTO restaurants')) {
        restCount++;
        if (Array.isArray(res)) console.log(`  + ${res.length ?? 0} restaurants`);
      }
    } catch (e: any) {
      console.warn(`  ⚠ ${e.message?.slice(0, 100)}`);
    }
  }

  console.log(`  Ran ${destCount} destination + ${restCount} restaurant statements`);
}

async function main() {
  await AppDataSource.initialize();
  console.log('DB connected.\n');

  const before = await AppDataSource.query('SELECT COUNT(*) FROM restaurants');
  console.log(`Before: ${before[0].count} restaurants\n`);

  const files = [
    path.join(__dirname, '../insert_restaurants.sql'),
    path.join(__dirname, '../insert_restaurants_part2.sql'),
  ];

  for (const f of files) {
    console.log(`Running ${path.basename(f)}...`);
    await runSqlFile(f);
  }

  const after = await AppDataSource.query('SELECT COUNT(*) FROM restaurants');
  console.log(`\nAfter: ${after[0].count} restaurants`);

  await AppDataSource.destroy();
}
main().catch(e => { console.error(e); process.exit(1); });
