/**
 * Backfill geocoding script.
 *
 * Reads every restaurant in your Neon DB that has no coordinates yet,
 * geocodes it with Nominatim (free, OpenStreetMap), and updates the row
 * with lat, lng, and the PostGIS geography point.
 *
 * Usage:
 *   npx ts-node scripts/geocode-existing-restaurants.ts
 *
 * Prerequisites:
 *   1. Run migrations first:
 *      npx typeorm migration:run -d src/data-source.ts
 *   2. Your .env must have valid DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
 *
 * Safe to re-run: already-geocoded rows (geocoded_at IS NOT NULL) are skipped.
 */

import 'reflect-metadata';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '../.env') });

import axios from 'axios';
import { DataSource } from 'typeorm';

// ─── Database (raw connection — no entity classes needed) ─────────────────────

const db = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging: false,
});

// ─── Nominatim geocoding ──────────────────────────────────────────────────────

const DELAY_MS = 1100; // Nominatim ToS: max 1 request/second
const USER_AGENT = 'JewishOnTheWay/1.0 (meryl.hasid@gmail.com)';

let lastRequestAt = 0;

async function rateLimit(): Promise<void> {
  const wait = DELAY_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function nominatimSearch(query: string): Promise<{ lat: number; lng: number } | null> {
  await rateLimit();
  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: query, format: 'json', limit: 1, addressdetails: 0 },
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
      timeout: 10_000,
    });
    const hits: Array<{ lat: string; lon: string }> = res.data;
    if (!hits?.length) return null;
    return { lat: parseFloat(hits[0].lat), lng: parseFloat(hits[0].lon) };
  } catch (err) {
    console.warn(`    ⚠  Nominatim error: ${err.message}`);
    return null;
  }
}

/**
 * Try multiple query strategies, from most precise to least precise.
 * Returns the first successful result.
 */
async function geocodeRestaurant(row: {
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
}): Promise<{ lat: number; lng: number } | null> {
  const { name, address, city, country } = row;

  // Strategy 1: full address as stored (Google Places format already includes city+country)
  if (address) {
    const r = await nominatimSearch(address);
    if (r) { console.log(`    ✓ matched on address: "${address}"`); return r; }
  }

  // Strategy 2: address + city + country (for partial addresses)
  if (address && city && country) {
    const q = `${address}, ${city}, ${country}`;
    const r = await nominatimSearch(q);
    if (r) { console.log(`    ✓ matched on address+city+country: "${q}"`); return r; }
  }

  // Strategy 3: address + city only
  if (address && city) {
    const q = `${address}, ${city}`;
    const r = await nominatimSearch(q);
    if (r) { console.log(`    ✓ matched on address+city: "${q}"`); return r; }
  }

  // Strategy 4: restaurant name + city (useful when address is a landmark name)
  if (name && city) {
    const q = `${name}, ${city}`;
    const r = await nominatimSearch(q);
    if (r) { console.log(`    ✓ matched on name+city: "${q}"`); return r; }
  }

  // Strategy 5: city + country only (last resort — gives city center, not restaurant point)
  if (city && country) {
    const q = `${city}, ${country}`;
    const r = await nominatimSearch(q);
    if (r) {
      console.warn(`    ⚠  fallback to city center for "${name}" — address not found by Nominatim`);
      return r;
    }
  }

  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await db.initialize();
  console.log('✅ Connected to Neon database\n');

  // Fetch every restaurant that hasn't been geocoded yet
  const rows: Array<{
    id: number;
    name: string;
    address: string | null;
    city: string | null;
    country: string | null;
  }> = await db.query(`
    SELECT id, name, address, city, country
    FROM restaurants
    WHERE geocoded_at IS NULL
    ORDER BY id ASC
  `);

  if (rows.length === 0) {
    console.log('✅ All restaurants are already geocoded. Nothing to do.');
    await db.destroy();
    return;
  }

  console.log(`Found ${rows.length} restaurant(s) to geocode.\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    console.log(`[${i + 1}/${rows.length}] "${row.name}" — ${row.address ?? '(no address)'}`);

    const coords = await geocodeRestaurant(row);

    if (!coords) {
      console.log(`    ❌ Could not geocode — skipping\n`);
      failed++;
      continue;
    }

    // Update: lat, lng, PostGIS geography point, geocoded_at
    await db.query(
      `UPDATE restaurants
       SET
         lat         = $1,
         lng         = $2,
         location    = ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
         geocoded_at = NOW()
       WHERE id = $3`,
      [coords.lat, coords.lng, row.id],
    );

    console.log(`    ✅ saved (${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)})\n`);
    success++;
  }

  await db.destroy();

  console.log('─────────────────────────────────────────');
  console.log(`  Total     : ${rows.length}`);
  console.log(`  Geocoded  : ${success}`);
  console.log(`  Failed    : ${failed}`);
  console.log('─────────────────────────────────────────');

  if (failed > 0) {
    console.log('\n⚠  Some restaurants could not be geocoded.');
    console.log('   Fix their address in the DB, then re-run this script.');
    console.log('   Already-geocoded rows will be skipped automatically.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
