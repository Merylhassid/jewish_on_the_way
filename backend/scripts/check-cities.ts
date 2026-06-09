import AppDataSource from '../src/data-source';

async function check() {
  await AppDataSource.initialize();

  // Duplicates by name + city
  const byNameCity = await AppDataSource.query(`
    SELECT name, city, COUNT(*) as count
    FROM restaurants
    GROUP BY name, city
    HAVING COUNT(*) > 1
    ORDER BY count DESC, name
    LIMIT 30
  `);
  console.log('Duplicates by name+city:');
  byNameCity.forEach((r: { name: string; city: string; count: string }) =>
    console.log(`  ${r.count}x | ${r.name} | ${r.city}`),
  );

  // Duplicates by name + address
  const byNameAddr = await AppDataSource.query(`
    SELECT name, address, COUNT(*) as count
    FROM restaurants
    GROUP BY name, address
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 30
  `);
  console.log('\nDuplicates by name+address:');
  byNameAddr.forEach((r: { name: string; address: string; count: string }) =>
    console.log(`  ${r.count}x | ${r.name} | ${r.address}`),
  );

  const totalDups = await AppDataSource.query(`
    SELECT SUM(count - 1) as extra_rows FROM (
      SELECT COUNT(*) as count FROM restaurants GROUP BY name, city HAVING COUNT(*) > 1
    ) sub
  `);
  console.log('\nTotal extra rows to remove:', totalDups[0].extra_rows);

  await AppDataSource.destroy();
}
check().catch(console.error);
