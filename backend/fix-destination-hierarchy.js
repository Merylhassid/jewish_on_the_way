const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

// Country parent nodes to create (name, country, country_code, lat, lon)
const PARENTS_TO_CREATE = [
  { name: 'Israel',      country: 'Israel',      country_code: 'IL', lat: 31.5000, lon: 34.7500 },
  { name: 'Netherlands', country: 'Netherlands', country_code: 'NL', lat: 52.3676, lon: 4.9041  },
  { name: 'Germany',     country: 'Germany',     country_code: 'DE', lat: 52.5200, lon: 13.4050 },
  { name: 'Austria',     country: 'Austria',     country_code: 'AT', lat: 47.8095, lon: 13.0550 },
  { name: 'Hungary',     country: 'Hungary',     country_code: 'HU', lat: 47.4979, lon: 19.0402 },
  { name: 'Canada',      country: 'Canada',      country_code: 'CA', lat: 45.5017, lon: -73.5673 },
  { name: 'Argentina',   country: 'Argentina',   country_code: 'AR', lat: -34.6037, lon: -58.3816 },
];

// Cities to re-parent: { cityName (as in DB), parentCountry }
const SINGLE_CITY_REPARENTS = [
  { cityName: 'Amsterdam',   parentCountry: 'Netherlands' },
  { cityName: 'Berlin',      parentCountry: 'Germany'     },
  { cityName: 'Vienna',      parentCountry: 'Austria'     },
  { cityName: 'Budapest',    parentCountry: 'Hungary'     },
  { cityName: 'Montreal',    parentCountry: 'Canada'      },
  { cityName: 'Buenos Aires',parentCountry: 'Argentina'   },
];

client.connect().then(async () => {
  console.log('🔧 Starting destination hierarchy fix...\n');

  // Step 1: Create parent destinations
  const parentIds = {};

  for (const p of PARENTS_TO_CREATE) {
    // Check if already exists as a root with no children
    const existing = await client.query(
      `SELECT id FROM destinations WHERE name = $1 AND "parent_id" IS NULL LIMIT 1`,
      [p.name]
    );

    if (existing.rows.length > 0) {
      parentIds[p.name] = existing.rows[0].id;
      console.log(`✅ Parent already exists: ${p.name} [${existing.rows[0].id}]`);
    } else {
      const res = await client.query(
        `INSERT INTO destinations (name, country, country_code, city, location, created_at)
         VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), NOW())
         RETURNING id`,
        [p.name, p.country, p.country_code, p.name, p.lon, p.lat]
      );
      parentIds[p.name] = res.rows[0].id;
      console.log(`🆕 Created parent: ${p.name} [${res.rows[0].id}]`);
    }
  }

  console.log('\n--- Linking cities to parents ---\n');

  // Step 2: Link all Israeli cities to Israel parent
  const israelId = parentIds['Israel'];
  const israelUpdate = await client.query(
    `UPDATE destinations SET "parent_id" = $1
     WHERE country = 'Israel' AND "parent_id" IS NULL AND name != 'Israel'`,
    [israelId]
  );
  console.log(`🇮🇱 Linked ${israelUpdate.rowCount} Israeli cities → Israel [${israelId}]`);

  // Step 3: Link single European/American cities
  for (const { cityName, parentCountry } of SINGLE_CITY_REPARENTS) {
    const parentId = parentIds[parentCountry];
    const res = await client.query(
      `UPDATE destinations SET "parent_id" = $1
       WHERE name = $2 AND "parent_id" IS NULL`,
      [parentId, cityName]
    );
    console.log(`  ${res.rowCount > 0 ? '✅' : '⚠️ not found'} ${cityName} → ${parentCountry} [${parentId}]`);
  }

  // Step 4: Verify final state
  console.log('\n--- Final root destinations ---\n');
  const roots = await client.query(
    `SELECT id, name, country,
       (SELECT COUNT(*) FROM destinations c WHERE c.parent_id = d.id) as child_count
     FROM destinations d WHERE d.parent_id IS NULL ORDER BY country, name`
  );
  roots.rows.forEach(r =>
    console.log(`  [${r.id}] ${r.name} | ${r.country} | children: ${r.child_count}`)
  );

  const stats = await client.query(
    `SELECT COUNT(*) FILTER (WHERE parent_id IS NULL) as root,
            COUNT(*) FILTER (WHERE parent_id IS NOT NULL) as children
     FROM destinations`
  );
  console.log('\n📊 Stats:', stats.rows[0]);

  await client.end();
  console.log('\n✅ Done!');
}).catch(e => { console.error('❌', e.message); client.end(); });
