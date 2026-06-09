/**
 * Remove non-restaurant records that were accidentally imported from scraped
 * international pages (WhatsApp groups, comment sections, hotel tips, etc.)
 * These entries have NO address AND NO phone number.
 */
import AppDataSource from '../src/data-source';

const INTL_CITIES = ['Budapest','Paris','London','New York','Amsterdam','Berlin','Prague','Rome','Barcelona','Vienna'];

async function main() {
  await AppDataSource.initialize();

  const preview = await AppDataSource.query(
    `SELECT id, name, city FROM restaurants
     WHERE city = ANY($1)
       AND (address IS NULL OR TRIM(address) = '')
       AND (phone IS NULL OR TRIM(phone) = '')
     ORDER BY city, name`,
    [INTL_CITIES],
  );

  console.log(`\nWill delete ${preview.length} junk records:`);
  preview.forEach((r: { name: string; city: string }) => console.log(`  [${r.city}] ${r.name}`));

  const result = await AppDataSource.query(
    `DELETE FROM restaurants
     WHERE city = ANY($1)
       AND (address IS NULL OR TRIM(address) = '')
       AND (phone IS NULL OR TRIM(phone) = '')`,
    [INTL_CITIES],
  );

  console.log(`\nDeleted ${result[1]} records.`);

  const remaining = await AppDataSource.query(
    `SELECT city, COUNT(*) as count FROM restaurants WHERE city = ANY($1) GROUP BY city ORDER BY city`,
    [INTL_CITIES],
  );
  console.log('\nRemaining real restaurants per city:');
  remaining.forEach((r: { city: string; count: string }) => console.log(`  ${r.city}: ${r.count}`));

  await AppDataSource.destroy();
}
main().catch(e => { console.error(e); process.exit(1); });
