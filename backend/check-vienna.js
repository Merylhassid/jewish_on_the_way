const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

client.connect().then(async () => {
  const r = await client.query(`
    SELECT id, name, address,
      ST_Y(location::geometry) as lat,
      ST_X(location::geometry) as lon
    FROM synagogues
    WHERE "destinationId" = 484
    ORDER BY id
  `);
  console.log('=== Vienna synagogues + coordinates ===');
  r.rows.forEach(row => {
    const lat = parseFloat(row.lat).toFixed(6);
    const lon = parseFloat(row.lon).toFixed(6);
    const mapsUrl = `https://maps.google.com/?q=${lat},${lon}`;
    console.log(`[${row.id}] ${row.name}`);
    console.log(`  Address: ${row.address}`);
    console.log(`  Coords:  ${lat}, ${lon}`);
    console.log(`  Maps:    ${mapsUrl}`);
    console.log();
  });
  await client.end();
}).catch(e => { console.error(e.message); client.end(); });
