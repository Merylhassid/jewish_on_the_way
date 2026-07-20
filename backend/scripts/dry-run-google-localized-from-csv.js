'use strict';

/*
 * Fetch localized Google display fields for rows in a CSV that already has
 * google_place_id. DRY-RUN only: writes a preview CSV and a DB backup for the
 * selected ids, but does not update restaurants.
 *
 * Useful for pending triage rows before they become verified.
 *
 * Usage:
 *   node scripts/dry-run-google-localized-from-csv.js audit-output/pending-triage.csv --triage right --langs he,en
 *   node scripts/dry-run-google-localized-from-csv.js some.csv --limit 20
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const file = process.argv[2];
const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
};

const LIMIT = arg('--limit') ? Number(arg('--limit')) : null;
const OFFSET = arg('--offset') ? Number(arg('--offset')) : 0;
const TRIAGE = arg('--triage');
const LANGS = (arg('--langs') || 'he,en')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const RATE_MS = Number(arg('--rate-ms') || 160);
const FIELD_MASK = 'id,displayName,formattedAddress,shortFormattedAddress';
const OUT_FILE_ARG = arg('--out');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCsv(filename) {
  const text = fs.readFileSync(filename, 'utf8').replace(/^\ufeff/, '');
  const rows = [];
  let fields = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
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
    .map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? ''])));
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

function writePreview(outFile, columns, outRows) {
  fs.writeFileSync(
    outFile,
    '\ufeff' + [columns.join(','), ...outRows.map((row) => columns.map((col) => csvEsc(row[col])).join(','))].join('\n') + '\n',
    'utf8',
  );
}

(async () => {
  if (!file) {
    console.error('usage: node scripts/dry-run-google-localized-from-csv.js <csv> [--triage right] [--langs he,en] [--limit N]');
    process.exit(1);
  }
  if (!process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_API_KEY === 'your_google_places_api_key') {
    throw new Error('Missing GOOGLE_PLACES_API_KEY in backend/.env');
  }
  if (LIMIT != null && (!Number.isFinite(LIMIT) || LIMIT < 1)) {
    throw new Error('--limit must be a positive number');
  }

  const fullPath = path.isAbsolute(file) ? file : path.join(__dirname, '..', file);
  let rows = parseCsv(fullPath).filter((row) => row.google_place_id);
  if (TRIAGE) rows = rows.filter((row) => row.triage === TRIAGE);
  rows = rows.sort((a, b) => Number(a.id) - Number(b.id));
  if (OFFSET) rows = rows.slice(OFFSET);
  if (LIMIT != null) rows = rows.slice(0, LIMIT);

  const ids = rows.map((row) => Number(row.id)).filter(Number.isFinite);
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await db.connect();

  const backupCols = [
    'name',
    'address',
    'verification_status',
    'google_place_id',
    'google_display_name_he',
    'google_formatted_address_he',
    'google_display_name_en',
    'google_formatted_address_en',
  ];
  const backup = ids.length
    ? (
        await db.query(
          `select id, ${backupCols.map((col) => `"${col}"`).join(', ')}
             from restaurants
            where id = ANY($1)
            order by id`,
          [ids],
        )
      ).rows
    : [];
  await db.end();

  const stamp = `${TRIAGE || 'all'}-offset-${OFFSET}-limit-${LIMIT || 'all'}-${LANGS.join('-')}`;
  const backupFile = path.join(__dirname, '..', 'audit-output', `google-localized-from-csv-backup-${stamp}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify({ takenAt: new Date().toISOString(), source: file, triage: TRIAGE || null, count: backup.length, rows: backup }, null, 2),
    'utf8',
  );

  const outRows = [];
  let calls = 0;
  const columns = [
    'id',
    'old_name',
    'old_address',
    'google_place_id',
    'current_google_name',
    'current_google_address',
    'triage',
    'triage_reason',
    ...LANGS.flatMap((lang) => [
      `google_name_${lang}`,
      `google_name_lang_${lang}`,
      `google_address_${lang}`,
      `google_short_address_${lang}`,
      `address_has_hebrew_${lang}`,
    ]),
  ];
  const outFile = OUT_FILE_ARG
    ? (path.isAbsolute(OUT_FILE_ARG) ? OUT_FILE_ARG : path.join(__dirname, '..', OUT_FILE_ARG))
    : path.join(__dirname, '..', 'audit-output', `google-localized-from-csv-preview-${stamp}.csv`);

  for (const row of rows) {
    const out = {
      id: row.id,
      old_name: row.old_name,
      old_address: row.old_address,
      google_place_id: row.google_place_id,
      current_google_name: row.google_name,
      current_google_address: row.google_address,
      triage: row.triage || '',
      triage_reason: row.triage_reason || '',
    };

    for (const lang of LANGS) {
      const details = await googleDetails(row.google_place_id, lang);
      calls += 1;
      out[`google_name_${lang}`] = details.displayName?.text || '';
      out[`google_name_lang_${lang}`] = details.displayName?.languageCode || '';
      out[`google_address_${lang}`] = stripCountryNoise(details.formattedAddress || '');
      out[`google_short_address_${lang}`] = stripCountryNoise(details.shortFormattedAddress || '');
      out[`address_has_hebrew_${lang}`] = hasHebrew(details.formattedAddress) ? 'yes' : 'no';
    }

    outRows.push(out);
    writePreview(outFile, columns, outRows);
    if (outRows.length % 25 === 0 || outRows.length === rows.length) {
      console.log(`progress: ${outRows.length}/${rows.length} rows, ${calls} google calls`);
    }
  }

  console.log('=== GOOGLE LOCALIZED FROM CSV — DRY-RUN ===');
  console.log(`source: ${path.relative(path.join(__dirname, '..'), fullPath)}`);
  console.log(`rows: ${rows.length}`);
  console.log(`offset: ${OFFSET}`);
  console.log(`triage filter: ${TRIAGE || '(none)'}`);
  console.log(`languages: ${LANGS.join(', ')}`);
  console.log(`google calls made: ${calls}`);
  console.log(`field mask: ${FIELD_MASK}`);
  console.log(`output: ${path.relative(path.join(__dirname, '..'), outFile)}`);
  console.log(`backup: ${path.relative(path.join(__dirname, '..'), backupFile)}`);
  console.log('NO DB WRITES.');
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
