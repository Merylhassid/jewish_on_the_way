import AppDataSource from '../src/data-source';

async function fix() {
  await AppDataSource.initialize();
  console.log('DB connected.\n');

  const before = await AppDataSource.query(`SELECT COUNT(*) FROM restaurants`);
  console.log('Before:', before[0].count);

  // Delete exact duplicates keeping highest id
  const del = await AppDataSource.query(`
    DELETE FROM restaurants a
    USING restaurants b
    WHERE a.name = b.name
      AND a.address IS NOT DISTINCT FROM b.address
      AND a.id < b.id
  `);
  console.log('Deleted:', del[1] ?? 0);

  const after = await AppDataSource.query(`SELECT COUNT(*) FROM restaurants`);
  console.log('After:', after[0].count);

  // Check if any same-name+city duplicates remain (chains with different addresses are fine)
  const remaining = await AppDataSource.query(`
    SELECT name, city, COUNT(*) as count
    FROM restaurants
    GROUP BY name, city
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 10
  `);
  console.log('\nSame-name+city (different addresses, these are chain branches — OK):');
  remaining.forEach((r: { name: string; city: string; count: string }) =>
    console.log(`  ${r.count}x ${r.name} | ${r.city}`),
  );

  await AppDataSource.destroy();
}
fix().catch((e) => { console.error(e); process.exit(1); });
