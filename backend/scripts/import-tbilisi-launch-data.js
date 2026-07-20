'use strict';

/**
 * Idempotent import for the Tbilisi launch batch.
 * Default is a read-only preview; use --apply and optionally --with-photos.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { v2: cloudinary } = require('cloudinary');
const { GooglePlaces } = require('./lib/google-places');

const APPLY = process.argv.includes('--apply');
const WITH_PHOTOS = process.argv.includes('--with-photos');
const VERIFIED_AT = '2026-07-20T00:00:00.000Z';

const restaurants = [
  {
    googlePlaceId: 'ChIJDxgwHwANREARHkBEi17q2HM',
    name: "Mendis — מסעדת מענדי'ס",
    restaurantType: 'meat',
    restaurantTypeConfidence: 0.95,
    kashrutLevel: 'mehadrin',
    address: "7 Bambis Rigi St, T'bilisi 0105, Georgia",
    openingHours: 'Meat restaurant: Sunday-Thursday 14:00-21:45, Friday 12:00-16:00, Saturday closed. Separate dairy breakfast service: Sunday-Friday 09:00-14:00. Shabbat meals by advance registration.',
    lat: 41.6909083,
    lng: 44.8082905,
    rating: 4.4,
    phone: '+995 550 00 18 36',
    category: 'Mehadrin kosher Georgian and Israeli restaurant with separate dairy breakfast service',
    websiteUrl: 'https://shabat.ge/',
    websiteText: 'Mehadrin kosher restaurant in Tbilisi serving Georgian and Israeli cuisine. A separate dairy breakfast service operates in the morning, and Chabad Shabbat meals are offered by advance registration.',
    sourceSummary: 'User-provided Google listing and information; Google Places; official Mendis website.',
    kosherReason: 'User-provided source identifies Mehadrin supervision by Rabbi Meir Kozlovsky, Chabad emissary and Chief Rabbi of Georgia.',
    googleDisplayName: 'Mendis',
    googleFormattedAddress: "7 Bambis Rigi St, T'bilisi 0105, Georgia",
    googleMapsUri: 'https://maps.google.com/?cid=8347679601115545630&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googleRatingCount: 946,
    googleRating: 4.4,
    googlePhone: '+995 550 00 18 36',
    googleOpeningHours: 'Sunday-Thursday 14:00-21:45; Friday 12:00-16:00; Saturday closed',
    googlePhotoName: 'places/ChIJDxgwHwANREARHkBEi17q2HM/photos/AWCwydhq8qdkb7W3ROShWq2-tvbPvlrE41cSsLmYEJBU6st3Zzv25q9uhZBGqvx_M1ukq5Z7-28my-VwdNof8HmP4jjIGXMACXJvcayD4wTtVstMrOCmcCK0kvYKWYlpPDr0vjdSI5mPAnmutV8bwd_r-VWiFoZfqvfb861C3Cz9be4bPh3NqNgfTkbj6czVHaEpgyje0VVstmFu3xhVBgleVS7iz2oipyJsRObbfIep8TRU57Lo77nmcnwy1GZI4DAup7iQAMXGOGOwSCmqcz-frCG2xtNiQLKR7gZuHUO_25CYrk_2QJEwh4EbQeHQY6bfP-6zGWBOxqtcFD_EddolbK4tnxRZfZaHi6jegaA5F2_SrwHKlo_kWcPHY_xcqLMXEF7WTXS60uwf5rPjZ7LeJK-lGqx1j2tFFwDnd35oKAjI3w',
    googlePhotoAttribution: 'Mendis',
    googlePrimaryType: 'restaurant',
    googleTypes: 'restaurant,food,point_of_interest,establishment',
    tags: ['kosher', 'mehadrin', 'meat', 'dairy-breakfast', 'georgian', 'israeli', 'chabad', 'shabbat-meals'],
  },
  {
    googlePlaceId: 'ChIJ16tARz0LREARvDvlMVBAHSU',
    name: 'La Casa Kosher Restaurant — לה קאסה',
    restaurantType: 'meat',
    restaurantTypeConfidence: 0.98,
    kashrutLevel: 'mehadrin',
    address: "12 Ivane Machabeli St, T'bilisi, Georgia",
    openingHours: 'Sunday-Thursday 14:30-23:00; Friday-Saturday closed',
    lat: 41.6907823,
    lng: 44.7999798,
    rating: 4.9,
    phone: '+972 54-586-0272',
    category: 'Mehadrin kosher meat restaurant',
    websiteUrl: null,
    websiteText: 'Mehadrin kosher meat restaurant in Tbilisi Old Town, serving dishes inspired by Israeli and Georgian cuisine.',
    sourceSummary: 'User-provided Google listing and information; Google Places.',
    kosherReason: 'User-provided source identifies Mehadrin supervision by Rabbi Avimelech Rosenblatt and Rabbi Chaim Attias.',
    googleDisplayName: 'La Casa כשר / לה קאסה Restaurant',
    googleFormattedAddress: "12 Ivane Machabeli St, T'bilisi, Georgia",
    googleMapsUri: 'https://maps.google.com/?cid=2674364466906610620&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googleRatingCount: 780,
    googleRating: 4.9,
    googlePhone: '+972 54-586-0272',
    googleOpeningHours: 'Sunday-Thursday 14:30-23:00; Friday-Saturday closed',
    googlePhotoName: 'places/ChIJ16tARz0LREARvDvlMVBAHSU/photos/AWCwydj3XbNwKN729AQF03aGTN36tvrBtHEpy-JftpppyU0ih0OrhW5HnzGcnF36N08azVjBeQ7PBIzZkXxJnKVvGbWbbJxM6sss-4ATADgmtCNSo9PLIeZmSmT7NR1p2zEhl8jL3CVaZivtJOZ0E5JgmORwG7s8Nlevb4o7LbYrAewqsmNlXTa0cwT72J7sHUS_7j_ARnX12oNjk1_-5pPl7Yk2TuI9CqI4nEYuDVbfqj9HLqGzx9uZcL2unxm-6p7JPtOjua7_vEPRousqQr0xIFY19iqg6PxKb8Fmjfh76ZbptDKm-3tBWhH_iI0t80IgU2HXRe1uzE7bAzzYGlmWKuKhQx-oANwOkBcaAaBgjDIc_IxAigiGayWWOgSE7NZdPUr3IQiCbFFPpX4Eql-im_NhVuACaArnubdRNis1bUx2V60',
    googlePhotoAttribution: 'גיא פרישברג',
    googlePrimaryType: 'restaurant',
    googleTypes: 'restaurant,food,point_of_interest,establishment',
    tags: ['kosher', 'mehadrin', 'meat', 'old-town', 'israeli', 'georgian'],
  },
  {
    googlePlaceId: 'ChIJee9bQiQNREARMCj2b8yYMa8',
    name: 'King David Kosher Restaurant — קינג דוד',
    restaurantType: 'meat',
    restaurantTypeConfidence: 1,
    kashrutLevel: 'mehadrin',
    address: "49 Kote Afkhazi St, T'bilisi 0105, Georgia",
    openingHours: 'Sunday-Thursday 09:30-23:00; Friday 09:30-17:00; Saturday closed',
    lat: 41.6902423,
    lng: 44.8076922,
    rating: 4.4,
    phone: '+995 593 68 08 82',
    category: 'Mehadrin kosher Georgian meat restaurant',
    websiteUrl: null,
    websiteText: 'Mehadrin kosher restaurant behind the Great Synagogue, serving authentic Georgian meat dishes. Chabad morning prayer attendees may be served breakfast by prior arrangement.',
    sourceSummary: 'User-provided Google listing and information; Google Places; current business directory address.',
    kosherReason: 'User-provided source identifies Mehadrin supervision by the Georgian Jewish community.',
    googleDisplayName: 'Kosher restaurant King David / מסעדה כשרה קינג דוד',
    googleFormattedAddress: 'Kote Aphkhazi Str, 49, Tbilisi 0105, Georgia',
    googleMapsUri: 'https://maps.google.com/?cid=12624039234315364400&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googleRatingCount: 695,
    googleRating: 4.4,
    googlePhone: '+995 593 68 08 82',
    googleOpeningHours: 'Sunday-Thursday 09:30-23:00; Friday 09:30-17:00; Saturday closed',
    googlePhotoName: 'places/ChIJee9bQiQNREARMCj2b8yYMa8/photos/AWCwydjGDJXxxwfencoX8uZjLMjRM-C1V6ox9jDZIHrPsE4bv8NpTKaWMgY6Z0jO5kjpN6-smoHGuzg-CshKJoCYDwvphGV_ywqw9mSO1JbyFZU45phY5bnSU_pWHtc_dgHZlT-H7Xdgu3TGHo2I3_DZndDYjytUL8RApuQNlwd5o7iZsz9T3vPIwkddNbcaVVnMuL_BJw_cGv_cfgc3uavKMH6Ql43LvpT0X5NLy0frniqP5uNEYRNYiH1NujNU2T8ppdIy7tfb5ttt4zo2ACtI_W3fXlJsd7149ZIZ3-uAimEsFYezpnz3gz6HYWoNVSq2OWbLAPCvFObgfmpB9bet_0DFKgSpY8gDPkXGAzioLkD7sTJ0bbKYSkBbtoMMz1DEZ624ZXZ68ZlaJSYcVo94Vigl4aaI7lZgPPtRO_kHkcmO0sYj',
    googlePhotoAttribution: 'Kosher restaurant King David / מסעדה כשרה קינג דוד',
    googlePrimaryType: 'restaurant',
    googleTypes: 'restaurant,food,point_of_interest,establishment',
    tags: ['kosher', 'mehadrin', 'meat', 'georgian', 'great-synagogue'],
  },
  {
    googlePlaceId: 'ChIJDyoDvkYMREAR-rSxcwSaiWI',
    name: 'Kosher Restaurants at Cron Palace — המסעדות הכשרות בקרון פאלאס',
    restaurantType: null,
    restaurantTypeConfidence: null,
    kashrutLevel: 'mehadrin',
    address: "13 Kheivani I Street II Dead End, T'bilisi, Georgia",
    openingHours: 'Dairy restaurant: Sunday-Thursday 08:00-15:00, Friday 08:00-14:00. Meat restaurant: Sunday-Thursday 14:00-22:00. Shabbat meals available by advance reservation; delivery available.',
    lat: 41.6777877,
    lng: 44.8295698,
    rating: null,
    phone: '+995 599 08 30 21',
    category: 'Two Mehadrin kosher restaurants inside Cron Palace: separate dairy and meat restaurants',
    websiteUrl: null,
    websiteText: 'Two separate kosher dining services operate inside Cron Palace: a dairy restaurant and a meat restaurant. This listing describes the restaurants only and does not infer hotel-wide kashrut. Hotel Google ratings are intentionally excluded.',
    sourceSummary: 'User-provided information; Google hotel listing used only for location and Maps; current hospitality listings confirming two on-site kosher restaurants.',
    kosherReason: 'User-provided source identifies Mehadrin supervision by Rabbi Chaim Attias and Rabbi Avimelech Rosenblatt.',
    googleDisplayName: 'Cron Palace, Tbilisi',
    googleFormattedAddress: "13 Kheivani I Street II Dead End, T'bilisi, Georgia",
    googleMapsUri: 'https://maps.google.com/?cid=7100375631437870330&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googleRatingCount: null,
    googleRating: null,
    googlePhone: '+995 32 224 23 21',
    googleOpeningHours: null,
    googlePhotoName: null,
    googlePhotoAttribution: null,
    googlePrimaryType: 'hotel',
    googleTypes: 'hotel,lodging,point_of_interest,establishment',
    tags: ['kosher', 'mehadrin', 'meat', 'dairy', 'inside-hotel', 'delivery', 'shabbat-meals'],
  },
  {
    googlePlaceId: 'ChIJ6WX-4e8MREARU5Mq70y5t9g',
    name: 'Chabad Dairy Restaurant — המסעדה החלבית בבית חב״ד',
    restaurantType: 'dairy',
    restaurantTypeConfidence: 1,
    kashrutLevel: 'mehadrin',
    address: "7 Bambis Rigi St, T'bilisi 0105, Georgia",
    openingHours: 'Sunday-Friday 10:00-15:00; Saturday closed',
    lat: 41.6910408,
    lng: 44.808382,
    rating: 4.7,
    phone: '+995 551 00 96 55',
    category: 'Mehadrin kosher dairy restaurant inside Chabad House',
    websiteUrl: 'https://chabadtbilisi.ge/food/758/',
    websiteText: 'Dairy kitchen inside Chabad House serving khachapuri, pizza, omelets and salads, with free internet and a tea and coffee corner.',
    sourceSummary: 'Official Chabad Tbilisi restaurant page and Google Chabad House listing. The dairy restaurant belongs to and operates inside Chabad House, so the Chabad rating is shown as the umbrella venue rating.',
    kosherReason: 'Official Chabad page: Mehadrin products and baked goods supervised by Rabbi Meir Kozlovsky; Chalav Yisrael.',
    googleDisplayName: 'Chabad House',
    googleFormattedAddress: "7 Bambis Rigi St, T'bilisi 0105, Georgia",
    googleMapsUri: 'https://maps.google.com/?cid=15616153973011682131&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googleRatingCount: 503,
    googleRating: 4.7,
    googlePhone: '+995 551 00 96 55',
    googleOpeningHours: null,
    googlePhotoName: null,
    googlePhotoAttribution: null,
    googlePrimaryType: 'association_or_organization',
    googleTypes: 'association_or_organization,point_of_interest,establishment',
    tags: ['kosher', 'mehadrin', 'dairy', 'chalav-yisrael', 'chabad', 'pizza', 'khachapuri'],
  },
  {
    googlePlaceId: 'ChIJtRAaF7cNREARA67Q_LwI6fk',
    name: 'Bereshit Dairy Restaurant at Genesis Hotel — מסעדת בראשית',
    restaurantType: 'dairy',
    restaurantTypeConfidence: 1,
    kashrutLevel: 'badatz',
    address: '2 Guluas St, Tbilisi, Region 0108, Georgia',
    openingHours: 'Sunday-Friday 12:00-16:00; Saturday closed',
    lat: 41.6786308,
    lng: 44.8288327,
    rating: null,
    phone: '+972 2-624-1292',
    category: 'Badatz kosher dairy restaurant inside Genesis Boutique Hotel',
    websiteUrl: 'https://kosher-hotel.co.il/6507/',
    websiteText: 'Bereshit is a dairy restaurant inside Genesis Boutique Hotel, serving dairy chef dishes, pizza, desserts and breakfast-style meals. Hotel Google ratings are intentionally excluded from the restaurant.',
    sourceSummary: 'Official Genesis Hotel restaurant information; user-provided page and image; Google hotel listing used only for location and Maps.',
    kosherReason: 'User-provided source identifies Badatz Kehilot certification; official hotel material describes Mehadrin kosher supervision.',
    googleDisplayName: "מלון ג'נסיס טביליסי כשר למהדרין",
    googleFormattedAddress: 'Guluas 2 Tbilisi, Region 0108, Georgia',
    googleMapsUri: 'https://maps.google.com/?cid=18007934192806047235',
    googleRatingCount: null,
    googleRating: null,
    googlePhone: '+972 2-624-1292',
    googleOpeningHours: null,
    googlePhotoName: null,
    googlePhotoAttribution: null,
    googlePrimaryType: 'hotel',
    googleTypes: 'hotel,lodging,point_of_interest,establishment',
    tags: ['kosher', 'badatz', 'mehadrin', 'dairy', 'inside-hotel', 'pizza', 'desserts'],
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

async function state(db) {
  const destinations = await db.query(
    `SELECT id,name,name_he,parent_id FROM destinations
      WHERE country_code='GE' OR lower(name) IN ('georgia','tbilisi')
      ORDER BY parent_id NULLS FIRST,id`,
  );
  const places = await db.query(
    `SELECT id,name,restaurant_type,kashrut_level,address,phone,opening_hours,
            website_url,rating,google_rating,google_rating_count,google_maps_uri,
            lat,lng,photo_url,verification_status,"destinationId"
       FROM restaurants WHERE google_place_id=ANY($1::text[]) ORDER BY id`,
    [restaurants.map((x) => x.googlePlaceId)],
  );
  return { destinations: destinations.rows, restaurants: places.rows };
}

async function ensureDestination(db, data, parentId) {
  const found = await db.query(
    `SELECT id FROM destinations WHERE country_code=$1
      AND parent_id IS NOT DISTINCT FROM $2 AND lower(name)=lower($3)
      ORDER BY id LIMIT 1`,
    [data.code, parentId ?? null, data.name],
  );
  if (found.rowCount) {
    const id = found.rows[0].id;
    await db.query(
      `UPDATE destinations SET name_he=$1,country=$2,city=$3,
       location=ST_SetSRID(ST_MakePoint($4,$5),4326)::geography WHERE id=$6`,
      [data.nameHe, data.country, data.city, data.lng, data.lat, id],
    );
    return { id, action: 'updated' };
  }
  const inserted = await db.query(
    `INSERT INTO destinations(name,name_he,country,country_code,city,location,parent_id)
     VALUES($1,$2,$3,$4,$5,ST_SetSRID(ST_MakePoint($6,$7),4326)::geography,$8) RETURNING id`,
    [data.name, data.nameHe, data.country, data.code, data.city, data.lng, data.lat, parentId ?? null],
  );
  return { id: inserted.rows[0].id, action: 'inserted' };
}

async function upsertRestaurant(db, destinationId, r) {
  const found = await db.query(
    'SELECT id FROM restaurants WHERE google_place_id=$1 LIMIT 1',
    [r.googlePlaceId],
  );
  let id;
  let action;
  if (found.rowCount) {
    id = found.rows[0].id;
    action = 'updated';
  } else {
    const inserted = await db.query(
      'INSERT INTO restaurants(name,kashrut_level) VALUES($1,$2) RETURNING id',
      [r.name, r.kashrutLevel],
    );
    id = inserted.rows[0].id;
    action = 'inserted';
  }
  const values = [
    r.googlePlaceId, r.name, r.restaurantType, r.restaurantTypeConfidence,
    r.kashrutLevel, r.address, r.openingHours, r.lng, r.lat, r.rating,
    r.websiteUrl, r.websiteText, r.sourceSummary, r.kosherReason, destinationId,
    r.phone, r.category, r.lat, r.lng, r.tags, r.googleDisplayName,
    r.googleFormattedAddress, r.googleMapsUri, r.googleRatingCount, r.googleRating,
    r.googlePhone, r.googleOpeningHours, r.googlePhotoName, r.googlePhotoAttribution,
    r.googlePrimaryType, r.googleTypes, r.googleDisplayName,
    r.googleFormattedAddress, r.googleDisplayName, r.googleFormattedAddress, id,
  ];
  await db.query(
    `UPDATE restaurants SET
      google_place_id=$1::varchar,name=$2,restaurant_type=$3,restaurant_type_confidence=$4,
      kashrut_level=$5,address=$6,opening_hours=$7,
      location=ST_SetSRID(ST_MakePoint($8,$9),4326)::geography,rating=$10,is_kosher=true,
      website_url=$11::varchar,website_text=$12,website_opening_hours=$7,
      website_last_fetched_at=CASE WHEN $11::varchar IS NULL THEN NULL ELSE '${VERIFIED_AT}'::timestamptz END,
      website_fetch_status=CASE WHEN $11::varchar IS NULL THEN NULL ELSE 'ok' END,
      enrichment_source_summary=$13,kosher_validation_status='verified',
      kosher_validation_confidence=0.999,kosher_validation_reason=$14,
      kosher_validated_at='${VERIFIED_AT}'::timestamptz,"destinationId"=$15,
      phone=$16,category=$17,city='Tbilisi',country='Georgia',lat=$18,lng=$19,
      geocoded_at='${VERIFIED_AT}'::timestamptz,tags=$20,
      google_display_name=$21,google_formatted_address=$22,
      google_lat=$18,google_lng=$19,google_business_status='OPERATIONAL',
      google_maps_uri=$23,google_rating_count=$24,
      google_synced_at='${VERIFIED_AT}'::timestamptz,
      google_rating=$25,google_phone=$26,google_opening_hours=$27,
      google_photo_name=$28,google_photo_attribution=$29,google_primary_type=$30,
      google_types=$31,verification_status='verified',verification_confidence=0.999,
      verification_reason=$13,google_display_name_he=$32,google_formatted_address_he=$33,
      google_display_name_en=$34,google_formatted_address_en=$35 WHERE id=$36`,
    values,
  );
  return { id, action, name: r.name };
}

function uploadPhoto(buffer, id) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'restaurants/google', public_id: `restaurant_${id}_google_800`, overwrite: true,
        resource_type: 'image', context: { source: 'google_places' } },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
}

async function syncPhotos(db, results) {
  if (!WITH_PHOTOS) return [];
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
  const google = new GooglePlaces(process.env.GOOGLE_PLACES_API_KEY, { rateMs: 180 });
  const out = [];
  for (const result of results) {
    const source = restaurants.find((r) => r.name === result.name);
    if (!source?.googlePhotoName) continue;
    try {
      const photo = await google.getPhotoBytes(source.googlePhotoName, { maxWidthPx: 800 });
      const uploaded = await uploadPhoto(photo.buffer, result.id);
      await db.query(
        `UPDATE restaurants SET photo_url=$1,photo_attribution=$2,
         photo_source='google_places',photo_fetched_at=now() WHERE id=$3`,
        [uploaded.secure_url, source.googlePhotoAttribution, result.id],
      );
      out.push({ id: result.id, name: result.name, status: 'ok', photoUrl: uploaded.secure_url });
    } catch (error) {
      out.push({ id: result.id, name: result.name, status: 'error', error: error.message });
    }
  }
  return out;
}

(async () => {
  const db = client();
  await db.connect();
  console.log('=== TBILISI LAUNCH IMPORT ===');
  console.log(`mode: ${APPLY ? 'APPLY' : 'DRY RUN (read-only)'}`);
  console.log(`photos: ${WITH_PHOTOS ? 'Google Places -> Cloudinary' : 'metadata only'}`);
  console.log('existing:', JSON.stringify(await state(db), null, 2));
  console.log('planned: Georgia -> Tbilisi; 6 restaurant-list entries; hotel ratings excluded; Chabad umbrella rating included');
  if (!APPLY) {
    await db.end();
    console.log('No writes. Re-run with --apply after reviewing.');
    return;
  }
  await db.query('BEGIN');
  let results;
  try {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('import-tbilisi-launch-data'))");
    const georgia = await ensureDestination(db,
      { name: 'Georgia', nameHe: 'גאורגיה', country: 'Georgia', code: 'GE', city: 'Georgia', lat: 42.3154, lng: 43.3569 });
    const tbilisi = await ensureDestination(db,
      { name: 'Tbilisi', nameHe: 'טביליסי', country: 'Georgia', code: 'GE', city: 'Tbilisi', lat: 41.6938, lng: 44.8015 }, georgia.id);
    results = [];
    for (const restaurant of restaurants) results.push(await upsertRestaurant(db, tbilisi.id, restaurant));
    await db.query('COMMIT');
    console.log('destination actions:', { georgia, tbilisi });
    console.log('restaurant actions:', results);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
  console.log('photo actions:', await syncPhotos(db, results));
  console.log('verified state:', JSON.stringify(await state(db), null, 2));
  await db.end();
})().catch((error) => {
  console.error('Import failed:', error);
  process.exit(1);
});
