'use strict';

/**
 * Idempotent import for the Bucharest launch batch.
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
    googlePlaceId: 'ChIJRdKQ4hr_sUAR9Wpcb5szOvk',
    name: 'Bereshit Kosher Restaurant — בראשית',
    restaurantType: 'meat',
    restaurantTypeConfidence: 1,
    kashrutLevel: 'mehadrin',
    address: 'Str. Tache Ionescu 9, 010352 București, Romania',
    openingHours:
      'Monday-Thursday 13:30-21:30; Friday-Sunday closed; Shabbat meals and catering by advance reservation',
    lat: 44.444438,
    lng: 26.0975491,
    rating: 4.2,
    phone: '+40 742 148 821',
    category: 'Kosher meat restaurant and catering',
    websiteUrl: 'https://kosher-bucharest.com/',
    websiteText:
      'Chabad-operated Mehadrin kosher meat restaurant and catering service, with Shabbat meals by reservation.',
    sourceSummary:
      'User-provided Google listing; active Google Places listing at Tache Ionescu 9; official Bereshit/Chabad Bucharest website.',
    kosherReason:
      'Official Bereshit/Chabad Bucharest information: Mehadrin kosher meat restaurant and catering supervised by Rabbi Naftali Deutsch.',
    googleDisplayName: 'מסעדה כשרה בבוקרשט בראשית ובית חב"ד',
    googleDisplayNameHe: 'מסעדה כשרה בבוקרשט בראשית ובית חב"ד',
    googleFormattedAddress: 'Str. Tache Ionescu 9, 010352 București, Romania',
    googleFormattedAddressHe: 'Str. Tache Ionescu 9, 010352 București, רומניה',
    googleRating: 4.2,
    googleRatingCount: 246,
    googlePhone: '+40 742 148 821',
    googleMapsUri:
      'https://maps.google.com/?cid=17958723206774549237&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googleOpeningHours:
      'Monday-Thursday 13:30-21:30; Friday closed; Saturday closed; Sunday closed',
    googlePhotoName:
      'places/ChIJRdKQ4hr_sUAR9Wpcb5szOvk/photos/AWCwydg1-Y0XVegxE4kXKbmO8bcw_jBpeFUifNT1iW8cSXsnH7tu6HsTL2Hz7PL2qY1_bmoVCE-xIExqMofANcevCm0UKH21TOVLIL80OH3VfurPb1_GRIUgV0v1iBOy_5pNpZe04po4xBcWLx6Xg-CXwS45_e2zzf_mXcsqX5b0ABftm2Y1PT1vagcc3PK3_JYc8x0jrFIL-A89yUhoJvflcM0q7UGZrjbgsSMkyN3YHV5VR7blUUW4UxB8CN3N8QmCqzILxtrrnsDvC_gyF7hIuM-4zriT-8DVQaf7wNiKjf8R9Obw2bZn5Q2oQlErmBp6ks7c8R04Xhq8-9V2oMqt8pp65QH2z4Gwdr1BnRF55MbbUukp81QnTUHTqgAD7lmaJiWL5C_PkS4QCX98nHJI7R7hSyWr2T9pzXxDwKcLz38FUuQm',
    googlePhotoAttribution: 'מסעדה כשרה בבוקרשט בראשית ובית חב"ד',
    googlePrimaryType: 'restaurant',
    googleTypes: 'restaurant,food,point_of_interest,establishment',
    tags: ['kosher', 'mehadrin', 'meat', 'chabad', 'catering', 'shabbat-meals'],
  },
  {
    googlePlaceId: 'ChIJN8hci37_sUARpKg0Vbx2Ucs',
    name: 'Avraham Kosher — מסעדת אברהם',
    restaurantType: 'dairy',
    restaurantTypeConfidence: 1,
    kashrutLevel: 'rabbinate',
    address:
      'Bulevardul Corneliu Coposu 4, Unirii, 030605 București, Romania',
    openingHours:
      'Sunday 10:30-21:00; Monday-Thursday 09:00-21:00; Friday 09:00-17:00; Saturday closed',
    lat: 44.4304088,
    lng: 26.1083114,
    rating: 4.5,
    phone: '+40 771 191 364',
    category: 'Kosher dairy restaurant',
    websiteUrl: null,
    websiteText:
      'Kosher dairy restaurant under Rabbi Rafael Shaffer, with Pat Yisrael and Chalav Yisrael.',
    sourceSummary:
      'User-provided Google listing; Google Places; user-provided kashrut details.',
    kosherReason:
      'Dairy kosher supervision by Rabbi Rafael Shaffer; Pat Yisrael and Chalav Yisrael. No source explicitly states Mehadrin, so mapped conservatively to local rabbinate.',
    googleDisplayName: 'Avraham Kosher מסעדת אברהם - כשר',
    googleDisplayNameHe: 'Avraham Kosher מסעדת אברהם - כשר',
    googleFormattedAddress:
      'Bulevardul Corneliu Coposu 4, Unirii, 030605 București, Romania',
    googleFormattedAddressHe:
      'Bulevardul Corneliu Coposu 4, Unirii, 030605 București, רומניה',
    googleRating: 4.5,
    googleRatingCount: 617,
    googlePhone: '+40 771 191 364',
    googleMapsUri:
      'https://maps.google.com/?cid=14650621614068377764&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googleOpeningHours:
      'Sunday 10:30-21:00; Monday-Thursday 09:00-21:00; Friday 09:00-17:00; Saturday closed',
    googlePhotoName:
      'places/ChIJN8hci37_sUARpKg0Vbx2Ucs/photos/AWCwydhn1cMLrvVcDSWBLejGYDR7ZmY3fg3JhcS53JSpsNy_0OogvIlxO9eT65RmT2J1PMAZiZaHkbhXHfLREMfuSQAwO8x833GcNBb4ZNmk4nid0f8AYb63CFoHcjVIhhUjeKGHsReR-SSVtUy7h9N5VuopmCTQXtb6GE732aKrBkRbeL05twu4nCDIla0bjSSNaYHajSC3mYKTejGX1ukiKriDZJmweJt8vLw6cBdMqS9wy0Al7sk8tLCdF7z6A4TLz7Db57fdp-tOxPQPKSHESC21Oo9_KCijI1Tq4owkZfxt1kB1q1QZhu6qsteB3jvQlA8KTn81huVyiRx3W8GM5UBp951EhQTafY78iazQHNlTCJA8trVRE-r27zSijcAi3sT4aoF4MgXyn3PV_mn9wxtxIUfdDfaY0FJ_PJjhIA5AOZDHmZy9o-6isGM0TA',
    googlePhotoAttribution: 'Avraham Kosher מסעדת אברהם - כשר',
    googlePrimaryType: 'restaurant',
    googleTypes: 'restaurant,food,point_of_interest,establishment',
    tags: ['kosher', 'dairy', 'chalav-yisrael', 'pat-yisrael'],
  },
  {
    googlePlaceId: 'ChIJ-0vuHw__sUARgfyeeFt6gIU',
    name: 'Moise House — מוישה האוס',
    restaurantType: 'meat',
    restaurantTypeConfidence: 1,
    kashrutLevel: 'mehadrin',
    address: 'Strada Bibescu Vodă 19, 040151 București, Romania',
    openingHours:
      'Sunday-Thursday 11:00-23:00; Friday 11:00-16:00; Saturday closed',
    lat: 44.4252757,
    lng: 26.1023951,
    rating: 4.3,
    phone: '+40 769 211 112',
    category: 'Kosher meat family restaurant, steakhouse and catering',
    websiteUrl: 'https://kosherromania.com/',
    websiteText:
      'Mehadrin kosher meat restaurant serving Israeli food, European dishes, catering, takeaway and delivery.',
    sourceSummary:
      'User-provided Google listing; Google Places; kosherromania.com; user-provided supervision details.',
    kosherReason:
      'Mehadrin meat restaurant supervised by Rabbi Shlomo Bekesht; user-provided source also identifies Lubavitch shechita.',
    googleDisplayName:
      'מסעדה כשרה בבוקרשט - מוישה האוס | Kosher Restaurant in Bucarest - Moise House',
    googleDisplayNameHe:
      'מסעדה כשרה בבוקרשט - מוישה האוס | Kosher Restaurant in Bucarest - Moise House',
    googleFormattedAddress: 'Strada Bibescu Vodă 19, 040151 București, Romania',
    googleFormattedAddressHe: 'Strada Bibescu Vodă 19, 040151 București, רומניה',
    googleRating: 4.3,
    googleRatingCount: 1263,
    googlePhone: '+40 769 211 112',
    googleMapsUri:
      'https://maps.google.com/?cid=9619823337347677313&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googleOpeningHours:
      'Sunday-Thursday 11:00-23:00; Friday 11:00-16:00; Saturday closed',
    googlePhotoName:
      'places/ChIJ-0vuHw__sUARgfyeeFt6gIU/photos/AWCwydhSPrQRE4BRgUxjVnIVb21Z-ms7iOOkLQNbUXWKNmt-TtMTanIcI3uwf8wCpXC9CCrv1WoMUE9XP1wwUxNw30fJuPsoPDKgDNvEfr5Iio2AmZiO5cyUTFKWiCIVwVW8Jr3T38JmENPXKBpK2TV3tKBJyKm5Esvx-rJZOPyBuh4UFBeXp-mf5yJ7hlotlFL-xAjJYSg729vfcypz-1qeLDjZ6io-6dL0sQ0BOIcx1_2SotpuO2ukJmsbcjXOVBDW9CKhidaeneSvlCLgqlHEQmfi8usBVyS_rupdXNfNWysv5tYuTlU80dAYTwO0RoabQNquxFi7MFFSPRyzWVpZ86LFz_yHJLZTqMpGoues98HCJuUvfnkLjk_RPg2OlqdEm-NhPWxRfgGdiQ1jiX2_yluUKHNMZllTLTWYxDIknh4FOz2fAEE_jhCo9KJNBQ',
    googlePhotoAttribution:
      'מסעדה כשרה בבוקרשט - מוישה האוס | Kosher Restaurant in Bucarest - Moise House',
    googlePrimaryType: 'restaurant',
    googleTypes:
      'family_restaurant,steak_house,catering_service,meal_takeaway,food_delivery,grocery_store,food_store,store,restaurant,food,point_of_interest,service,establishment',
    tags: ['kosher', 'mehadrin', 'meat', 'steakhouse', 'catering', 'delivery'],
  },
  {
    googlePlaceId: 'ChIJg1E0PWD_sUARHK8MDeWqK5U',
    name: 'Zadok Bsarim Kosher Restaurant — צדוק בשרים',
    restaurantType: 'meat',
    restaurantTypeConfidence: 1,
    kashrutLevel: 'rabbinate',
    address: 'Bulevardul Ion C. Brătianu 29, 030167 București, Romania',
    openingHours:
      'Sunday-Monday 12:00-22:30; Tuesday-Thursday 12:00-23:00; Friday 12:00-17:00; Saturday 19:00-22:30',
    lat: 44.430588,
    lng: 26.1040324,
    rating: 4.2,
    phone: '+40 775 221 221',
    category: 'Kosher Israeli meat restaurant',
    websiteUrl: 'http://www.instagram.com/zadok_kosher_restaurant',
    websiteText:
      'Kosher Israeli-style meat restaurant near Bucharest Old Town.',
    sourceSummary:
      'User-provided Google listing; Google Places; user-provided kashrut details.',
    kosherReason:
      'Supervised by Rabbi Rafael Shaffer. Source explicitly states regular kosher certification and not Mehadrin.',
    googleDisplayName:
      'Zadok Bsarim Kosher Restaurant | מסעדת צדוק בשרים כשר',
    googleDisplayNameHe:
      'Zadok Bsarim Kosher Restaurant | מסעדת צדוק בשרים כשר',
    googleFormattedAddress:
      'Bulevardul Ion C. Brătianu 29, 030167 București, Romania',
    googleFormattedAddressHe:
      'Bulevardul Ion C. Brătianu 29, 030167 București, רומניה',
    googleRating: 4.2,
    googleRatingCount: 546,
    googlePhone: '+40 775 221 221',
    googleMapsUri:
      'https://maps.google.com/?cid=10748872836392988444&g_mp=CiVnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLkdldFBsYWNlEAIYBCAA',
    googleOpeningHours:
      'Sunday-Monday 12:00-22:30; Tuesday-Thursday 12:00-23:00; Friday 12:00-17:00; Saturday 19:00-22:30',
    googlePhotoName:
      'places/ChIJg1E0PWD_sUARHK8MDeWqK5U/photos/AWCwydjl8SJDuUN3muzPqWLWwZm9gYjQYEs2DYK49BMrCjLlJa8LyDqk2CP9K7IOpF2PZhkR0ifbOeYEbv1xNWRXxhh0_36NylynkeOxkeKxm7OCZSYsXHKecSpn8cbHifSUtk5hfTHC8jPByddzvps3aPK14dlIsos9K1U-Ft7aSGimezI96Pt3xFwtbRvzJrv55UrgfKbzJ0nZ8fVbBkVawAGO7LLrRBO_-gsRtCB-G1XvdW_w_nzOb-veMxqPEA0_5ShOFrYFhRFmkahk1-Kv-ArWkAdqXF_w5wQYSvIOxb90h94StpiilBTtAsfxYXBMzXx4zl_9Xr6A9dbnzpGF2SGdl85nY6pBe1Pe61Mkb7ZjObIQhIw97c3w5JaaFvnxPIeG4ccjMDuzzuCVp1BCZ6cKCrDPl82XktbZkyzYQORe424tNNeqCz0_gPFQyA',
    googlePhotoAttribution:
      'Zadok Bsarim Kosher Restaurant | מסעדת צדוק בשרים כשר',
    googlePrimaryType: 'restaurant',
    googleTypes: 'restaurant,food,point_of_interest,establishment',
    tags: ['kosher', 'meat', 'israeli', 'old-town'],
  },
  {
    googlePlaceId: null,
    name: 'Bereshit Kosher Shop — החנות הכשרה של חב״ד',
    restaurantType: null,
    restaurantTypeConfidence: null,
    kashrutLevel: 'unknown',
    address: 'Str. Tache Ionescu 9, floor 2, 010352 București, Romania',
    openingHours: 'Monday-Friday 09:00-17:00; online ordering available',
    lat: 44.4444529,
    lng: 26.0974515,
    rating: null,
    phone: '+40 726 601 219',
    category: 'Kosher grocery store and online shop',
    websiteUrl:
      'https://kosher-bucharest.com/%d7%97%d7%a0%d7%95%d7%aa/',
    websiteText:
      'Chabad kosher grocery on the second floor of Yeshua Tova Synagogue, selling packaged food, frozen products, wine and household goods, with online ordering.',
    sourceSummary:
      'Official Bereshit/Chabad Bucharest shop and about pages. No separate Google listing supplied; no Google rating inferred.',
    kosherReason:
      'Official Chabad-operated kosher grocery. Individual products may carry different certification levels, so no uniform level is claimed.',
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
    tags: ['kosher', 'grocery', 'chabad', 'online-ordering', 'frozen-food', 'wine'],
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
  const d = await db.query(
    `SELECT id,name,name_he,parent_id FROM destinations
      WHERE country_code='RO' OR lower(name) IN ('romania','bucharest') ORDER BY parent_id NULLS FIRST,id`,
  );
  const r = await db.query(
    `SELECT id,name,google_place_id,"destinationId" FROM restaurants
      WHERE google_place_id=ANY($1::text[])
         OR lower(name) LIKE 'bereshit kosher shop%'
      ORDER BY id`,
    [restaurants.map((x) => x.googlePlaceId).filter(Boolean)],
  );
  const s = await db.query(
    `SELECT id,name,"destinationId" FROM synagogues
      WHERE lower(name) LIKE '%yeshua%tova%' OR lower("normalizedName")='yeshua tova synagogue'
      ORDER BY id`,
  );
  return { destinations: d.rows, restaurants: r.rows, synagogues: s.rows };
}

async function ensureDestination(db, data, parentId) {
  const found = await db.query(
    `SELECT id FROM destinations WHERE country_code=$1 AND parent_id IS NOT DISTINCT FROM $2
      AND lower(name)=lower($3) ORDER BY id LIMIT 1`,
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
  const found = r.googlePlaceId
    ? await db.query('SELECT id FROM restaurants WHERE google_place_id=$1 LIMIT 1', [r.googlePlaceId])
    : await db.query(
        'SELECT id FROM restaurants WHERE "destinationId"=$1 AND lower(name)=lower($2) LIMIT 1',
        [destinationId, r.name],
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
    r.googlePrimaryType, r.googleTypes, r.googleDisplayNameHe,
    r.googleFormattedAddressHe, r.googleDisplayName, r.googleFormattedAddress, id,
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
      phone=$16,category=$17,city='Bucharest',country='Romania',lat=$18,lng=$19,
      geocoded_at='${VERIFIED_AT}'::timestamptz,tags=$20,
      google_display_name=$21,google_formatted_address=$22,
      google_lat=CASE WHEN $1::varchar IS NULL THEN NULL ELSE $18::double precision END,
      google_lng=CASE WHEN $1::varchar IS NULL THEN NULL ELSE $19::double precision END,
      google_business_status=CASE WHEN $1::varchar IS NULL THEN NULL ELSE 'OPERATIONAL' END,
      google_maps_uri=$23,google_rating_count=$24,
      google_synced_at=CASE WHEN $1::varchar IS NULL THEN NULL ELSE '${VERIFIED_AT}'::timestamptz END,
      google_rating=$25,google_phone=$26,google_opening_hours=$27,
      google_photo_name=$28,google_photo_attribution=$29,google_primary_type=$30,
      google_types=$31,verification_status='verified',verification_confidence=0.999,
      verification_reason=$13,google_display_name_he=$32,google_formatted_address_he=$33,
      google_display_name_en=$34,google_formatted_address_en=$35 WHERE id=$36`,
    values,
  );
  return { id, action, name: r.name };
}

async function upsertSynagogue(db, destinationId) {
  const found = await db.query(
    `SELECT id FROM synagogues WHERE "destinationId"=$1 AND
      (lower("normalizedName")='yeshua tova synagogue' OR lower(name) LIKE '%yeshua%tova%') LIMIT 1`,
    [destinationId],
  );
  let id;
  let action;
  if (found.rowCount) {
    id = found.rows[0].id;
    action = 'updated';
  } else {
    const inserted = await db.query(
      `INSERT INTO synagogues(name,source,"destinationId") VALUES($1,'manual',$2) RETURNING id`,
      ['Yeshua Tova–Tiferet David Synagogue — ישועה טובה–תפארת דוד', destinationId],
    );
    id = inserted.rows[0].id;
    action = 'inserted';
  }
  await db.query(
    `UPDATE synagogues SET name=$1,"normalizedName"='yeshua tova synagogue',address=$2,
      description=$3,location=ST_SetSRID(ST_MakePoint($4,$5),4326)::geography,
      website=$6,phone=$7,"openingHours"=$8,"addrStreet"='Tache Ionescu',
      "addrHousenumber"='9',"addrPostcode"='010352',"addrCity"='Bucharest',
      denomination='Chabad-Lubavitch',operator='Chabad Lubavitch of Romania',source='manual',
      "sourceConfidence"=0.99,"manuallyVerified"=true,"needsLocationVerification"=false,
      "destinationId"=$9,"verificationSource"='Google Places + Chabad Bucharest + user-provided schedule',
      "verificationNotes"=$10,updated_at=now() WHERE id=$11`,
    [
      'Yeshua Tova–Tiferet David Synagogue — ישועה טובה–תפארת דוד',
      'Str. Tache Ionescu 9, 010352 București, Romania',
      'Active Chabad synagogue and Jewish center in Bucharest. Weekday and Shabbat prayers, Shabbat meals and community services.',
      26.0974515,
      44.4444529,
      'https://www.chabadromania.com/',
      '+40 742 148 821',
      'Shacharit: Sunday 09:00; Monday-Friday 08:30. Mincha and Maariv: about 15 minutes before sunset. Shabbat Shacharit: 10:00; Friday evening times vary. Shabbat meals require registration.',
      destinationId,
      'Google Place ID ChIJr84yEU7_sUARW3iimpgr4zo; Maps https://maps.google.com/?cid=4243283208342501467; Google rating 4.5 from 880 ratings on 2026-07-20. Variable prayer times should be rechecked before travel.',
      id,
    ],
  );
  return { id, action };
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
  console.log('=== BUCHAREST LAUNCH IMPORT ===');
  console.log(`mode: ${APPLY ? 'APPLY' : 'DRY RUN (read-only)'}`);
  console.log(`photos: ${WITH_PHOTOS ? 'Google Places -> Cloudinary' : 'metadata only'}`);
  console.log('existing:', JSON.stringify(await state(db), null, 2));
  console.log('planned: Romania -> Bucharest; 5 restaurant-list entries; 1 synagogue');
  if (!APPLY) {
    await db.end();
    console.log('No writes. Re-run with --apply after reviewing.');
    return;
  }
  await db.query('BEGIN');
  let results;
  let synagogue;
  try {
    await db.query("SELECT pg_advisory_xact_lock(hashtext('import-bucharest-launch-data'))");
    const romania = await ensureDestination(db,
      { name: 'Romania', nameHe: 'רומניה', country: 'Romania', code: 'RO', city: 'Romania', lat: 44.4268, lng: 26.1025 });
    const bucharest = await ensureDestination(db,
      { name: 'Bucharest', nameHe: 'בוקרשט', country: 'Romania', code: 'RO', city: 'Bucharest', lat: 44.4268, lng: 26.1025 }, romania.id);
    results = [];
    for (const restaurant of restaurants) results.push(await upsertRestaurant(db, bucharest.id, restaurant));
    synagogue = await upsertSynagogue(db, bucharest.id);
    await db.query('COMMIT');
    console.log('destination actions:', { romania, bucharest });
    console.log('restaurant actions:', results);
    console.log('synagogue action:', synagogue);
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
