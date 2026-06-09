/**
 * Geocode restaurants that have no lat/lng.
 * Uses Nominatim (OSM) at max 1 req/s.
 * Run: node scripts/geocode-missing.js
 */
const { Client } = require('pg');
const https = require('https');

const DB = {
  host: 'ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech',
  port: 5432, user: 'neondb_owner', password: 'npg_4sdzL2HpDruE',
  database: 'neondb', ssl: { rejectUnauthorized: false },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'JewishOnTheWay/1.0 (meryl.hasid@gmail.com)' },
      timeout: 10000,
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function geocode(address, city, country) {
  // Try 1: full address
  const q1 = encodeURIComponent(`${address}, ${country}`);
  const url1 = `https://nominatim.openstreetmap.org/search?q=${q1}&format=json&limit=1`;
  const r1 = await get(url1);
  if (r1 && r1[0]) return { lat: parseFloat(r1[0].lat), lng: parseFloat(r1[0].lon), method: 'full' };

  await sleep(1100);

  // Try 2: city + country only (fallback)
  const q2 = encodeURIComponent(`${city}, ${country}`);
  const url2 = `https://nominatim.openstreetmap.org/search?q=${q2}&format=json&limit=1`;
  const r2 = await get(url2);
  if (r2 && r2[0]) return { lat: parseFloat(r2[0].lat), lng: parseFloat(r2[0].lon), method: 'city' };

  return null;
}

async function main() {
  const client = new Client(DB);
  await client.connect();

  const { rows } = await client.query(`
    SELECT r.id, r.name, r.address, d.city, d.country
    FROM restaurants r
    LEFT JOIN destinations d ON d.id = r."destinationId"
    WHERE r.location IS NULL AND r.address IS NOT NULL AND r.address != ''
    ORDER BY r.id
  `);

  console.log(`Found ${rows.length} restaurants without coordinates\n`);

  let updated = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    process.stdout.write(`[${i + 1}/${rows.length}] ${r.name} (${r.city})... `);

    try {
      const result = await geocode(r.address, r.city, r.country);

      if (result) {
        await client.query(
          `UPDATE restaurants SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id=$3`,
          [result.lng, result.lat, r.id]
        );
        console.log(`✓ ${result.lat.toFixed(4)},${result.lng.toFixed(4)} [${result.method}]`);
        updated++;
      } else {
        console.log('✗ not found');
        failed++;
      }
    } catch (err) {
      console.log(`✗ error: ${err.message}`);
      failed++;
    }

    // Nominatim rate limit: max 1 req/s
    await sleep(1100);
  }

  await client.end();
  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
}

main().catch(console.error);
