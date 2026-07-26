'use strict';

/**
 * Fill missing Google/Cloudinary photos for the recent launch destinations
 * handled in July 2026: Athens, Bucharest, Tbilisi, Budapest.
 *
 * Safety:
 * - DRY-RUN by default.
 * - Applies only to explicit restaurant IDs.
 * - Skips hotel listings so hotel photos are not attached to embedded kosher restaurants.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Client } = require('pg');
const { v2: cloudinary } = require('cloudinary');
const { GooglePlaces } = require('./lib/google-places');

const APPLY = process.argv.includes('--apply');

const TARGETS = [
  {
    id: 8472,
    label: 'E-Kosher Shop',
    searchQuery: 'Chabad of Athens Esopou 10 Athens',
    reason: 'Umbrella Chabad listing; no direct Google listing for the online kosher shop.',
    allowUmbrellaPhoto: true,
  },
  {
    id: 8478,
    label: 'Bereshit Kosher Shop',
    searchQuery: 'Bereshit Kosher Chabad Bucharest Tache Ionescu 9',
    reason: 'Umbrella Bereshit/Chabad restaurant listing; online kosher shop has no direct Google listing.',
    allowUmbrellaPhoto: true,
  },
  {
    id: 8482,
    label: 'Kosher Restaurants at Cron Palace',
    skip: true,
    reason: 'Google listing is Cron Palace hotel; do not attach hotel photos to embedded kosher restaurants.',
  },
  {
    id: 8483,
    label: 'Chabad Dairy Restaurant Tbilisi',
    reason: 'Chabad House listing operates the dairy restaurant.',
    allowUmbrellaPhoto: true,
  },
  {
    id: 8484,
    label: 'Bereshit Dairy Restaurant at Genesis Hotel',
    skip: true,
    reason: 'Google listing is Genesis hotel; do not attach hotel photos to the restaurant.',
  },
];

function client() {
  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
}

function requireEnv(keys) {
  for (const key of keys) {
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  }
}

function uploadPhoto(buffer, id) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'restaurants/google',
        public_id: `restaurant_${id}_google_800`,
        overwrite: true,
        resource_type: 'image',
        context: { source: 'google_places' },
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
}

async function resolveDetails(google, row, target) {
  let placeId = row.google_place_id;
  let resolvedBy = 'stored-google-place-id';
  if (!placeId && target.searchQuery) {
    placeId = await google.findPlaceId(target.searchQuery);
    resolvedBy = 'text-search';
  }
  if (!placeId) return { placeId: null, resolvedBy, details: null };
  const details = await google.getDetails(placeId, {
    mask: 'id,displayName,formattedAddress,types,primaryType,photos,googleMapsUri',
  });
  return { placeId, resolvedBy, details };
}

(async () => {
  requireEnv([
    'GOOGLE_PLACES_API_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ]);

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const db = client();
  const google = new GooglePlaces(process.env.GOOGLE_PLACES_API_KEY, { rateMs: 180 });
  await db.connect();

  console.log(`=== FILL RECENT LAUNCH PHOTOS — ${APPLY ? 'APPLY' : 'DRY-RUN'} ===`);

  const results = [];
  for (const target of TARGETS) {
    const row = (
      await db.query(
        `SELECT id,name,google_place_id,photo_url FROM restaurants WHERE id=$1`,
        [target.id],
      )
    ).rows[0];

    if (!row) {
      results.push({ id: target.id, label: target.label, status: 'missing-row' });
      continue;
    }
    if (row.photo_url) {
      results.push({ id: row.id, name: row.name, status: 'already-has-photo', photoUrl: row.photo_url });
      continue;
    }
    if (target.skip) {
      results.push({ id: row.id, name: row.name, status: 'skipped', reason: target.reason });
      continue;
    }

    const { placeId, resolvedBy, details } = await resolveDetails(google, row, target);
    const primaryType = details?.primaryType || null;
    const types = details?.types || [];

    if (!details?.photos?.[0]?.name) {
      results.push({ id: row.id, name: row.name, status: 'no-google-photo', placeId, resolvedBy });
      continue;
    }
    if (primaryType === 'hotel' || types.includes('lodging')) {
      results.push({
        id: row.id,
        name: row.name,
        status: 'skipped-hotel-photo',
        placeId,
        resolvedBy,
        primaryType,
        reason: 'Google photo belongs to a hotel listing.',
      });
      continue;
    }

    const photo = details.photos[0];
    const attribution = photo.authorAttributions?.[0]?.displayName || details.displayName?.text || row.name;

    if (!APPLY) {
      results.push({
        id: row.id,
        name: row.name,
        status: 'would-upload',
        placeId,
        resolvedBy,
        displayName: details.displayName?.text || null,
        primaryType,
        photoName: photo.name,
        reason: target.reason,
      });
      continue;
    }

    const bytes = await google.getPhotoBytes(photo.name, { maxWidthPx: 800 });
    const uploaded = await uploadPhoto(bytes.buffer, row.id);
    await db.query(
      `UPDATE restaurants
          SET photo_url=$1,
              photo_attribution=$2,
              photo_source='google_places',
              photo_fetched_at=now(),
              google_photo_name=$3,
              google_photo_attribution=$2
        WHERE id=$4`,
      [uploaded.secure_url, attribution, photo.name, row.id],
    );
    results.push({
      id: row.id,
      name: row.name,
      status: 'ok',
      placeId,
      resolvedBy,
      displayName: details.displayName?.text || null,
      photoUrl: uploaded.secure_url,
      reason: target.reason,
    });
  }

  console.log(JSON.stringify(results, null, 2));
  await db.end();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
