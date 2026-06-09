require('dotenv').config({path: require('path').join(__dirname, '../.env')});
const {Client} = require('pg');
const c = new Client({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
  user: process.env.DB_USER, password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? {rejectUnauthorized: false} : undefined
});

const MERGE = [
  {from:488,to:null,name:'Haifa Bay'},
  {from:283,to:null,name:'Israel (generic)'},
  {from:486,to:397,name:'Achziv'},
  {from:500,to:309,name:'Alfe Menashe'},
  {from:493,to:321,name:'Avshalom'},
  {from:518,to:321,name:'Bahad City'},
  {from:487,to:289,name:'Ben Gurion Airport'},
  {from:514,to:358,name:'Bitan Aharon'},
  {from:515,to:358,name:'Bnei Dror'},
  {from:523,to:321,name:'Ein Gedi'},
  {from:542,to:399,name:'Ein Hatzeva'},
  {from:534,to:399,name:'Ein Yahav'},
  {from:501,to:374,name:'Eshta ol'},
  {from:530,to:397,name:'Evron'},
  {from:504,to:346,name:'Ganei Tikva'},
  {from:509,to:310,name:'Givat Katz'},
  {from:485,to:321,name:'Havat Rom'},
  {from:516,to:379,name:'Kfar Daniel'},
  {from:525,to:331,name:'Kfar Etzion'},
  {from:489,to:430,name:'Kfar Gideon'},
  {from:544,to:358,name:'Kfar Yona'},
  {from:507,to:421,name:'Kineret'},
  {from:524,to:395,name:'Kiryat Yam'},
  {from:538,to:331,name:'Kiryat Yearim'},
  {from:502,to:321,name:'Ma ona'},
  {from:492,to:529,name:'Meiron'},
  {from:491,to:385,name:'Misgav'},
  {from:531,to:533,name:'Mrom Golan'},
  {from:498,to:382,name:'Nir David'},
  {from:503,to:331,name:'Nokdim'},
  {from:513,to:434,name:'Or Akiva'},
  {from:540,to:406,name:'Ramat HaNadiv'},
  {from:532,to:454,name:'Regba'},
  {from:508,to:397,name:'Rosh HaNikra'},
  {from:497,to:382,name:'Rotem'},
  {from:543,to:311,name:'Ruppin'},
  {from:521,to:439,name:'Sde Eliezer'},
  {from:539,to:430,name:'Sde Ilan'},
  {from:537,to:395,name:'Sede Yaakov'},
  {from:520,to:331,name:'Shoeva'},
  {from:541,to:529,name:'Skhanya'},
  {from:522,to:331,name:'Tekoa'},
  {from:490,to:395,name:'Tivon'},
  {from:510,to:397,name:'Western Galilee'},
  {from:519,to:359,name:'Yakum'},
  {from:511,to:439,name:'Yesud HaMaala'},
  {from:505,to:409,name:'Yokneam Illit'},
  {from:528,to:395,name:'Atlit'},
  {from:496,to:395,name:'HaZoreim'},
  {from:517,to:395,name:'Kiryat Tivon'},
  {from:499,to:430,name:'Nof HaGalil'},
  {from:527,to:529,name:'Ramat Dalton'},
  {from:535,to:374,name:'Tzur Hadassah'},
  {from:512,to:421,name:'Kfar Tavor'},
  {from:526,to:395,name:'Ramat Yishai'},
];

c.connect().then(async function() {
  let movedTotal = 0, deletedDests = 0;
  for (let i = 0; i < MERGE.length; i++) {
    const m = MERGE[i];
    if (m.to) {
      const res = await c.query('UPDATE restaurants SET "destinationId"=$1 WHERE "destinationId"=$2 RETURNING id', [m.to, m.from]);
      if (res.rowCount > 0) console.log('  ' + m.name + ' (' + res.rowCount + ') -> dest ' + m.to);
      movedTotal += res.rowCount;
    }
    // Clear parent_id references before deleting
    await c.query('UPDATE destinations SET parent_id=NULL WHERE parent_id=$1', [m.from]);
    await c.query('DELETE FROM destinations WHERE id=$1', [m.from]);
    deletedDests++;
  }
  console.log('\nDeleted ' + deletedDests + ' destinations, moved ' + movedTotal + ' restaurants');
  const total = await c.query("SELECT COUNT(*) FROM destinations WHERE country_code='IL'");
  console.log('Israel destinations remaining: ' + total.rows[0].count);
  await c.end();
}).catch(function(e) { console.error(e.message); process.exit(1); });
