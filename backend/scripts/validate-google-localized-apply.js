'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');

const file = process.argv[2] || 'audit-output/google-localized-addresses-preview-all-he-en.csv';

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
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else if (ch === '\n') {
      fields.push(cur);
      rows.push(fields);
      fields = [];
      cur = '';
    } else if (ch !== '\r') cur += ch;
  }
  if (cur || fields.length) {
    fields.push(cur);
    rows.push(fields);
  }
  const header = rows[0] || [];
  return rows.slice(1).map((row) => Object.fromEntries(header.map((h, i) => [h, row[i]])));
}

function hasHebrew(value) {
  return /[\u0590-\u05ff]/.test(String(value || ''));
}

(async () => {
  const fullPath = path.isAbsolute(file) ? file : path.join(__dirname, '..', file);
  const csvRows = parseCsv(fullPath);
  const byId = new Map(csvRows.map((row) => [Number(row.id), row]));
  const ids = [...byId.keys()];

  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await db.connect();
  const { rows } = await db.query(
    `select id, name, address,
            google_display_name_he, google_formatted_address_he,
            google_display_name_en, google_formatted_address_en
       from restaurants
      where id = ANY($1)
      order by id`,
    [ids],
  );
  await db.end();

  let sourceChanged = 0;
  let heAddressMismatch = 0;
  let enAddressMismatch = 0;
  let heExpectedNull = 0;
  let heActualNull = 0;

  for (const dbRow of rows) {
    const csv = byId.get(Number(dbRow.id));
    if (!csv) continue;
    if (dbRow.name !== csv.name || dbRow.address !== csv.original_address) {
      sourceChanged++;
    }
    const expectedHe = hasHebrew(csv.google_address_he) ? csv.google_address_he || null : null;
    if (expectedHe == null) heExpectedNull++;
    if (dbRow.google_formatted_address_he == null) heActualNull++;
    if ((dbRow.google_formatted_address_he || null) !== expectedHe) {
      heAddressMismatch++;
    }
    if ((dbRow.google_formatted_address_en || null) !== (csv.google_address_en || null)) {
      enAddressMismatch++;
    }
  }

  console.log('=== VALIDATE GOOGLE LOCALIZED APPLY ===');
  console.log(`csv rows: ${csvRows.length}`);
  console.log(`db rows: ${rows.length}`);
  console.log(`source name/address changed: ${sourceChanged}`);
  console.log(`he address expected null fallback: ${heExpectedNull}`);
  console.log(`he address actual null fallback: ${heActualNull}`);
  console.log(`he address mismatches: ${heAddressMismatch}`);
  console.log(`en address mismatches: ${enAddressMismatch}`);
  if (sourceChanged || heAddressMismatch || enAddressMismatch) {
    process.exit(1);
  }
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
