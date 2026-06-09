/**
 * Enriches kashrut_level for existing restaurants using charedi.net
 * (publicly accessible worldwide — no Israeli IP needed).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/enrich-kashrut.ts
 */

import 'reflect-metadata';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '../.env') });

import axios from 'axios';
import { DataSource } from 'typeorm';
import { Restaurant } from '../src/restaurant.entity';

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

// ─── charedi.net city IDs ─────────────────────────────────────────────────────

const CITY_IDS: Record<string, number> = {
  'Tel Aviv':      1154,
  'Ashdod':        1071,
  'Jerusalem':     1069,
  'Bnei Brak':     1075,
  'Rishon LeZion': 1153,
  'Petah Tikva':   1155,
  'Netanya':       1074,
  'Tiberias':      1072,
  'Beit Shemesh':  1070,
  'Ramat Gan':     1154, // closest — Tel Aviv area
};

// ─── Kosher taxonomy ID → our kashrut_level ──────────────────────────────────

const KOSHER_LEVEL: Record<number, 'mehadrin' | 'badatz'> = {
  115: 'badatz',   // בד"ץ העדה החרדית (Edah Hacharedit)
  119: 'badatz',   // בד"ץ בית יוסף
  109: 'badatz',   // בד"ץ קהילות
  120: 'badatz',   // אגודת ישראל
  118: 'mehadrin', // הרב מחפוד
  116: 'mehadrin', // הרב לנדא
  114: 'mehadrin', // הרב רובין
  112: 'mehadrin', // חתם סופר
  108: 'mehadrin', // רבנויות מהדרים
  1152: 'mehadrin',// הרב אפרתי
};

// ─── Fetch all restaurants for a city from charedi.net ───────────────────────

interface CharediRestaurant {
  id: number;
  title: { rendered: string };
  kosher: number[];
}

async function fetchCityRestaurants(cityId: number): Promise<CharediRestaurant[]> {
  const results: CharediRestaurant[] = [];
  let page = 1;

  while (true) {
    await new Promise((r) => setTimeout(r, 300));
    try {
      const res = await axios.get<CharediRestaurant[]>(
        'https://charedi.net/wp-json/wp/v2/restaurants',
        {
          params: {
            restaurant_city: cityId,
            per_page: 100,
            page,
            _fields: 'id,title,kosher',
          },
          headers: { 'User-Agent': 'JewishOnTheWay/1.0 (meryl.hasid@gmail.com)' },
          timeout: 10_000,
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

// ─── Fuzzy name matching ─────────────────────────────────────────────────────

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalize(s: string): string {
  return decodeHtmlEntities(s)
    .toLowerCase()
    .replace(/['"״״""\-–—()\[\].,!?&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// City name words to exclude from word-overlap matching
const CITY_WORDS = new Set(['אשדוד', 'תל', 'אביב', 'ירושלים', 'בנמל', 'אגדיר']);

function nameMatch(dbName: string, charediName: string): boolean {
  const a = normalize(dbName);
  const b = normalize(charediName);
  if (!a || !b) return false;
  if (a === b) return true;
  // Substring match only if the shorter side is ≥ 6 chars (avoids city-only matches)
  if (a.length >= 6 && b.includes(a)) return true;
  if (b.length >= 6 && a.includes(b)) return true;
  // Share ≥ 2 meaningful non-city words (length > 3)
  const aWords = a.split(' ').filter((w) => w.length > 3 && !CITY_WORDS.has(w));
  const bSet   = new Set(b.split(' ').filter((w) => w.length > 3 && !CITY_WORDS.has(w)));
  if (aWords.length === 0 || bSet.size === 0) return false;
  return aWords.filter((w) => bSet.has(w)).length >= 2;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  await db.initialize();
  const repo = db.getRepository(Restaurant);

  // Build a map: city → charedi restaurants
  const cityCache = new Map<number, CharediRestaurant[]>();

  const allRestaurants = await repo
    .createQueryBuilder('r')
    .select(['r.id', 'r.name', 'r.city', 'r.kashrutLevel'])
    .getMany();

  console.log(`Loaded ${allRestaurants.length} restaurants from DB.\n`);

  let updated = 0;
  let unchanged = 0;
  let noMatch = 0;

  for (const r of allRestaurants) {
    const cityId = CITY_IDS[r.city ?? ''];
    if (!cityId) {
      noMatch++;
      continue;
    }

    // Load charedi.net data for this city (cached)
    if (!cityCache.has(cityId)) {
      console.log(`Fetching charedi.net for city "${r.city}" (id ${cityId})…`);
      const data = await fetchCityRestaurants(cityId);
      cityCache.set(cityId, data);
      console.log(`  → ${data.length} mehadrin/badatz restaurants found`);
      // Print all charedi names + their normalized form for debugging
      data.forEach((c) => {
        const norm = normalize(c.title.rendered);
        console.log(`     charedi raw: "${c.title.rendered}" → norm: "${norm}" [${c.kosher}]`);
      });
      console.log();
    }

    const cityData = cityCache.get(cityId)!;
    const match = cityData.find((c) =>
      nameMatch(r.name, c.title.rendered),
    );

    if (!match) {
      noMatch++;
      continue;
    }

    // Determine the strictest level from the kosher taxonomy IDs
    let newLevel: 'mehadrin' | 'badatz' | null = null;
    for (const kid of match.kosher) {
      const level = KOSHER_LEVEL[kid];
      if (level === 'badatz') { newLevel = 'badatz'; break; }
      if (level === 'mehadrin') newLevel = 'mehadrin';
    }

    if (!newLevel) {
      console.log(`  ? ${r.name} — matched but unknown kosher IDs: ${match.kosher}`);
      noMatch++;
      continue;
    }

    if (newLevel === r.kashrutLevel) {
      unchanged++;
      continue;
    }

    await repo.update(r.id, { kashrutLevel: newLevel });
    console.log(`  ✓ ${r.name}: ${r.kashrutLevel} → ${newLevel}  [charedi IDs: ${match.kosher}]`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated} | Unchanged: ${unchanged} | No match: ${noMatch}`);

  const counts: { kashrutLevel: string; total: string }[] = await db.query(
    `SELECT kashrut_level AS "kashrutLevel", COUNT(*) AS total
     FROM restaurants GROUP BY kashrut_level ORDER BY kashrut_level`,
  );
  console.log('\nFinal kashrut breakdown:');
  counts.forEach((c) => console.log(`  ${c.kashrutLevel}: ${c.total}`));

  await db.destroy();
}

main().catch((e) => { console.error(e); process.exit(1); });
