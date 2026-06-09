/**
 * Import scraped international kosher restaurants from backend/scraped/all-cities.json
 * into the restaurants table. Geocodes via Nominatim (1 req/sec, free).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/import-scraped-intl.ts
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.join(__dirname, '../.env') });

import axios from 'axios';
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

// city name (English) → destination name in DB
const CITY_TO_DEST: Record<string, string> = {
  Budapest:    'Budapest',
  Paris:       'Paris',
  London:      'London',
  'New York':  'New York',
  Amsterdam:   'Amsterdam',
  Berlin:      'Berlin',
  Prague:      'Prague',
  Rome:        'Rome',
  Barcelona:   'Barcelona',
  Vienna:      'Vienna',
  Miami:       'Miami',
  'Los Angeles': 'Los Angeles',
};

interface ScrapedRestaurant {
  name: string;
  city: string;
  country: string;
  address: string;
  phone: string;
  website: string;
  openingHours: string;
  kashrut: string;
  restaurantType: string;
  category: string;
  priceRange: string;
  notes: string;
  sourceUrl: string;
  scrapedAt: string;
}

interface NominatimResult { lat: string; lon: string; }

async function geocode(name: string, address: string, city: string, country: string): Promise<{ lat: number; lng: number } | null> {
  const queries = [
    address && `${address}, ${city}, ${country}`,
    `${name}, ${city}, ${country}`,
    `${city}, ${country}`,
  ].filter(Boolean) as string[];

  for (const q of queries) {
    await new Promise(r => setTimeout(r, 1100));
    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q, format: 'json', limit: 1 },
        headers: { 'User-Agent': 'JewishOnTheWay/1.0 (meryl.hasid@gmail.com)' },
        timeout: 10000,
      });
      const hits = res.data as NominatimResult[];
      if (hits.length > 0) return { lat: parseFloat(hits[0].lat), lng: parseFloat(hits[0].lon) };
    } catch { /* try next */ }
  }
  return null;
}

async function main() {
  const allFile = path.join(__dirname, '../scraped/all-cities.json');
  if (!fs.existsSync(allFile)) {
    console.error('all-cities.json not found. Run the scraper first.');
    process.exit(1);
  }

  const restaurants: ScrapedRestaurant[] = JSON.parse(fs.readFileSync(allFile, 'utf-8'));
  console.log(`\nLoaded ${restaurants.length} scraped restaurants.\n`);

  await AppDataSource.initialize();
  console.log('DB connected.\n');

  // Pre-load destination ids
  const destRows: Array<{ id: number; name: string }> = await AppDataSource.query(
    `SELECT id, name FROM destinations`,
  );
  const destByName = new Map(destRows.map(d => [d.name.toLowerCase(), d.id]));

  let saved = 0, skipped = 0, noGeo = 0, noDest = 0;

  for (const r of restaurants) {
    const destName = CITY_TO_DEST[r.city] ?? r.city;
    const destId = destByName.get(destName.toLowerCase());

    if (!destId) {
      console.warn(`  ✗ No destination for city "${r.city}" — skipping ${r.name}`);
      noDest++;
      continue;
    }

    // Skip if already in DB (same name + city)
    const existing = await AppDataSource.query(
      `SELECT id FROM restaurants WHERE name = $1 AND city = $2 LIMIT 1`,
      [r.name, r.city],
    );
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    console.log(`  → Geocoding: ${r.name} (${r.city})`);
    const geo = await geocode(r.name, r.address, r.city, r.country);

    if (!geo) {
      console.warn(`    ✗ No geocode result — inserting without location`);
      noGeo++;
    }

    // Detect kashrut level from kashrut text
    let kashrutLevel = 'rabbinate';
    const kText = (r.kashrut || '').toLowerCase();
    if (kText.includes('בד"ץ') || kText.includes('בדץ')) kashrutLevel = 'badatz';
    else if (kText.includes('מהדרין') || kText.includes('mehadrin')) kashrutLevel = 'mehadrin';

    const phone = r.phone ? r.phone.slice(0, 32) : null;

    const insertResult = await AppDataSource.query<{ id: number }[]>(
      `INSERT INTO restaurants
         (name, address, city, country, phone, kashrut_level, restaurant_type,
          category, is_kosher, lat, lng, opening_hours, website_url, "destinationId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        r.name, r.address || null, r.city, r.country,
        phone, kashrutLevel,
        r.restaurantType === 'unknown' ? null : r.restaurantType,
        r.category || null, true,
        geo?.lat ?? null, geo?.lng ?? null,
        r.openingHours || null, r.website || null,
        destId,
      ],
    );

    if (geo) {
      await AppDataSource.query(
        `UPDATE restaurants SET location = ST_SetSRID(ST_MakePoint($1,$2),4326)::geography WHERE id = $3`,
        [geo.lng, geo.lat, insertResult[0].id],
      );
    }

    console.log(`    ✓ Saved: ${r.name}`);
    saved++;
  }

  console.log(`\n✅ Done.`);
  console.log(`   Saved:   ${saved}`);
  console.log(`   Skipped (already in DB): ${skipped}`);
  console.log(`   No geocode: ${noGeo}`);
  console.log(`   No destination: ${noDest}`);

  await AppDataSource.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
