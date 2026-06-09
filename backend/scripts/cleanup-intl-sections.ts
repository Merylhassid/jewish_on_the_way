/**
 * Remove entries that are section headings or tourist attractions,
 * not actual restaurants.
 */
import AppDataSource from '../src/data-source';

// Names that are clearly not restaurants
const DELETE_BY_NAME = [
  // Paris section headings
  'מסעדות כשרות ברובע השמיני - מרכז פריז (שער הניצחון, שאנז אליזה)',
  'מסעדות כשרות ברובע ה- 11 בפריז (אזור הבסטיליה)',
  'מסעדות כשרות ברובע ה- 12 בפריז',
  'מסעדות כשרות ברובע ה- 16 (גני טרוקדרו, יער בולון)',
  'מסעדות כשרות ברובע ה- 17 בפריז',
  'מסעדות כשרות ברובע ה- 19 בפריז',
  'מסעדות כשרות ברובע השישי בפריז (גני לוקסמבורג)',
  'מסעדות כשרות ברובע התשיעי (גאלרי לאפייט, האופרה, בית הכנסת הגדול)',
  'מסעדות כשרות באזור לבלואה-פרה Levallois-Perret',
  'מסעדות כשרות באזור בולון-בילנקורט Boulogne-Billancourt',
  'שער הנצחון בפריז',
  // London
  'מצודת לונדון ותערוכת תכשיטי הכתר',
  'קבוצת וואטסאפ ללונדון - כל מה שתצטרכו לטיול הבא!',
  'מלונות כשרים באזור היהודי בצפון לונדון - גולדרס גרין',
  // Budapest
  'אוטובוס אמפיבי בבודפשט - חוויה בים וביבשה',
  'שייט בבודפשט',
  // Rome — these are section headings, not restaurants
  'מסעדות כשרות באזור מונטה ורדה Monteverde',
  'מסעדות כשרות בסגנון אסיאתי ברומא',
  'בית חב"ד רומא',
  // Vienna
  'קבוצת וואטסאפ לוינה - כל מה שתצטרכו לטיול הבא!',
];

async function main() {
  await AppDataSource.initialize();

  let deleted = 0;
  for (const name of DELETE_BY_NAME) {
    const res = await AppDataSource.query(
      `DELETE FROM restaurants WHERE name = $1 RETURNING id`, [name],
    );
    if (res[0]?.length > 0) {
      console.log(`  ✓ Deleted: ${name}`);
      deleted += res[0].length;
    }
  }

  console.log(`\nDeleted ${deleted} section/junk records.`);

  // Final count per city
  const INTL_CITIES = ['Budapest','Paris','London','New York','Amsterdam','Berlin','Prague','Rome','Barcelona','Vienna'];
  const counts = await AppDataSource.query(
    `SELECT city, COUNT(*) as count FROM restaurants WHERE city = ANY($1) GROUP BY city ORDER BY city`,
    [INTL_CITIES],
  );
  console.log('\nFinal restaurant count per city:');
  counts.forEach((r: { city: string; count: string }) => console.log(`  ${r.city}: ${r.count}`));

  await AppDataSource.destroy();
}
main().catch(e => { console.error(e); process.exit(1); });
