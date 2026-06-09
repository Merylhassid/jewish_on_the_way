import AppDataSource from '../src/data-source';

async function fix() {
  await AppDataSource.initialize();
  console.log('DB connected.\n');

  // First: check what these destination names actually are in the DB
  const destCheck = await AppDataSource.query(`
    SELECT id, name FROM destinations
    WHERE id IN (357,303,390,329,359,366,283,343,290,378,451,309,362)
    ORDER BY name
  `);
  console.log('Destination names in DB:');
  destCheck.forEach((d: { id: number; name: string }) =>
    console.log(`  ${d.id} | ${d.name}`),
  );
  console.log();

  // Check which Hebrew city names appear in restaurant addresses
  const hebrewCities: Array<{ label: string; heCity: string; destId: number; enCity: string }> = [
    { label: 'Mevaseret Zion', heCity: 'מבשרת ציון', destId: 378, enCity: 'Mevasseret Zion' },
    { label: 'Herzliya', heCity: 'הרצליה', destId: 359, enCity: 'Herzliya' },
    { label: 'Ra\'anana', heCity: 'רעננה', destId: 309, enCity: "Ra'anana" },
    { label: 'Hod HaSharon', heCity: 'הוד השרון', destId: 366, enCity: 'Hod HaSharon' },
    { label: 'Ramat HaSharon', heCity: 'רמת השרון', destId: 362, enCity: 'Ramat HaSharon' },
    { label: 'Ma\'ale Adumim', heCity: 'מעלה אדומים', destId: 343, enCity: "Ma'ale Adumim" },
    { label: 'Ariel', heCity: 'אריאל', destId: 357, enCity: 'Ariel' },
    { label: 'Gan Yavne', heCity: 'גן יבנה', destId: 329, enCity: 'Gan Yavne' },
    { label: 'Binyamina', heCity: 'בנימינה', destId: 390, enCity: 'Binyamina' },
    { label: "Be'er Yaakov", heCity: 'באר יעקב', destId: 303, enCity: "Be'er Yaakov" },
    { label: 'Mazkeret Batya', heCity: 'מזכרת בתיה', destId: 290, enCity: 'Mazkeret Batya' },
    { label: 'Pardes Hanna', heCity: 'פרדס חנה', destId: 451, enCity: 'Pardes Hanna' },
  ];

  for (const f of hebrewCities) {
    const count = await AppDataSource.query(
      `SELECT COUNT(*) FROM restaurants WHERE address LIKE $1`,
      [`%${f.heCity}%`],
    );
    const n = parseInt(count[0].count, 10);
    if (n > 0) {
      const result = await AppDataSource.query(
        `UPDATE restaurants SET city = $1, "destinationId" = $2 WHERE address LIKE $3`,
        [f.enCity, f.destId, `%${f.heCity}%`],
      );
      console.log(`  ✓ ${f.label}: ${result[1] ?? 0} rows updated`);
    } else {
      console.log(`  – ${f.label}: not found in any address`);
    }
  }

  await AppDataSource.destroy();
  console.log('\nDone.');
}

fix().catch((e) => {
  console.error(e);
  process.exit(1);
});
