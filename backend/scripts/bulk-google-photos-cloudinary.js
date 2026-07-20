'use strict';

/*
 * Bulk Google Place Photos -> Cloudinary.
 *
 * Writes to Cloudinary and a CSV audit file only. It does NOT update the DB.
 *
 * Usage:
 *   node scripts/bulk-google-photos-cloudinary.js --all [--offset 20] [--max-width 800]
 *   node scripts/bulk-google-photos-cloudinary.js --limit 100 [--offset 20]
 *   node scripts/bulk-google-photos-cloudinary.js --id 5980
 *   node scripts/bulk-google-photos-cloudinary.js --ids-file audit-output/some-ids.csv
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { v2: cloudinary } = require('cloudinary');
const { GooglePlaces } = require('./lib/google-places');

const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
};

const hasFlag = (flag) => process.argv.includes(flag);

const LIMIT_ARG = arg('--limit');
const ID_ARG = arg('--id');
const IDS_FILE_ARG = arg('--ids-file');
const ID = ID_ARG ? Number(ID_ARG) : null;
const ALL = hasFlag('--all');
const LIMIT = ALL ? null : Number(LIMIT_ARG || 20);
const OFFSET = Number(arg('--offset') || 0);
const MAX_WIDTH = Number(arg('--max-width') || 800);
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');

function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, columns, rows) {
  fs.writeFileSync(
    file,
    '\ufeff' + [columns.join(','), ...rows.map((row) => columns.map((col) => csvEsc(row[col])).join(','))].join('\n') + '\n',
    'utf8',
  );
}

function parseCsvIds(file) {
  const fullPath = path.isAbsolute(file) ? file : path.join(__dirname, '..', file);
  const text = fs.readFileSync(fullPath, 'utf8').replace(/^\ufeff/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((header) => header.replace(/^"|"$/g, ''));
  const idIndex = headers.indexOf('id');
  if (idIndex < 0) throw new Error(`--ids-file must contain an id column: ${file}`);
  const ids = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const id = Number(String(cols[idIndex] || '').replace(/^"|"$/g, ''));
    if (Number.isFinite(id) && id > 0) ids.push(id);
  }
  return [...new Set(ids)];
}

function uploadBuffer(buffer, { publicId, contentType }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'restaurants/google',
        public_id: publicId,
        resource_type: 'image',
        overwrite: true,
        context: {
          source: 'google_places_photo',
        },
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          format: result.format,
          contentType,
        });
      },
    );
    stream.end(buffer);
  });
}

(async () => {
  if (ID !== null && IDS_FILE_ARG) {
    throw new Error('Use either --id or --ids-file, not both');
  }
  if (ID !== null && (!Number.isFinite(ID) || ID < 1)) {
    throw new Error('--id must be a positive number');
  }
  if (ID === null && !IDS_FILE_ARG && !ALL && (!Number.isFinite(LIMIT) || LIMIT < 1)) {
    throw new Error('Use --all or provide --limit with a positive number');
  }
  if (!Number.isFinite(OFFSET) || OFFSET < 0) {
    throw new Error('--offset must be zero or a positive number');
  }
  if (!Number.isFinite(MAX_WIDTH) || MAX_WIDTH < 100) {
    throw new Error('--max-width must be at least 100');
  }
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    throw new Error('Missing GOOGLE_PLACES_API_KEY');
  }
  for (const key of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await db.connect();

  const totalWithPhoto = Number(
    (await db.query(
      `select count(*)::int as n
         from restaurants
        where verification_status = 'verified'
          and google_photo_name is not null`,
    )).rows[0].n,
  );

  const idsFromFile = IDS_FILE_ARG ? parseCsvIds(IDS_FILE_ARG) : [];

  const query = IDS_FILE_ARG
    ? `
    select id, name, address, google_display_name, google_photo_name, google_photo_attribution
      from restaurants
     where verification_status = 'verified'
       and google_photo_name is not null
       and photo_url is null
       and id = any($1::int[])
     order by id
  `
    : ID !== null
    ? `
    select id, name, address, google_display_name, google_photo_name, google_photo_attribution
      from restaurants
     where verification_status = 'verified'
       and google_photo_name is not null
       and id = $1
     order by id
  `
    : `
    select id, name, address, google_display_name, google_photo_name, google_photo_attribution
      from restaurants
     where verification_status = 'verified'
       and google_photo_name is not null
     order by id
     ${ALL ? '' : 'limit $1'}
     offset ${ALL ? '$1' : '$2'}
  `;
  const params = IDS_FILE_ARG ? [idsFromFile] : ID !== null ? [ID] : (ALL ? [OFFSET] : [LIMIT, OFFSET]);
  const { rows } = await db.query(query, params);
  await db.end();

  const columns = [
    'id',
    'name',
    'google_name',
    'status',
    'cloudinary_url',
    'cloudinary_public_id',
    'width',
    'height',
    'bytes',
    'format',
    'elapsed_ms',
    'google_photo_name',
    'google_photo_attribution',
    'error',
  ];
  const outFile = path.join(
    __dirname,
    '..',
    'audit-output',
    `google-photos-cloudinary-bulk-${IDS_FILE_ARG ? 'ids-file' : ID !== null ? `id-${ID}` : (ALL ? 'all' : LIMIT)}-offset-${OFFSET}-${STAMP}.csv`,
  );
  const outRows = [];
  writeCsv(outFile, columns, outRows);

  const gp = new GooglePlaces(process.env.GOOGLE_PLACES_API_KEY, { rateMs: 180 });
  console.log('=== GOOGLE PHOTOS -> CLOUDINARY BULK ===');
  console.log(`verified with google_photo_name: ${totalWithPhoto}`);
  if (IDS_FILE_ARG) console.log(`ids-file: ${IDS_FILE_ARG} (${idsFromFile.length} ids)`);
  if (ID !== null) console.log(`id: ${ID}`);
  console.log(`offset: ${OFFSET}`);
  console.log(`selected for this run: ${rows.length}`);
  console.log(`output: ${path.relative(path.join(__dirname, '..'), outFile)}`);
  console.log('NO DB WRITES.');

  let ok = 0;
  let errors = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const startedAt = Date.now();
    const out = {
      id: row.id,
      name: row.name,
      google_name: row.google_display_name,
      google_photo_name: row.google_photo_name,
      google_photo_attribution: row.google_photo_attribution,
      status: 'pending',
      cloudinary_url: '',
      cloudinary_public_id: '',
      width: '',
      height: '',
      bytes: '',
      format: '',
      elapsed_ms: '',
      error: '',
    };

    try {
      const photo = await gp.getPhotoBytes(row.google_photo_name, { maxWidthPx: MAX_WIDTH });
      const uploaded = await uploadBuffer(photo.buffer, {
        publicId: `restaurant_${row.id}_google_${MAX_WIDTH}`,
        contentType: photo.contentType,
      });
      out.status = 'ok';
      out.cloudinary_url = uploaded.secureUrl;
      out.cloudinary_public_id = uploaded.publicId;
      out.width = uploaded.width;
      out.height = uploaded.height;
      out.bytes = uploaded.bytes;
      out.format = uploaded.format;
      ok += 1;
    } catch (err) {
      out.status = 'error';
      out.error = err.message;
      errors += 1;
    }

    out.elapsed_ms = Date.now() - startedAt;
    outRows.push(out);
    writeCsv(outFile, columns, outRows);

    if ((index + 1) % 50 === 0 || index + 1 === rows.length) {
      console.log(`progress: ${index + 1}/${rows.length} | ok=${ok} | errors=${errors}`);
    }
  }

  console.log('=== DONE ===');
  console.log(`google photo calls: ${gp.calls.photo}`);
  console.log(`successful uploads: ${ok}`);
  console.log(`errors: ${errors}`);
  console.log(`output: ${path.relative(path.join(__dirname, '..'), outFile)}`);
  console.log('NO DB WRITES.');
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
