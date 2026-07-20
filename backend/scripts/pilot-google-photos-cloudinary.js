'use strict';

/*
 * Pilot Google Place Photos -> Cloudinary.
 *
 * This script writes to Cloudinary only and writes a CSV preview. It does NOT
 * update the DB. Use it to inspect image quality and billing before bulk apply.
 *
 * Usage:
 *   node scripts/pilot-google-photos-cloudinary.js [--limit 20] [--max-width 800]
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

const LIMIT = Number(arg('--limit') || 20);
const MAX_WIDTH = Number(arg('--max-width') || 800);

function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function uploadBuffer(buffer, { publicId, contentType }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'restaurants/google-pilot',
        public_id: publicId,
        resource_type: 'image',
        overwrite: true,
        context: {
          source: 'google_places_photo_pilot',
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
  if (!Number.isFinite(LIMIT) || LIMIT < 1) {
    throw new Error('--limit must be a positive number');
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
  const { rows } = await db.query(
    `select id, name, address, google_display_name, google_photo_name, google_photo_attribution
       from restaurants
      where verification_status = 'verified'
        and google_photo_name is not null
      order by id
      limit $1`,
    [LIMIT],
  );
  await db.end();

  const gp = new GooglePlaces(process.env.GOOGLE_PLACES_API_KEY, { rateMs: 180 });
  const outRows = [];

  for (const row of rows) {
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
    } catch (err) {
      out.status = 'error';
      out.error = err.message;
    }
    out.elapsed_ms = Date.now() - startedAt;
    outRows.push(out);
  }

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
    `google-photos-cloudinary-pilot-${LIMIT}.csv`,
  );
  fs.writeFileSync(
    outFile,
    '\ufeff' + [columns.join(','), ...outRows.map((row) => columns.map((col) => csvEsc(row[col])).join(','))].join('\n') + '\n',
    'utf8',
  );

  console.log('=== GOOGLE PHOTOS -> CLOUDINARY PILOT ===');
  console.log(`selected restaurants: ${rows.length}`);
  console.log(`google photo calls: ${gp.calls.photo}`);
  console.log(`successful uploads: ${outRows.filter((row) => row.status === 'ok').length}`);
  console.log(`errors: ${outRows.filter((row) => row.status !== 'ok').length}`);
  console.log(`output: ${path.relative(path.join(__dirname, '..'), outFile)}`);
  console.log('NO DB WRITES.');
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
