import AppDataSource from '../src/data-source';

const MISSING: Array<{ name: string; country: string; countryCode: string; lat: number; lng: number }> = [
  { name: 'Budapest',  country: 'Hungary',     countryCode: 'HU', lat: 47.4979, lng: 19.0402 },
  { name: 'Amsterdam', country: 'Netherlands', countryCode: 'NL', lat: 52.3676, lng:  4.9041 },
  { name: 'Berlin',    country: 'Germany',     countryCode: 'DE', lat: 52.5200, lng: 13.4050 },
  { name: 'Vienna',    country: 'Austria',     countryCode: 'AT', lat: 48.2082, lng: 16.3738 },
];

async function run() {
  await AppDataSource.initialize();
  for (const d of MISSING) {
    const existing = await AppDataSource.query(
      `SELECT id FROM destinations WHERE name = $1`, [d.name],
    );
    if (existing.length > 0) {
      console.log(`  ⏭  ${d.name} already exists (id ${existing[0].id})`);
      continue;
    }
    const res = await AppDataSource.query(
      `INSERT INTO destinations (name, country, country_code, city, location)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)
       RETURNING id`,
      [d.name, d.country, d.countryCode, d.name, d.lng, d.lat],
    );
    console.log(`  ✓ Created: ${d.name} (id ${res[0].id})`);
  }
  await AppDataSource.destroy();
}
run().catch((e) => { console.error(e); process.exit(1); });
