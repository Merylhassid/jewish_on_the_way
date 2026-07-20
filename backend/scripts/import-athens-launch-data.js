'use strict';

/**
 * Idempotent import for the first Athens launch batch.
 *
 * Default mode is a read-only preview. Pass --apply to write. The script uses
 * stable Google Place IDs (when available) and destination/name fallbacks so a
 * second run updates the same records instead of creating duplicates.
 *
 * Usage:
 *   node scripts/import-athens-launch-data.js
 *   node scripts/import-athens-launch-data.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { v2: cloudinary } = require('cloudinary');
const { GooglePlaces } = require('./lib/google-places');

const APPLY = process.argv.includes('--apply');
const WITH_PHOTOS = process.argv.includes('--with-photos');
const VERIFIED_AT = '2026-07-20T00:00:00.000Z';
const CHABAD_RESTAURANTS_URL =
  'https://www.chabad.gr/templates/articlecco_cdo/aid/1521444/jewish/Kosher-Restaurant-in-Athens.htm';

const restaurants = [
  {
    googlePlaceId: 'ChIJtQrnpCO9oRQR6qMYftM3v30',
    name: 'GOSTIJO',
    restaurantType: 'meat',
    restaurantTypeConfidence: 1,
    kashrutLevel: 'mehadrin',
    address: 'Esopou 10, Athina 105 54, Greece',
    openingHours:
      'Sunday-Thursday 13:30-21:30 (last order 21:00); Friday-Saturday closed',
    lat: 37.9778968,
    lng: 23.7239458,
    rating: 4.2,
    phone: '+30 21 0323 3825',
    category: 'Kosher Greek and Mediterranean restaurant',
    websiteUrl: 'https://gostijo.gr/',
    websiteText:
      'Glatt kosher meat restaurant serving Jewish-Greek, Mediterranean and Sephardic cuisine.',
    enrichmentSourceSummary:
      'User-provided Google listing; Google Places; official Chabad of Greece restaurant page.',
    kosherValidationReason:
      'Official Chabad of Greece listing: meat, supervised by Rabbi Mendel Hendel; Glatt Kosher, Chalak Beit Yosef, Bishul Yisrael (Rama).',
    googleDisplayName: 'GOSTIJO',
    googleDisplayNameHe: 'מסעדת גוסטיו',
    googleFormattedAddress: 'Esopou 10, Athina 105 54, Greece',
    googleFormattedAddressHe: 'Esopou 10, Athina 105 54, יוון',
    googleRating: 4.2,
    googleRatingCount: 594,
    googlePhone: '+30 21 0323 3825',
    googleMapsUri:
      'https://maps.google.com/?cid=9061022356785898474&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googleOpeningHours:
      'Sunday-Thursday 13:30-21:30; Friday closed; Saturday closed',
    googlePhotoName:
      'places/ChIJtQrnpCO9oRQR6qMYftM3v30/photos/AWCwydiBbmbo16G3yFu9fPgXC5Iim_2N_CYQUb2QAOQRcIrVOTtvRLbZAtDoRsiwAWI89S_iJmN7qbbSeSspjCU0IDyKKeQCbwKCH17RzMhjNn8_zT5jV0FGJb3lTWAADSPhc_Vanb5_lnSzf_4-Dk1W47fD7fWdYbel33Q6Bc7K_3ZdXbHwj_6Dq3SozKe3mulF2m4HrVbJKKCgVqM0m2L35tDTMkCz9G5qNW42fobnQ6uvznKTNAhxcZfRMKzCDdzNaB7ymEIyQKoofWcznnmesApo1CAg1QhQJrWbrxi0O8JFxl4sMhJ2zxqScZTi-gFUSzslRN6OhNAFdhBV_7s4SsBQXBk6HiYUlpvFamDf0GxCI7ZvzxxmtCvmoF2EglRUMUZ__pXps5aeDhM50vhj8v6ILIqPQBPged6nFxyuu-M',
    googlePhotoAttribution: 'GOSTIJO',
    googlePrimaryType: 'restaurant',
    googleTypes: 'restaurant,food,point_of_interest,establishment',
    tags: [
      'kosher',
      'glatt-kosher',
      'chabad',
      'greek',
      'mediterranean',
      'sephardic',
      'chalak-beit-yosef',
      'bishul-yisrael',
    ],
  },
  {
    googlePlaceId: 'ChIJoy8yRFu9oRQRsuKRIQ-4IXQ',
    name: 'Parakalo Dairy Restaurant',
    restaurantType: 'dairy',
    restaurantTypeConfidence: 1,
    kashrutLevel: 'mehadrin',
    address: 'Mikonos 18, Athina 105 54, Greece',
    openingHours:
      'Sunday 09:00-22:00; Monday-Thursday 08:00-22:00; Friday 08:00-15:00; Saturday from one hour after Shabbat until 00:00',
    lat: 37.9781232,
    lng: 23.7239209,
    rating: 4.8,
    phone: '+30 21 0324 8601',
    category: 'Dairy cafe-bistro, bakery, pizza and pasta',
    websiteUrl: CHABAD_RESTAURANTS_URL,
    websiteText:
      'Glatt kosher dairy cafe-bistro serving coffee, pastries, breakfast, pasta and pizza.',
    enrichmentSourceSummary:
      'User-provided Google listing; Google Places; official Chabad of Greece restaurant page.',
    kosherValidationReason:
      'Official Chabad of Greece listing: dairy under Rabbi Mendel Hendel; Chalav Yisrael, Pat Yisrael and Bishul Yisrael (Rama).',
    googleDisplayName: 'Parakalo Dairy restaurant',
    googleDisplayNameHe: 'Parakalo Dairy restaurant',
    googleFormattedAddress: 'Mikonos 18, Athina 105 54, Greece',
    googleFormattedAddressHe: 'Mikonos 18, Athina 105 54, יוון',
    googleRating: 4.8,
    googleRatingCount: 214,
    googlePhone: '+30 21 0324 8601',
    googleMapsUri:
      'https://maps.google.com/?cid=8368171957758321330&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googleOpeningHours:
      'Sunday 09:00-22:00; Monday-Thursday 08:00-22:00; Friday 08:00-15:00; Saturday 21:30-00:00 (seasonal Shabbat time)',
    googlePhotoName:
      'places/ChIJoy8yRFu9oRQRsuKRIQ-4IXQ/photos/AWCwydj3tpURkYU7NUJhbnrQF0kwv95ozKlbRq0IXFSaYkz3RQejJNaUc9CQDJmiooYeAAVlvuYTLKX1X-TuEVDxbojO7-WUUkT_sbSsiXA5DnTTfRweEH-347vrpQ4D-9APSpMKr9ezXTMNgpAfkP1Oa0GtMu3xQtEvpC5LIMRojWhHS3UNqIiHsGZGWHtsfu6vr3erVkljEXMb7gj6QypDzUrsFzPYhAsHAWzoh4rm4lehO80UoQBEBkCbCuTdvmc2mLgusMnr_cUA5s8rzAz00aQasQk79jSP3UTQkTcgPFX0VmANta29GoH0v3ntVA_zLGNwZrsa8U7CGKQ8T_uZ_IbcjaAm-Rxc8PZR6WtXqvInfItbR93AHKxEqAIRS88hxaEIvoF1BfmAwV8Yz59P9SY9aDdYOhAid6Kq2k3ai-VFWzX9ZR4e9lnPCpzqib4P',
    googlePhotoAttribution: 'Parakalo Dairy restaurant',
    googlePrimaryType: 'restaurant',
    googleTypes: 'cafe,restaurant,food,point_of_interest,establishment',
    tags: [
      'kosher',
      'glatt-kosher',
      'chabad',
      'dairy',
      'cafe',
      'bakery',
      'pizza',
      'pasta',
      'chalav-yisrael',
      'pat-yisrael',
      'bishul-yisrael',
    ],
  },
  {
    googlePlaceId: null,
    name: 'E-Kosher Shop',
    restaurantType: null,
    restaurantTypeConfidence: null,
    // Products carry different certifications; do not claim one uniform level.
    kashrutLevel: 'unknown',
    address: 'Esopou 10, Athina 105 54, Greece',
    openingHours: 'Sunday-Thursday 10:00-20:00; Friday 10:00-14:00; Saturday closed',
    lat: 37.9778969,
    lng: 23.7239585,
    rating: null,
    phone: '+30 21 0323 3825',
    category: 'Kosher grocery store',
    websiteUrl: 'https://e-kosher.gr/he/',
    websiteText:
      'Kosher grocery and online shop in the Chabad House building, with prepared food, catering and delivery across Greece.',
    enrichmentSourceSummary:
      'User-provided official website; official Chabad of Greece grocery page. No separate Google listing was supplied, so no Google rating was inferred.',
    kosherValidationReason:
      'Official Chabad of Greece listing identifies this as the kosher grocery in the Chabad House building. Individual products may have different certification levels.',
    googleDisplayName: null,
    googleDisplayNameHe: null,
    googleFormattedAddress: null,
    googleFormattedAddressHe: null,
    googleRating: null,
    googleRatingCount: null,
    googlePhone: null,
    googleMapsUri: null,
    googleOpeningHours: null,
    googlePhotoName: null,
    googlePhotoAttribution: null,
    googlePrimaryType: null,
    googleTypes: null,
    tags: [
      'kosher',
      'grocery',
      'chabad',
      'delivery',
      'online-ordering',
      'prepared-food',
      'shabbat-meals',
    ],
  },
];

function pointSql() {
  return 'ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography';
}

async function findExistingState(db) {
  const destinations = await db.query(
    `SELECT id, name, name_he, parent_id
       FROM destinations
      WHERE country_code = 'GR' OR lower(name) IN ('greece', 'athens')
      ORDER BY parent_id NULLS FIRST, id`,
  );
  const places = await db.query(
    `SELECT id, name, google_place_id, "destinationId"
       FROM restaurants
      WHERE google_place_id = ANY($1::text[])
         OR lower(name) IN ('gostijo', 'parakalo dairy restaurant', 'e-kosher shop')
      ORDER BY id`,
    [restaurants.map((r) => r.googlePlaceId).filter(Boolean)],
  );
  const synagogues = await db.query(
    `SELECT id, name, "destinationId"
       FROM synagogues
      WHERE lower(name) LIKE '%chabad%athens%'
         OR lower("normalizedName") = 'chabad of athens'
      ORDER BY id`,
  );
  return {
    destinations: destinations.rows,
    restaurants: places.rows,
    synagogues: synagogues.rows,
  };
}

async function ensureDestination(db, data, parentId = null) {
  const existing = await db.query(
    `SELECT id FROM destinations
      WHERE country_code = $1
        AND parent_id IS NOT DISTINCT FROM $2
        AND lower(name) = lower($3)
      ORDER BY id
      LIMIT 1`,
    [data.countryCode, parentId, data.name],
  );

  if (existing.rowCount) {
    const id = existing.rows[0].id;
    await db.query(
      `UPDATE destinations
          SET name_he = $3,
              country = $4,
              city = $5,
              location = ${pointSql()}
        WHERE id = $6`,
      [data.lng, data.lat, data.nameHe, data.country, data.city, id],
    );
    return { id, action: 'updated' };
  }

  const inserted = await db.query(
    `INSERT INTO destinations
       (name, name_he, description, country, country_code, city, location, parent_id)
     VALUES ($3, $4, NULL, $5, $6, $7, ${pointSql()}, $8)
     RETURNING id`,
    [data.lng, data.lat, data.name, data.nameHe, data.country, data.countryCode, data.city, parentId],
  );
  return { id: inserted.rows[0].id, action: 'inserted' };
}

async function upsertRestaurant(db, destinationId, r) {
  const existing = r.googlePlaceId
    ? await db.query('SELECT id FROM restaurants WHERE google_place_id = $1 LIMIT 1', [r.googlePlaceId])
    : await db.query(
        `SELECT id FROM restaurants
          WHERE "destinationId" = $1 AND lower(name) = lower($2)
          LIMIT 1`,
        [destinationId, r.name],
      );

  const values = [
    r.googlePlaceId,
    r.name,
    r.restaurantType,
    r.restaurantTypeConfidence,
    r.kashrutLevel,
    r.address,
    r.openingHours,
    r.lng,
    r.lat,
    r.rating,
    r.websiteUrl,
    r.websiteText,
    r.openingHours,
    r.enrichmentSourceSummary,
    r.kosherValidationReason,
    destinationId,
    r.phone,
    r.category,
    r.lat,
    r.lng,
    r.tags,
    r.googleDisplayName,
    r.googleFormattedAddress,
    r.lat,
    r.lng,
    r.googleMapsUri,
    r.googleRatingCount,
    r.googleRating,
    r.googlePhone,
    r.googleOpeningHours,
    r.googlePhotoName,
    r.googlePhotoAttribution,
    r.googlePrimaryType,
    r.googleTypes,
    r.googleDisplayNameHe,
    r.googleFormattedAddressHe,
    r.googleDisplayName,
    r.googleFormattedAddress,
  ];

  const setSql = `
      google_place_id = $1::varchar,
      name = $2,
      restaurant_type = $3,
      restaurant_type_confidence = $4,
      kashrut_level = $5,
      address = $6,
      opening_hours = $7,
      location = ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography,
      rating = $10,
      is_kosher = true,
      website_url = $11,
      website_text = $12,
      website_opening_hours = $13,
      website_last_fetched_at = '${VERIFIED_AT}'::timestamptz,
      website_fetch_status = 'ok',
      enrichment_source_summary = $14,
      kosher_validation_status = 'verified',
      kosher_validation_confidence = 0.999,
      kosher_validation_reason = $15,
      kosher_validated_at = '${VERIFIED_AT}'::timestamptz,
      "destinationId" = $16,
      phone = $17,
      category = $18,
      city = 'Athens',
      country = 'Greece',
      lat = $19,
      lng = $20,
      geocoded_at = '${VERIFIED_AT}'::timestamptz,
      tags = $21,
      google_display_name = $22,
      google_formatted_address = $23,
      google_lat = CASE WHEN $1::varchar IS NULL THEN NULL ELSE $24::double precision END,
      google_lng = CASE WHEN $1::varchar IS NULL THEN NULL ELSE $25::double precision END,
      google_business_status = CASE WHEN $1::varchar IS NULL THEN NULL ELSE 'OPERATIONAL' END,
      google_maps_uri = $26,
      google_rating_count = $27,
      google_synced_at = CASE WHEN $1::varchar IS NULL THEN NULL ELSE '${VERIFIED_AT}'::timestamptz END,
      google_rating = $28,
      google_phone = $29,
      google_opening_hours = $30,
      google_photo_name = $31,
      google_photo_attribution = $32,
      google_primary_type = $33,
      google_types = $34,
      verification_status = 'verified',
      verification_confidence = 0.999,
      verification_reason = $14,
      google_display_name_he = $35,
      google_formatted_address_he = $36,
      google_display_name_en = $37,
      google_formatted_address_en = $38`;

  if (existing.rowCount) {
    const id = existing.rows[0].id;
    await db.query(`UPDATE restaurants SET ${setSql} WHERE id = $39`, [...values, id]);
    return { id, action: 'updated' };
  }

  const inserted = await db.query(
    `INSERT INTO restaurants (name, kashrut_level)
     VALUES ($1, $2)
     RETURNING id`,
    [r.name, r.kashrutLevel],
  );
  const id = inserted.rows[0].id;
  await db.query(`UPDATE restaurants SET ${setSql} WHERE id = $39`, [...values, id]);
  return { id, action: 'inserted' };
}

async function upsertChabad(db, destinationId) {
  const existing = await db.query(
    `SELECT id FROM synagogues
      WHERE "destinationId" = $1
        AND (lower("normalizedName") = 'chabad of athens' OR lower(name) LIKE '%chabad%athens%')
      ORDER BY id
      LIMIT 1`,
    [destinationId],
  );
  const params = [
    'Chabad of Athens — בית חב״ד אתונה',
    'chabad of athens',
    'Esopou 10, Athina 105 54, Greece',
    'Chabad House, synagogue and Jewish center directed by Rabbi Mendel and Nechama Hendel. Offers prayers, Shabbat meals and assistance to Jewish travelers.',
    23.7239585,
    37.9778969,
    'http://www.chabad.gr/',
    '+30 21 0323 3825',
    'Esopou',
    '10',
    '105 54',
    'Athens',
    'Chabad-Lubavitch',
    'Chabad of Greece',
    destinationId,
    'Google Places + official chabad.gr',
    `Google Place ID ChIJCyDW00C8oRQRNvBS473rODg; Google Maps https://maps.google.com/?cid=4051247065614970934; Google rating 4.6 from 642 ratings on 2026-07-20; email info@chabad.gr. Prayer times vary and were intentionally not stored as fixed opening hours.`,
  ];
  const setSql = `
      name = $1,
      "normalizedName" = $2,
      address = $3,
      description = $4,
      location = ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography,
      website = $7,
      phone = $8,
      "openingHours" = NULL,
      "addrStreet" = $9,
      "addrHousenumber" = $10,
      "addrPostcode" = $11,
      "addrCity" = $12,
      denomination = $13,
      operator = $14,
      source = 'manual',
      "sourceConfidence" = 0.99,
      "rawOsm" = NULL,
      "manuallyVerified" = true,
      "needsLocationVerification" = false,
      "destinationId" = $15,
      "verificationSource" = $16,
      "verificationNotes" = $17,
      updated_at = now()`;

  if (existing.rowCount) {
    const id = existing.rows[0].id;
    await db.query(`UPDATE synagogues SET ${setSql} WHERE id = $18`, [...params, id]);
    return { id, action: 'updated' };
  }

  const inserted = await db.query(
    `INSERT INTO synagogues (name, source, "destinationId") VALUES ($1, 'manual', $2) RETURNING id`,
    [params[0], destinationId],
  );
  const id = inserted.rows[0].id;
  await db.query(`UPDATE synagogues SET ${setSql} WHERE id = $18`, [...params, id]);
  return { id, action: 'inserted' };
}

function uploadPhoto(buffer, restaurantId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'restaurants/google',
        public_id: `restaurant_${restaurantId}_google_800`,
        resource_type: 'image',
        overwrite: true,
        context: { source: 'google_places' },
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
}

async function syncPhotos(db, restaurantResults) {
  if (!WITH_PHOTOS) return [];
  for (const key of ['GOOGLE_PLACES_API_KEY', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
    if (!process.env[key]) throw new Error(`Missing ${key} for --with-photos`);
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const google = new GooglePlaces(process.env.GOOGLE_PLACES_API_KEY, { rateMs: 180 });
  const results = [];
  for (const result of restaurantResults) {
    const source = restaurants.find((r) => r.name === result.name);
    if (!source?.googlePhotoName) continue;
    try {
      const photo = await google.getPhotoBytes(source.googlePhotoName, { maxWidthPx: 800 });
      const uploaded = await uploadPhoto(photo.buffer, result.id);
      await db.query(
        `UPDATE restaurants
            SET photo_url = $1,
                photo_attribution = $2,
                photo_source = 'google_places',
                photo_fetched_at = now()
          WHERE id = $3`,
        [uploaded.secure_url, source.googlePhotoAttribution, result.id],
      );
      results.push({ id: result.id, name: result.name, status: 'ok', photoUrl: uploaded.secure_url });
    } catch (error) {
      results.push({ id: result.id, name: result.name, status: 'error', error: error.message });
    }
  }
  return results;
}

(async () => {
  const db = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await db.connect();

  const before = await findExistingState(db);
  console.log('=== ATHENS LAUNCH IMPORT ===');
  console.log(`mode: ${APPLY ? 'APPLY' : 'DRY RUN (read-only)'}`);
  console.log(`photos: ${WITH_PHOTOS ? 'Google Places -> Cloudinary' : 'metadata only'}`);
  console.log('existing:', JSON.stringify(before, null, 2));
  console.log('planned: Greece -> Athens; 3 restaurant-list entries; 1 synagogue');

  if (!APPLY) {
    await db.end();
    console.log('No writes. Re-run with --apply after reviewing the plan.');
    return;
  }

  await db.query('BEGIN');
  try {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('import-athens-launch-data'))");
    const greece = await ensureDestination(db, {
      name: 'Greece',
      nameHe: 'יוון',
      country: 'Greece',
      countryCode: 'GR',
      city: 'Greece',
      lat: 37.9838,
      lng: 23.7275,
    });
    const athens = await ensureDestination(
      db,
      {
        name: 'Athens',
        nameHe: 'אתונה',
        country: 'Greece',
        countryCode: 'GR',
        city: 'Athens',
        lat: 37.9838,
        lng: 23.7275,
      },
      greece.id,
    );

    const restaurantResults = [];
    for (const restaurant of restaurants) {
      restaurantResults.push({
        name: restaurant.name,
        ...(await upsertRestaurant(db, athens.id, restaurant)),
      });
    }
    const synagogue = await upsertChabad(db, athens.id);
    await db.query('COMMIT');
    const photoResults = await syncPhotos(db, restaurantResults);

    const after = await findExistingState(db);
    console.log('destination actions:', { greece, athens });
    console.log('restaurant actions:', restaurantResults);
    console.log('synagogue action:', synagogue);
    console.log('photo actions:', photoResults);
    console.log('verified state:', JSON.stringify(after, null, 2));
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
})().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
