const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_4sdzL2HpDruE@ep-weathered-tree-amr8w5v7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require',
});

const hebrewNames = [
  // ── Countries ─────────────────────────────────────────────────────────────
  ['Israel',        'ישראל'],
  ['France',        'צרפת'],
  ['United States', 'ארצות הברית'],
  ['United Kingdom','אנגליה'],
  ['Germany',       'גרמניה'],
  ['Italy',         'איטליה'],
  ['Spain',         'ספרד'],
  ['Canada',        'קנדה'],
  ['Australia',     'אוסטרליה'],
  ['Argentina',     'ארגנטינה'],
  ['Brazil',        'ברזיל'],
  ['Switzerland',   'שוויץ'],
  ['Austria',       'אוסטריה'],
  ['Belgium',       'בלגיה'],
  ['Netherlands',   'הולנד'],
  ['Cyprus',        'קפריסין'],
  ['Mexico',        'מקסיקו'],
  ['South Africa',  'דרום אפריקה'],
  ['Thailand',      'תאילנד'],
  ['Greece',        'יוון'],
  ['Portugal',      'פורטוגל'],
  ['Poland',        'פולין'],
  ['Hungary',       'הונגריה'],
  ['Czech Republic','צ׳כיה'],
  ['Romania',       'רומניה'],
  ['Morocco',       'מרוקו'],
  ['Turkey',        'טורקיה'],
  ['UAE',           'איחוד האמירויות'],
  ['Dubai',         'דובאי'],
  // ── Israeli cities ────────────────────────────────────────────────────────
  ['Jerusalem',       'ירושלים'],
  ['Tel Aviv',        'תל אביב'],
  ['Haifa',           'חיפה'],
  ['Be\'er Sheva',    'באר שבע'],
  ['Rishon LeZion',   'ראשון לציון'],
  ['Petah Tikva',     'פתח תקווה'],
  ['Ashdod',          'אשדוד'],
  ['Netanya',         'נתניה'],
  ['Holon',           'הולון'],
  ['Bnei Brak',       'בני ברק'],
  ['Ramat Gan',       'רמת גן'],
  ['Rehovot',         'רחובות'],
  ['Bat Yam',         'בת ים'],
  ['Herzliya',        'הרצליה'],
  ['Kfar Saba',       'כפר סבא'],
  ['Ra\'anana',       'רעננה'],
  ['Lod',             'לוד'],
  ['Ramla',           'רמלה'],
  ['Modi\'in',        'מודיעין'],
  ['Ashkelon',        'אשקלון'],
  ['Beit Shemesh',    'בית שמש'],
  ['Hadera',          'חדרה'],
  ['Nahariya',        'נהריה'],
  ['Tiberias',        'טבריה'],
  ['Netivot',         'נתיבות'],
  ['Kiryat Gat',      'קרית גת'],
  ['Rosh HaAyin',     'ראש העין'],
  ['Yavne',           'יבנה'],
  ['Afula',           'עפולה'],
  ['Akko',            'עכו'],
  ['Beit Shean',      'בית שאן'],
  ['Dimona',          'דימונה'],
  ['Eilat',           'אילת'],
  ['Tzfat',           'צפת'],
  ['Or Yehuda',       'אור יהודה'],
  ['Sderot',          'שדרות'],
  ['Ma\'ale Adumim',  'מעלה אדומים'],
  ['Hod HaSharon',    'הוד השרון'],
  ['Gedera',          'גדרה'],
  ['Megiddo',         'מגדל העמק'],
  ['Givat Shmuel',    'גבעת שמואל'],
  ['Nes Ziona',       'נס ציונה'],
  ['Ramat HaSharon',  'רמת השרון'],
  ['Kiryat Shmona',   'קרית שמונה'],
  ['Gan Yavne',       'גן יבנה'],
  ['Kiryat Motzkin',  'קריית מוצקין'],
  ['Kiryat Ono',      'קריית אונו'],
  ['Pardes Hanna',    'פרדס חנה כרכור'],
  ['Givatayim',       'גבעתיים'],
  ['Yokneam',         'יקנעם'],
  ['Kiryat Bialik',   'קרית ביאליק'],
  ['Mevasseret Zion', 'מבשרת ציון'],
  ['Yehud',           'יהוד'],
  ['Zichron Yaakov',  'זכרון יעקב'],
  ['Mazkeret Batya',  'מזכרת בתיה'],
  ['Shoham',          'שוהם'],
  ['Rosh Pinna',      'ראש פינה'],
  ['Savyon',          'סביון'],
  ['Caesarea',        'קיסריה'],
  ['Kiryat Ata',      'קרית אתא'],
  ['Ariel',           'אריאל'],
  ['Be\'er Yaakov',   'באר יעקב'],
  ['Nesher',          'נשר'],
  ['Ma\'alot',        'מעלות'],
  ['Ofakim',          'אופקים'],
  ['Katzrin',         'קצרין'],
  ['Tel Mond',        'תל מונד'],
];

async function run() {
  await client.connect();
  await client.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS name_he VARCHAR(128) NULL`);
  console.log('Column added');

  let updated = 0;
  for (const [englishName, hebrewName] of hebrewNames) {
    const r = await client.query(
      `UPDATE destinations SET name_he = $1 WHERE name ILIKE $2`,
      [hebrewName, englishName]
    );
    if (r.rowCount > 0) updated += r.rowCount;
  }
  console.log(`Updated ${updated} destinations with Hebrew names`);
  await client.end();
}

run().catch(e => { console.error(e.message); client.end(); process.exit(1); });
