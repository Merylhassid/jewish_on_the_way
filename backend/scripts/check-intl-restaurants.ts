import AppDataSource from '../src/data-source';

const INTL_CITIES = ['Budapest','Paris','London','New York','Amsterdam','Berlin','Prague','Rome','Barcelona','Vienna'];

async function main() {
  await AppDataSource.initialize();

  for (const city of INTL_CITIES) {
    const rows = await AppDataSource.query(
      `SELECT name, address, phone FROM restaurants WHERE city = $1 ORDER BY name`,
      [city],
    );
    if (rows.length === 0) { console.log(`\n${city}: (none)`); continue; }
    console.log(`\n${city} (${rows.length}):`);
    rows.forEach((r: { name: string; address: string; phone: string }) =>
      console.log(`  • ${r.name} | ${r.address || '-'} | ${r.phone || '-'}`),
    );
  }

  await AppDataSource.destroy();
}
main().catch(e => { console.error(e); process.exit(1); });
