import AppDataSource from '../src/data-source';

async function run() {
  await AppDataSource.initialize();
  const r = await AppDataSource.query(
    `SELECT id, name, country FROM destinations WHERE country != 'Israel' ORDER BY country, name`,
  );
  if (r.length === 0) console.log('No international destinations found.');
  r.forEach((d: { id: number; name: string; country: string }) =>
    console.log(`${d.id} | ${d.name} | ${d.country}`),
  );
  await AppDataSource.destroy();
}
run().catch((e) => { console.error(e); process.exit(1); });
