'use strict';

/*
 * Dry-run localized Google Place Details for verified restaurants.
 *
 * DRY-RUN by default. Reads verified restaurants with google_place_id, calls
 * Place Details (New) with a narrow field mask, and writes a CSV so we can
 * inspect language-specific display names/addresses before applying.
 *
 * With --apply, writes ONLY the localized Google shadow columns:
 *   google_display_name_he, google_formatted_address_he,
 *   google_display_name_en, google_formatted_address_en.
 * It never touches name/address or the generic google_display_name/address.
 *
 * Usage:
 *   node scripts/dry-run-google-localized-addresses.js [--limit 20] [--langs he,en]
 *   node scripts/dry-run-google-localized-addresses.js --all --langs he,en
 *   node scripts/dry-run-google-localized-addresses.js --all --langs he,en --apply
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
};

const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');
const LIMIT = ALL ? null : Number(arg('--limit') || 20);
const LANGS = (arg('--langs') || 'he,en')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const RATE_MS = Number(arg('--rate-ms') || 160);
const FIELD_MASK = 'id,displayName,formattedAddress,shortFormattedAddress';
const TARGETS = {
  he: {
    name: 'google_display_name_he',
    address: 'google_formatted_address_he',
  },
  en: {
    name: 'google_display_name_en',
    address: 'google_formatted_address_en',
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function hasHebrew(value) {
  return /[\u0590-\u05ff]/.test(String(value || ''));
}

function stripCountryNoise(value) {
  return String(value || '')
    .replace(/,\s*Israel\s*$/i, '')
    .replace(/,\s*ישראל\s*$/i, '')
    .trim();
}

async function googleDetails(placeId, languageCode) {
  const params = new URLSearchParams({ languageCode, regionCode: 'IL' });
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
  });
  await sleep(RATE_MS);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Details ${res.status} for ${placeId}/${languageCode}: ${text.slice(0, 240)}`);
  }
  return res.json();
}

(async () => {
  if (!process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_API_KEY === 'your_google_places_api_key') {
    throw new Error('Missing GOOGLE_PLACES_API_KEY in backend/.env');
  }
  if (LIMIT != null && (!Number.isFinite(LIMIT) || LIMIT < 1)) {
    throw new Error('--limit must be a positive number');
  }
  if (!LANGS.length) {
    throw new Error('--langs must include at least one language code');
  }
  const unsupported = LANGS.filter((lang) => !TARGETS[lang]);
  if (unsupported.length) {
    throw new Error(`Unsupported --langs for apply/storage: ${unsupported.join(', ')}. Supported: ${Object.keys(TARGETS).join(', ')}`);
  }

  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await db.connect();

  const colsInDb = new Set(
    (
      await db.query(
        `select column_name from information_schema.columns where table_name='restaurants'`,
      )
    ).rows.map((row) => row.column_name),
  );
  const requiredCols = LANGS.flatMap((lang) => [
    TARGETS[lang].name,
    TARGETS[lang].address,
  ]);
  const missingCols = requiredCols.filter((col) => !colsInDb.has(col));

  const { rows } = await db.query(
    `select id, name, address, google_place_id, google_display_name, google_formatted_address
       from restaurants
      where verification_status = 'verified'
        and google_place_id is not null
      order by id
      ${LIMIT == null ? '' : 'limit $1'}`,
    LIMIT == null ? [] : [LIMIT],
  );

  const backupFile = path.join(
    __dirname,
    '..',
    'audit-output',
    `google-localized-addresses-backup-${LIMIT == null ? 'all' : LIMIT}-${LANGS.join('-')}.json`,
  );
  const ids = rows.map((row) => Number(row.id));
  const existingBackupCols = requiredCols.filter((col) => colsInDb.has(col));
  const backup = ids.length
    ? (
        await db.query(
          `select id${existingBackupCols.length ? `, ${existingBackupCols.map((col) => `"${col}"`).join(', ')}` : ''}
             from restaurants
            where id = ANY($1)
            order by id`,
          [ids],
        )
      ).rows
    : [];
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      { takenAt: new Date().toISOString(), count: backup.length, rows: backup },
      null,
      2,
    ),
    'utf8',
  );
  await db.end();

  const outRows = [];
  let calls = 0;

  for (const restaurant of rows) {
    const localized = {};
    for (const lang of LANGS) {
      const details = await googleDetails(restaurant.google_place_id, lang);
      calls++;
      localized[lang] = {
        displayName: details.displayName?.text || '',
        displayNameLang: details.displayName?.languageCode || '',
        formattedAddress: details.formattedAddress || '',
        shortFormattedAddress: details.shortFormattedAddress || '',
      };
    }

    const row = {
      id: restaurant.id,
      name: restaurant.name,
      original_address: restaurant.address,
      current_google_name: restaurant.google_display_name,
      current_google_address: restaurant.google_formatted_address,
      google_place_id: restaurant.google_place_id,
    };

    for (const lang of LANGS) {
      const got = localized[lang] || {};
      row[`google_name_${lang}`] = got.displayName;
      row[`google_name_lang_${lang}`] = got.displayNameLang;
      row[`google_address_${lang}`] = stripCountryNoise(got.formattedAddress);
      row[`google_short_address_${lang}`] = stripCountryNoise(got.shortFormattedAddress);
      row[`address_has_hebrew_${lang}`] = hasHebrew(got.formattedAddress) ? 'yes' : 'no';
    }

    outRows.push(row);
  }

  const columns = [
    'id',
    'name',
    'original_address',
    'current_google_name',
    'current_google_address',
    'google_place_id',
    ...LANGS.flatMap((lang) => [
      `google_name_${lang}`,
      `google_name_lang_${lang}`,
      `google_address_${lang}`,
      `google_short_address_${lang}`,
      `address_has_hebrew_${lang}`,
    ]),
  ];

  const outFile = path.join(
    __dirname,
    '..',
    'audit-output',
    `google-localized-addresses-preview-${LIMIT == null ? 'all' : LIMIT}-${LANGS.join('-')}.csv`,
  );
  fs.writeFileSync(
    outFile,
    '\ufeff' + [columns.join(','), ...outRows.map((r) => columns.map((c) => csvEsc(r[c])).join(','))].join('\n') + '\n',
    'utf8',
  );

  console.log(`=== GOOGLE LOCALIZED ADDRESSES ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);
  console.log(`restaurants: ${rows.length}`);
  console.log(`languages: ${LANGS.join(', ')}`);
  console.log(`google calls made: ${calls}`);
  console.log(`field mask: ${FIELD_MASK}`);
  console.log(`output: ${path.relative(path.join(__dirname, '..'), outFile)}`);
  console.log(`backup: ${path.relative(path.join(__dirname, '..'), backupFile)}`);
  if (missingCols.length) {
    console.log(`missing DB columns: ${missingCols.join(', ')}`);
  }

  if (!APPLY) {
    console.log('DRY-RUN only — NO DB WRITES. Re-run with --apply to write localized google_* columns.');
    return;
  }

  if (missingCols.length) {
    throw new Error('Refusing --apply because localized columns are missing. Run the migration first.');
  }

  const writeDb = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await writeDb.connect();

  let written = 0;
  for (const row of outRows) {
    const sets = [];
    const vals = [];
    let i = 1;
    for (const lang of LANGS) {
      sets.push(`"${TARGETS[lang].name}"=$${i++}`);
      vals.push(row[`google_name_${lang}`] || null);
      sets.push(`"${TARGETS[lang].address}"=$${i++}`);
      vals.push(row[`google_address_${lang}`] || null);
    }
    vals.push(Number(row.id));
    await writeDb.query(`update restaurants set ${sets.join(', ')} where id=$${i}`, vals);
    written++;
  }
  await writeDb.end();
  console.log(`APPLIED: ${written} rows updated (localized Google shadow fields only).`);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
