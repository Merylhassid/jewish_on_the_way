/**
 * After the Sharon import ran before Netanya/Kfar Saba/Ra'anana/Ramat HaSharon
 * were added to CITY_EN, those restaurants landed on Tel Aviv destination.
 * This script re-parses the Sharon file, identifies the affected names,
 * and updates them to the correct city + destinationId.
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

// Cities that were missing from CITY_EN during Sharon import → now correct mapping
const SHARON_CITY_FIX: Record<string, { city: string; destination: string }> = {
  נתניה:       { city: 'Netanya',       destination: 'Netanya' },
  'כפר סבא':  { city: 'Kfar Saba',     destination: 'Kfar Saba' },
  רעננה:       { city: "Ra'anana",      destination: "Ra'anana" },
  'רמת השרון': { city: 'Ramat HaSharon', destination: 'Ramat HaSharon' },
  'אור עקיבא': { city: 'Or Akiva',      destination: 'Hadera' },
};

// Known city names for parser
const KNOWN_CITIES_HE = new Set(Object.keys(SHARON_CITY_FIX));
// Add common cities so parser doesn't confuse them with restaurant names
['תל אביב','ירושלים','חיפה','באר שבע','חדרה','הרצליה','נתניה','כפר סבא','רעננה','רמת השרון','אור עקיבא'].forEach(c => KNOWN_CITIES_HE.add(c));

const PHONE_RE = /^(0[0-9]{1,2}[-\s][0-9]{6,8}|1[-][78]00[-][0-9]{6,7})$/;
const NOISE_RES = [
  /^נמצאו \d+ מסעדות/,
  /^פרטי המסעדה/,
  /^הזמנת שולחן/,
  /^הזמנת משלוח/,
  /^מפה$/,
  /^קדימה$/,
  /^ ?\d+ חוות דעת$/,
  /^TOP 10#\d+/i,
  /^Top 10 מסעדות/,
  /^מסעדות \S+ כשרות/,
  /^מסעדה מאזור/,
  /^כתבות אחרונות/,
  /קראו עוד/,
  /^\d{2}\/\d{2}\/\d{4}$/,
  /^מערכת\s+zap/i,
  /^מחפשים מסעדת/,
  /^לא תשארו רעבים/,
  /^\d+\s*ק"מ$/,
  /^קישור למסעדה$/,
];

function isNoise(line: string): boolean {
  return !line || NOISE_RES.some((re) => re.test(line));
}

function looksLikeTypeLine(line: string): boolean {
  if (line.includes('כשר')) return true;
  return ['מסעדת','מסעדה','בתי קפה','פיצריות','חומוסייה','קונדיטוריה','פאבים',
          'שניצליה','שף','אוכל רחוב','מטבח ביתי','שווארמה','קייטרינג','גלידריות',
          "סנדוויץ' בר",'סנדביץ'].some(k => line.includes(k));
}

function extractCityFromAddress(addrLine: string): { street: string; hebrewCity: string } {
  const beforePipe = addrLine.split('|')[0].trim();
  const parts = beforePipe.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 1) return { street: '', hebrewCity: parts[0] };
  for (let i = parts.length - 1; i >= 0; i--) {
    if (KNOWN_CITIES_HE.has(parts[i])) return { street: parts.slice(0, i).join(', '), hebrewCity: parts[i] };
  }
  return { street: parts.slice(0, -1).join(', '), hebrewCity: parts[parts.length - 1] };
}

function cleanName(raw: string): string {
  let name = raw.trim().replace(/\s*\([^)]*כשר[^)]*\)/g, '').trim();
  const dashIdx = name.indexOf(' - ');
  if (dashIdx !== -1) return name.slice(0, dashIdx).trim();
  return name;
}

function parseForCities(rawText: string): Array<{ name: string; hebrewCity: string }> {
  const results: Array<{ name: string; hebrewCity: string }> = [];
  const cleanLines = rawText.split('\n').map(l => l.trim()).filter(l => !isNoise(l));
  let blockStart = 0;

  for (let i = 0; i < cleanLines.length; i++) {
    if (!PHONE_RE.test(cleanLines[i])) continue;
    const block = cleanLines.slice(blockStart, i + 1).filter(l => l.length > 0);
    blockStart = i + 1;
    if (block.length < 2) continue;

    const content = block.slice(0, -1);
    let typeIdx = -1;
    for (let j = content.length - 1; j >= 0; j--) {
      if (looksLikeTypeLine(content[j])) { typeIdx = j; break; }
    }

    const nameLines = typeIdx !== -1 ? content.slice(0, typeIdx) : content;
    const addrLines = typeIdx !== -1 ? content.slice(typeIdx + 1) : [];

    const nonCity = nameLines.filter(l => !KNOWN_CITIES_HE.has(l));
    const rawName = nonCity.length > 1 ? nonCity[1] : (nonCity[0] ?? '');
    const name = cleanName(rawName);
    if (!name) continue;

    let hebrewCity = '';
    if (addrLines.length > 0) {
      hebrewCity = extractCityFromAddress(addrLines[0]).hebrewCity;
    }
    if (!hebrewCity) {
      for (const l of nameLines) {
        if (KNOWN_CITIES_HE.has(l)) { hebrewCity = l; break; }
      }
    }

    if (hebrewCity && SHARON_CITY_FIX[hebrewCity]) {
      results.push({ name, hebrewCity });
    }
  }
  return results;
}

async function main() {
  const sharonFile = path.join(__dirname, '../node_modules/yoctocolors-cjs/restaurent-sharon');
  if (!fs.existsSync(sharonFile)) {
    console.error('Sharon file not found:', sharonFile);
    process.exit(1);
  }

  const rawText = fs.readFileSync(sharonFile, 'utf-8');
  const parsed = parseForCities(rawText);
  console.log(`Found ${parsed.length} restaurants in Sharon file needing destination fix`);

  const grouped: Record<string, string[]> = {};
  for (const { name, hebrewCity } of parsed) {
    if (!grouped[hebrewCity]) grouped[hebrewCity] = [];
    grouped[hebrewCity].push(name);
  }
  for (const [city, names] of Object.entries(grouped)) {
    console.log(`  ${city} → ${SHARON_CITY_FIX[city].destination}: ${names.length} restaurants`);
  }

  await AppDataSource.initialize();
  console.log('\nDB connected. Applying fixes...\n');

  let totalUpdated = 0;

  for (const [hebrewCity, fix] of Object.entries(SHARON_CITY_FIX)) {
    const names = grouped[hebrewCity];
    if (!names || names.length === 0) continue;

    const dest = await AppDataSource.query(
      `SELECT id FROM destinations WHERE name = $1`,
      [fix.destination],
    );
    if (!dest[0]) {
      console.warn(`  ⚠ Destination "${fix.destination}" not found in DB, skipping ${hebrewCity}`);
      continue;
    }
    const destId = dest[0].id;

    let cityUpdated = 0;
    for (const name of names) {
      const res = await AppDataSource.query(
        `UPDATE restaurants SET city = $1, "destinationId" = $2
         WHERE name = $3 AND city = 'Tel Aviv'`,
        [fix.city, destId, name],
      );
      if (res[1] > 0) {
        cityUpdated += res[1];
        console.log(`  ✓ ${name} → ${fix.city} (${fix.destination})`);
      }
    }
    console.log(`  ${hebrewCity}: updated ${cityUpdated} restaurants\n`);
    totalUpdated += cityUpdated;
  }

  console.log(`\nTotal updated: ${totalUpdated} restaurants`);
  await AppDataSource.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
