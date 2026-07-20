'use strict';

/*
 * Apply localized Google display fields from the reviewed CSV.
 *
 * DRY-RUN by default. With --apply, writes ONLY:
 *   google_display_name_he, google_formatted_address_he,
 *   google_display_name_en, google_formatted_address_en
 *
 * It never touches restaurants.name / restaurants.address or the generic
 * google_display_name / google_formatted_address.
 *
 * Usage:
 *   node scripts/apply-google-localized-addresses.js audit-output/google-localized-addresses-preview-all-he-en.csv
 *   node scripts/apply-google-localized-addresses.js audit-output/google-localized-addresses-preview-all-he-en.csv --apply
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const file = process.argv[2];
const APPLY = process.argv.includes('--apply');

const TARGETS = {
  google_name_he: 'google_display_name_he',
  google_address_he: 'google_formatted_address_he',
  google_name_en: 'google_display_name_en',
  google_address_en: 'google_formatted_address_en',
};

function parseCsv(filename) {
  const text = fs.readFileSync(filename, 'utf8').replace(/^\ufeff/, '');
  const rows = [];
  let fields = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else if (ch === '\n') {
      fields.push(cur);
      rows.push(fields);
      fields = [];
      cur = '';
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  if (cur || fields.length) {
    fields.push(cur);
    rows.push(fields);
  }
  const header = rows[0] || [];
  return rows
    .slice(1)
    .filter((row) => row.length >= header.length)
    .map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

function hasHebrew(value) {
  return /[\u0590-\u05ff]/.test(String(value || ''));
}

function clean(value) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function localizedValue(row, sourceColumn) {
  const value = clean(row[sourceColumn]);
  if (sourceColumn === 'google_address_he' && !hasHebrew(value)) {
    return null;
  }
  return value;
}

(async () => {
  if (!file) {
    console.error('usage: node scripts/apply-google-localized-addresses.js <preview.csv> [--apply]');
    process.exit(1);
  }

  const fullPath = path.isAbsolute(file) ? file : path.join(__dirname, '..', file);
  const rows = parseCsv(fullPath);
  if (!rows.length) throw new Error(`No rows found in ${file}`);

  const ids = rows.map((row) => Number(row.id)).filter(Number.isFinite);
  if (ids.length !== rows.length) throw new Error('CSV contains rows with invalid id');

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
  const missingCols = Object.values(TARGETS).filter((col) => !colsInDb.has(col));

  const backupCols = [
    'name',
    'address',
    ...Object.values(TARGETS).filter((col) => colsInDb.has(col)),
  ];
  const found = await db.query(
    `select id, ${backupCols.map((col) => `"${col}"`).join(', ')}
       from restaurants
      where id = ANY($1)
      order by id`,
    [ids],
  );
  const foundIds = new Set(found.rows.map((row) => Number(row.id)));
  const missingRows = ids.filter((id) => !foundIds.has(id));

  const backupFile = fullPath.replace(/\.csv$/i, '-apply-backup.json');
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        count: found.rows.length,
        rows: found.rows,
      },
      null,
      2,
    ),
    'utf8',
  );

  const hebrewAddressRows = rows.filter((row) => hasHebrew(row.google_address_he)).length;
  const hebrewAddressNulls = rows.length - hebrewAddressRows;

  console.log(`=== APPLY GOOGLE LOCALIZED ADDRESSES ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);
  console.log(`csv rows: ${rows.length}`);
  console.log(`db rows found: ${found.rows.length}`);
  console.log(`missing rows: ${missingRows.length}`);
  console.log(`hebrew addresses to write: ${hebrewAddressRows}`);
  console.log(`hebrew addresses fallback/null: ${hebrewAddressNulls}`);
  console.log(`backup: ${path.relative(path.join(__dirname, '..'), backupFile)}`);
  if (missingCols.length) console.log(`missing DB columns: ${missingCols.join(', ')}`);

  if (!APPLY) {
    console.log('DRY-RUN only — no DB writes. Re-run with --apply to write localized google_* columns.');
    await db.end();
    return;
  }

  if (missingCols.length) {
    await db.end();
    throw new Error('Refusing --apply because localized columns are missing. Run migration first.');
  }
  if (missingRows.length) {
    await db.end();
    throw new Error(`Refusing --apply because ${missingRows.length} CSV rows are missing in DB.`);
  }

  let written = 0;
  for (const row of rows) {
    await db.query(
      `update restaurants
          set google_display_name_he=$1,
              google_formatted_address_he=$2,
              google_display_name_en=$3,
              google_formatted_address_en=$4
        where id=$5`,
      [
        localizedValue(row, 'google_name_he'),
        localizedValue(row, 'google_address_he'),
        localizedValue(row, 'google_name_en'),
        localizedValue(row, 'google_address_en'),
        Number(row.id),
      ],
    );
    written++;
  }

  await db.end();
  console.log(`APPLIED: ${written} rows updated (localized Google fields only).`);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
