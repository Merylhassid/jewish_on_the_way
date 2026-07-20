/*
 * Read-only audit of the restaurants table.
 * Produces a completeness report + a stratified CSV sample for manual review.
 * Does NOT write to the DB and does NOT call any external API.
 *
 * Usage: node scripts/audit-restaurants.js
 * Reads DB connection from backend/.env (DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS/DB_SSL).
 */
'use strict';

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { ISRAEL_JOIN, ISRAEL_WHERE } = require('./lib/israel-filter');

// Reusable Israel-only id subquery — every audit count is scoped through this.
const IL_IDS = `(select r.id from restaurants r ${ISRAEL_JOIN} where ${ISRAEL_WHERE})`;

function buildClient() {
  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl:
      process.env.DB_SSL === 'true'
        ? {
            rejectUnauthorized:
              process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' ? true : false,
          }
        : false,
  });
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function scalar(c, sql) {
  const r = await c.query(sql);
  return r.rows[0] ? Object.values(r.rows[0])[0] : null;
}

(async () => {
  const c = buildClient();
  await c.connect();

  const line = (label, val) => console.log(String(label).padEnd(42), val);
  console.log('\n=== RESTAURANT AUDIT REPORT (ISRAEL ONLY) ===\n');

  const total = Number(await scalar(c, `select count(*) from restaurants where id in ${IL_IDS}`));
  line('Israel restaurants', total);

  const metrics = {
    'with google_place_id':
      "count(*) filter (where google_place_id is not null and google_place_id <> '')",
    'with location (geography)': 'count(*) filter (where location is not null)',
    'with lat/lng columns':
      'count(*) filter (where lat is not null and lng is not null)',
    'with address': "count(*) filter (where address is not null and address <> '')",
    'with phone': "count(*) filter (where phone is not null and phone <> '')",
    'with rating': 'count(*) filter (where rating is not null)',
    'with opening_hours':
      "count(*) filter (where opening_hours is not null and opening_hours <> '')",
    'with city': "count(*) filter (where city is not null and city <> '')",
    'is_kosher = true': 'count(*) filter (where is_kosher = true)',
  };
  const sel = Object.entries(metrics)
    .map(([k, v], i) => `${v} as m${i}`)
    .join(', ');
  const row = (await c.query(`select ${sel} from restaurants where id in ${IL_IDS}`)).rows[0];
  console.log('\n-- Field completeness --');
  Object.keys(metrics).forEach((k, i) => {
    const n = Number(row[`m${i}`]);
    const pct = total ? ((n / total) * 100).toFixed(1) : '0.0';
    line(k, `${n}  (${pct}%)`);
  });

  console.log('\n-- By destination (top 15) --');
  const byDest = await c.query(
    `select r."destinationId" as did, d.city, count(*) c
       from restaurants r
       ${ISRAEL_JOIN}
      where ${ISRAEL_WHERE}
      group by r."destinationId", d.city
      order by c desc limit 15`,
  );
  byDest.rows.forEach((x) => line(`  #${x.did} ${x.city || '(?)'}`, x.c));

  // Possible duplicates: same normalized name within ~200m
  console.log('\n-- Possible duplicates (same name, within ~200m) --');
  const dupes = await c.query(`
    with pairs as (
      select a.id a_id, a.name a_name, b.id b_id,
             ST_Distance(a.location, b.location) dist
        from restaurants a
        join restaurants b
          on a.id < b.id
         and lower(trim(a.name)) = lower(trim(b.name))
         and a.location is not null and b.location is not null
         and ST_DWithin(a.location, b.location, 200)
         and a.id in ${IL_IDS} and b.id in ${IL_IDS}
    )
    select count(*) c from pairs`);
  line('  duplicate pairs (name + <200m)', dupes.rows[0].c);
  const dupeSample = await c.query(`
    select a.id a_id, b.id b_id, a.name,
           round(ST_Distance(a.location, b.location)::numeric, 1) dist_m
      from restaurants a
      join restaurants b
        on a.id < b.id
       and lower(trim(a.name)) = lower(trim(b.name))
       and a.location is not null and b.location is not null
       and ST_DWithin(a.location, b.location, 200)
       and a.id in ${IL_IDS} and b.id in ${IL_IDS}
     order by dist_m asc limit 10`);
  dupeSample.rows.forEach((x) =>
    line(`  #${x.a_id}=#${x.b_id} ${x.dist_m}m`, x.name),
  );

  // Suspicious names: very short, or address without house number / just city
  console.log('\n-- Data-quality flags --');
  line(
    '  name length <= 2 chars',
    await scalar(c, `select count(*) from restaurants where char_length(trim(name)) <= 2 and id in ${IL_IDS}`),
  );
  line(
    "  address is just 'City, Israel' style (no street digit)",
    await scalar(
      c,
      `select count(*) from restaurants where address !~ '[0-9]' and id in ${IL_IDS}`,
    ),
  );

  // Stratified sample CSV: 50 random + 50 shortest names + 50 across distinct destinations
  console.log('\n-- Writing stratified sample CSV --');
  const sampleSql = `
    (select * from restaurants where id in ${IL_IDS} order by random() limit 50)
    union
    (select * from restaurants where id in ${IL_IDS} order by char_length(trim(name)) asc, random() limit 50)
    union
    (select distinct on ("destinationId") * from restaurants where id in ${IL_IDS} order by "destinationId", random() limit 60)`;
  const sample = await c.query(sampleSql);
  const cols = ['id', 'name', 'address', 'city', 'phone', 'rating', 'kashrutLevel', 'restaurantType', 'destinationId'];
  // map camelCase entity cols to actual db cols
  const dbCols = {
    id: 'id', name: 'name', address: 'address', city: 'city', phone: 'phone',
    rating: 'rating', kashrutLevel: 'kashrut_level', restaurantType: 'restaurant_type',
    destinationId: 'destinationId',
  };
  const full = await c.query(
    `select ${Object.values(dbCols).map((x) => `"${x}"`).join(', ')}
       from restaurants where id = any($1::int[]) order by id`,
    [sample.rows.map((r) => r.id)],
  );
  const outDir = path.join(__dirname, '..', 'audit-output');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'restaurant-sample.csv');
  const header = Object.keys(dbCols).join(',');
  const body = full.rows
    .map((r) => Object.values(dbCols).map((db) => csvEscape(r[db])).join(','))
    .join('\n');
  fs.writeFileSync(outFile, '﻿' + header + '\n' + body + '\n', 'utf8');
  line('  sample rows written', full.rows.length);
  line('  file', path.relative(path.join(__dirname, '..'), outFile));

  await c.end();
  console.log('\n=== END REPORT ===\n');
})().catch((e) => {
  console.error('Audit failed:', e.message);
  process.exit(1);
});
