import AppDataSource from '../src/data-source';

async function check() {
  await AppDataSource.initialize();

  const dest = await AppDataSource.query(`
    SELECT id, name FROM destinations
    WHERE name ILIKE '%netanya%'
       OR name ILIKE '%ra%anana%'
       OR name ILIKE '%kfar saba%'
       OR name ILIKE '%ramat%sharon%'
       OR name ILIKE '%or akiva%'
       OR name ILIKE '%hadera%'
       OR name ILIKE '%herzliya%'
    ORDER BY name
  `);
  console.log('Destinations found:');
  dest.forEach((d: { id: number; name: string }) => console.log(`  ${d.id}: ${d.name}`));

  await AppDataSource.destroy();
}
check().catch((e) => { console.error(e); process.exit(1); });
