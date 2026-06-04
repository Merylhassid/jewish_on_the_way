const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

const updates = [
  { name: 'Stadttempel',                    lat: 48.2114825, lon: 16.3747935 },
  { name: 'Agudas Yisroel',                 lat: 48.2077630, lon: 16.3758221 },
  { name: 'Mizrahi',                         lat: 48.2119107, lon: 16.3692172 },
  { name: 'בית הכנסת הרוסי',               lat: 48.2051652, lon: 16.3700418 },
  { name: 'Chabad Vienna',                  lat: 48.2159896, lon: 16.3807498 },
  { name: 'בית הכנסת הקווקזי הספרדי',     lat: 48.2196737, lon: 16.3821530 },
  { name: 'Machzikey Hadas',                lat: 48.2161492, lon: 16.3822279 },
  { name: 'Kahal Chassidim',                lat: 48.2162323, lon: 16.3756599 },
  { name: 'Bet Halevi',                     lat: 48.2284227, lon: 16.3804598 },
  { name: 'Ohel Avraham',                   lat: 48.2425910, lon: 16.3528816 },
];

client.connect().then(async () => {
  for (const u of updates) {
    const r = await client.query(
      `UPDATE synagogues
       SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)
       WHERE name = $3 AND "destinationId" = 484`,
      [u.lon, u.lat, u.name]
    );
    console.log(`${r.rowCount > 0 ? '✅' : '⚠️ not found'} ${u.name} → ${u.lat}, ${u.lon}`);
  }
  await client.end();
  console.log('\nDone!');
}).catch(e => { console.error(e.message); client.end(); });
