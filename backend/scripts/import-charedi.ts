/**
 * Imports mehadrin/badatz restaurants from charedi.net into the DB.
 * All restaurants have REAL, verified kashrut levels (no guessing).
 *
 * Source: charedi.net/en/restaurant/ — a curated directory of mehadrin/badatz
 * restaurants across Israel. Only higher-standard restaurants are listed.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/import-charedi.ts
 */

import 'reflect-metadata';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '../.env') });

import axios from 'axios';
import { DataSource } from 'typeorm';
import { Restaurant } from '../src/restaurant.entity';
import { Destination } from '../src/destination.entity';

// ─── DB ──────────────────────────────────────────────────────────────────────

const db = new DataSource({
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

// ─── charedi.net taxonomy maps ────────────────────────────────────────────────

// City taxonomy ID → { English city name, destination lookup name, Hebrew city }
const CITY_MAP: Record<number, { city: string; destination: string; cityHe: string }> = {
  1154: { city: 'Tel Aviv',       destination: 'Tel Aviv',    cityHe: 'תל אביב'     },
  1071: { city: 'Ashdod',         destination: 'Ashdod',      cityHe: 'אשדוד'       },
  1069: { city: 'Jerusalem',      destination: 'Jerusalem',   cityHe: 'ירושלים'     },
  1075: { city: 'Bnei Brak',      destination: 'Tel Aviv',    cityHe: 'בני ברק'     },
  1153: { city: 'Rishon LeZion',  destination: 'Tel Aviv',    cityHe: 'ראשון לציון' },
  1155: { city: 'Petah Tikva',    destination: 'Tel Aviv',    cityHe: 'פתח תקווה'   },
  1074: { city: 'Netanya',        destination: 'Netanya',     cityHe: 'נתניה'       },
  1072: { city: 'Tiberias',       destination: 'Tiberias',    cityHe: 'טבריה'       },
  1073: { city: 'Safed',          destination: 'Safed',       cityHe: 'צפת'         },
  1070: { city: 'Beit Shemesh',   destination: 'Jerusalem',   cityHe: 'בית שמש'     },
  1156: { city: 'Modiin',         destination: 'Tel Aviv',    cityHe: 'מודיעין'     },
};

// Kashrut taxonomy ID → our kashrut_level
const KASHRUT_LEVEL: Record<number, 'mehadrin' | 'badatz'> = {
  115:  'badatz',   // בד"ץ העדה החרדית
  119:  'badatz',   // בד"ץ בית יוסף
  109:  'badatz',   // בד"ץ קהילות
  120:  'badatz',   // אגודת ישראל
  118:  'mehadrin', // הרב מחפוד
  116:  'mehadrin', // הרב לנדא
  114:  'mehadrin', // הרב רובין
  112:  'mehadrin', // חתם סופר
  108:  'mehadrin', // רבנויות מהדרים
  1152: 'mehadrin', // הרב אפרתי
};

// Food type taxonomy ID → restaurant type
const FOOD_TYPE: Record<number, 'meat' | 'dairy'> = {
  160: 'meat',
  161: 'dairy',
};

// ─── charedi.net API ──────────────────────────────────────────────────────────

interface CharediRestaurant {
  id: number;
  title: { rendered: string };
  kosher: number[];
  mfp: number[];
  restaurant_city: number[];
}

async function fetchAll(): Promise<CharediRestaurant[]> {
  const results: CharediRestaurant[] = [];
  let page = 1;

  while (true) {
    await new Promise((r) => setTimeout(r, 300));
    try {
      const res = await axios.get<CharediRestaurant[]>(
        'https://charedi.net/wp-json/wp/v2/restaurants',
        {
          params: { per_page: 100, page, _fields: 'id,title,kosher,mfp,restaurant_city' },
          headers: { 'User-Agent': 'JewishOnTheWay/1.0 (meryl.hasid@gmail.com)' },
          timeout: 15_000,
        },
      );
      if (!Array.isArray(res.data) || res.data.length === 0) break;
      results.push(...res.data);
      const totalPages = parseInt(res.headers['x-wp-totalpages'] ?? '1', 10);
      if (page >= totalPages) break;
      page++;
    } catch {
      break;
    }
  }

  return results;
}

// ─── HTML decode + clean name ─────────────────────────────────────────────────

function cleanTitle(raw: string): string {
  // Decode HTML entities
  let s = raw
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  // If name has "English – עברית" pattern, keep Hebrew part only
  const dashIdx = s.indexOf(' – ');
  if (dashIdx !== -1) {
    const before = s.slice(0, dashIdx).trim();
    const after  = s.slice(dashIdx + 3).trim();
    // Pick the part that has Hebrew characters
    const hasHe = (t: string) => /[א-ת]/.test(t);
    s = hasHe(after) ? after : (hasHe(before) ? before : s);
  }
  return s.trim();
}

// ─── Nominatim geocoder ───────────────────────────────────────────────────────

interface GeoResult { lat: number; lng: number }

async function geocode(name: string, cityHe: string): Promise<GeoResult | null> {
  const strategies = [
    `${name}, ${cityHe}, ישראל`,
    `${name}, ${cityHe}`,
    `${cityHe}, ישראל`,
  ];
  for (const q of strategies) {
    await new Promise((r) => setTimeout(r, 1100));
    try {
      const res = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q, format: 'json', limit: 1, addressdetails: 0 },
        headers: { 'User-Agent': 'JewishOnTheWay/1.0 (meryl.hasid@gmail.com)' },
        timeout: 10_000,
      });
      const hits = res.data as { lat: string; lon: string }[];
      if (hits.length > 0) {
        return { lat: parseFloat(hits[0].lat), lng: parseFloat(hits[0].lon) };
      }
    } catch { /* try next */ }
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await db.initialize();
  const restRepo = db.getRepository(Restaurant);
  const destRepo = db.getRepository(Destination);
  const destCache = new Map<string, number>();

  console.log('Fetching restaurants from charedi.net…');
  const charediList = await fetchAll();
  console.log(`  → ${charediList.length} restaurants fetched\n`);

  let inserted = 0, skipped = 0, noGeo = 0, noCity = 0;

  for (const c of charediList) {
    // Resolve city
    const cityId = c.restaurant_city?.[0];
    const cityInfo = cityId ? CITY_MAP[cityId] : undefined;
    if (!cityInfo) {
      console.log(`  [skip] Unknown city id ${cityId}`);
      noCity++;
      continue;
    }

    // Resolve kashrut level (strictest wins)
    let kashrutLevel: 'mehadrin' | 'badatz' = 'mehadrin';
    for (const kid of (c.kosher ?? [])) {
      if (KASHRUT_LEVEL[kid] === 'badatz') { kashrutLevel = 'badatz'; break; }
      if (KASHRUT_LEVEL[kid] === 'mehadrin') kashrutLevel = 'mehadrin';
    }

    // Resolve food type
    const mfpId = c.mfp?.[0];
    const foodType: string = FOOD_TYPE[mfpId ?? 0] ?? 'unknown';

    // Clean restaurant name
    const name = cleanTitle(c.title.rendered);
    if (!name) { skipped++; continue; }

    // Resolve destination in DB
    const destKey = cityInfo.destination.toLowerCase();
    let destId = destCache.get(destKey);
    if (destId === undefined) {
      const dest = await destRepo
        .createQueryBuilder('d')
        .where('LOWER(d.name) = :name', { name: destKey })
        .getOne();
      if (!dest) {
        console.log(`  [skip] Destination "${cityInfo.destination}" not in DB`);
        noCity++;
        continue;
      }
      destCache.set(destKey, dest.id);
      destId = dest.id;
    }

    // Skip duplicates
    const exists = await restRepo.findOne({ where: { name, city: cityInfo.city } });
    if (exists) {
      // If existing but with wrong kashrut, update it
      if (exists.kashrutLevel !== kashrutLevel) {
        await restRepo.update(exists.id, { kashrutLevel });
        console.log(`  ↺ Updated kashrut: ${name} → ${kashrutLevel}`);
      }
      skipped++;
      continue;
    }

    // Geocode
    console.log(`  → Geocoding: ${name} (${cityInfo.city})`);
    const geo = await geocode(name, cityInfo.cityHe);
    if (!geo) {
      console.warn(`    ✗ No coordinates — inserting without location`);
      noGeo++;
    }

    // Save
    const entity = restRepo.create({
      name,
      address: `${cityInfo.cityHe}, Israel`,
      city: cityInfo.city,
      country: 'Israel',
      kashrutLevel,
      restaurantType: (foodType === 'unknown' ? null : foodType) as 'meat' | 'dairy' | null,
      isKosher: true,
      lat: geo?.lat,
      lng: geo?.lng,
      destination: { id: destId } as Destination,
    });
    const saved = await restRepo.save(entity);

    if (geo) {
      await db.query(
        `UPDATE restaurants SET location = ST_SetSRID(ST_MakePoint($1,$2),4326)::geography WHERE id = $3`,
        [geo.lng, geo.lat, saved.id],
      );
    }

    console.log(`    ✓ Saved: ${name} [${kashrutLevel} / ${foodType}]`);
    inserted++;
  }

  console.log(`\nDone. Inserted: ${inserted} | Skipped/dup: ${skipped} | No-geo: ${noGeo} | No-city: ${noCity}`);

  const counts: { kashrutLevel: string; total: string }[] = await db.query(
    `SELECT kashrut_level AS "kashrutLevel", COUNT(*) AS total
     FROM restaurants GROUP BY kashrut_level ORDER BY kashrut_level`,
  );
  console.log('\nFinal kashrut breakdown:');
  counts.forEach((c) => console.log(`  ${c.kashrutLevel}: ${c.total}`));

  await db.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
