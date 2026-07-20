const fs = require('fs');
const path = require('path');

let seed = 209089911;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}
function pick(items) {
  return items[Math.floor(rand() * items.length)];
}
function pad(n) {
  return String(n).padStart(4, '0');
}

const destinations = [
  ['מיאמי', 'Miami'], ['לונדון', 'London'], ['פריז', 'Paris'], ['ירושלים', 'Jerusalem'],
  ['תל אביב', 'Tel Aviv'], ['עפולה', 'Afula'], ['פתח תקווה', 'Petah Tikva'],
  ['ראשון לציון', 'Rishon LeZion'], ['בית שמש', 'Beit Shemesh'], ['קריית גת', 'Kiryat Gat'],
  ['בני ברק', 'Bnei Brak'], ['נתניה', 'Netanya'], ['חיפה', 'Haifa'], ['אילת', 'Eilat'],
  ['טבריה', 'Tiberias'], ['רומא', 'Rome'], ['מילאנו', 'Milan'], ['מדריד', 'Madrid'],
  ['ברצלונה', 'Barcelona'], ['ליסבון', 'Lisbon'], ['אתונה', 'Athens'], ['ברלין', 'Berlin'],
  ['וינה', 'Vienna'], ['פראג', 'Prague'], ['בודפשט', 'Budapest'], ['דובאי', 'Dubai'],
  ['בנגקוק', 'Bangkok'], ['פוקט', 'Phuket'], ['קוסמוי', 'Koh Samui'], ['טוקיו', 'Tokyo'],
  ['ניו יורק', 'New York'], ['לוס אנג׳לס', 'Los Angeles'], ['טורונטו', 'Toronto'],
  ['מונטריאול', 'Montreal'], ['אמסטרדם', 'Amsterdam'], ['אנטוורפן', 'Antwerp'],
  ['ציריך', 'Zurich'], ['ז׳נבה', 'Geneva'], ['מרקש', 'Marrakech'], ['קזבלנקה', 'Casablanca'],
  ['לימסול', 'Limassol'], ['פאפוס', 'Paphos'], ['לרנקה', 'Larnaca'], ['פורטו', 'Porto'],
  ['קאן', 'Cannes'], ['ניס', 'Nice'], ['בואנוס איירס', 'Buenos Aires'],
];

const fakeDestinations = ['אי ירח', 'גן עדן', 'Atlantis City', 'עיר שלא קיימת', 'Moon Base', 'Nowhere Land'];

const foods = [
  { dish: 'pizza', type: 'dairy', he: ['פיצה', 'פיצריה', 'פיצ', 'פיצנ'], en: ['pizza', 'piza', 'pizzeria'] },
  { dish: 'burger', type: 'meat', he: ['המבורגר', 'המבורג', 'המבןרגר', 'בורגר'], en: ['burger', 'hamburger', 'hambuger'] },
  { dish: 'shawarma', type: 'meat', he: ['שווארמה', 'שוארמה', 'שוורמה'], en: ['shawarma', 'shwarma'] },
  { dish: 'sushi', type: 'pareve', he: ['סושי', 'סוש', 'סושיי'], en: ['sushi', 'sushii'] },
  { dish: 'hummus', type: 'pareve', he: ['חומוס', 'חומו', 'חמס'], en: ['hummus', 'humus'] },
  { dish: 'falafel', type: 'pareve', he: ['פלאפל', 'פלפל'], en: ['falafel', 'falafel place'] },
  { dish: 'pasta', type: 'dairy', he: ['פסטה', 'פסתה'], en: ['pasta'] },
  { dish: 'cafe', type: 'dairy', he: ['קפה', 'בית קפה', 'קפא'], en: ['coffee', 'cafe'] },
  { dish: 'ice-cream', type: 'dairy', he: ['גלידה', 'גליד'], en: ['ice cream', 'gelato'] },
  { dish: 'steak', type: 'meat', he: ['סטייק', 'בשר', 'בשרי'], en: ['steak', 'meat restaurant'] },
  { dish: 'bakery', type: 'dairy', he: ['מאפייה', 'מאפיה', 'בורקס'], en: ['bakery', 'bagel'] },
  { dish: 'fish', type: 'pareve', he: ['דגים', 'פיש'], en: ['fish'] },
];

const synagogueTerms = [
  ['בית כנסת', 'synagogue'], ['בית כנס', 'synagoge'], ['בית גנסת', 'shul'],
  ['בית חבד', 'chabad house'], ['בית כנסת חבד', 'chabad synagogue'],
  ['בית כנסת ספרדי', 'sfarad synagogue'], ['בית כנסת אשכנזי', 'ashkenaz synagogue'],
  ['בית כנסת תימני', 'teimani synagogue'],
];

const minyanTerms = [
  ['מניין', 'minyan'], ['מנין', 'minyn'], ['מניין שחרית', 'shacharit minyan'],
  ['מנחה', 'mincha'], ['ערבית', 'maariv'], ['תפילה עכשיו', 'pray near me'],
  ['מניין ספרדי', 'sfarad minyan'], ['מניין אשכנז', 'ashkenaz minyan'],
];

const hostingTerms = [
  ['להתארח', 'hosting'], ['איפה להתארח', 'where to stay for shabbat'],
  ['אירוח שבת', 'shabbat hosting'], ['משפחה מארחת', 'host family'],
  ['ארוחת שבת', 'shabbat meal'], ['לינה לשבת', 'shabbat stay'],
  ['מחפש סעודה', 'looking for meal'], ['להתארח אצל משפחה', 'stay with family'],
];

const restaurantTemplates = [
  ({ term, dest }) => `${term} ב${dest[0]}`,
  ({ term, dest }) => `מחפש ${term} כשר ב${dest[0]}`,
  ({ term, dest }) => `איפה אפשר לאכול ${term} ב${dest[0]}?`,
  ({ term, dest }) => `${term} מהדרין ב${dest[0]}`,
  ({ term, dest }) => `kosher ${term} in ${dest[1]}`,
  ({ term, dest }) => `looking for ${term} near me in ${dest[1]}`,
  ({ term, dest }) => `אני בתל אביב אבל רוצה ${term} ב${dest[0]}`,
  ({ term, dest }) => `אני נמצא בישראל ורוצה ${term} ב${dest[0]}`,
  ({ term }) => `${term} לידי`,
  ({ term }) => `${term} קרוב אלי`,
  ({ term }) => `איפה יש ${term} באזור שלי`,
  ({ term }) => `find kosher ${term} near me`,
];

const synagogueTemplates = [
  ({ term, dest }) => `${term[0]} ב${dest[0]}`,
  ({ term, dest }) => `מחפש ${term[0]} קרוב למלון ב${dest[0]}`,
  ({ term, dest }) => `${term[0]} עם מניין ב${dest[0]}`,
  ({ term, dest }) => `${term[1]} in ${dest[1]}`,
  ({ term, dest }) => `nearest ${term[1]} in ${dest[1]}`,
  ({ term }) => `${term[0]} לידי`,
  ({ term }) => `${term[0]} קרוב אלי`,
  ({ term }) => `find ${term[1]} near me`,
];

const minyanTemplates = [
  ({ term, dest }) => `${term[0]} ב${dest[0]}`,
  ({ term, dest }) => `${term[0]} היום ב${dest[0]}`,
  ({ term, dest }) => `${term[0]} קרוב למלון ב${dest[0]}`,
  ({ term, dest }) => `${term[1]} in ${dest[1]}`,
  ({ term, dest }) => `where is ${term[1]} tonight in ${dest[1]}`,
  ({ term }) => `${term[0]} לידי`,
  ({ term }) => `${term[0]} עכשיו באזור שלי`,
  ({ term }) => `${term[1]} near me`,
];

const hostingTemplates = [
  ({ term, dest }) => `${term[0]} ב${dest[0]}`,
  ({ term, dest }) => `${term[0]} לשבת ב${dest[0]}`,
  ({ term, dest }) => `מחפש ${term[0]} אצל משפחה ב${dest[0]}`,
  ({ term, dest }) => `${term[1]} in ${dest[1]}`,
  ({ term, dest }) => `need ${term[1]} in ${dest[1]}`,
  ({ term }) => `${term[0]} לידי`,
  ({ term }) => `איפה אפשר ${term[0]} באזור שלי`,
  ({ term }) => `${term[1]} near me`,
];

const destinationTemplates = [
  (dest) => `מה יש לעשות ב${dest[0]}`,
  (dest) => `יעד ${dest[0]}`,
  (dest) => `מידע על ${dest[0]}`,
  (dest) => `Jewish info in ${dest[1]}`,
  (dest) => `kosher options around ${dest[1]}`,
];

const ambiguousTemplates = [
  (dest) => `בית כנסת או מסעדה ב${dest[0]}`,
  (dest) => `מסעדה בית כנסת מניין ב${dest[0]}`,
  (dest) => `להתארח או לאכול ב${dest[0]}`,
  () => 'סתם בדיקה בלי משמעות',
  () => 'איפה הכי יפה בעולם',
  () => 'abc xyz qqq',
  () => 'אני רוצה משהו יהודי',
];

const impossibleTemplates = [
  (dest) => `פיצה ב${dest}`,
  (dest) => `בית כנסת ב${dest}`,
  (dest) => `מניין ב${dest}`,
  (dest) => `להתארח ב${dest}`,
  (dest) => `kosher burger in ${dest}`,
];

const cases = [];
const seenQueries = new Set();
function add(category, query, expected, notes = []) {
  if (seenQueries.has(query)) return false;
  seenQueries.add(query);
  cases.push({
    id: `sq${pad(cases.length + 1)}`,
    query,
    expectedCategory: category,
    expectedBehavior: expected,
    notes,
  });
  return true;
}

while (cases.filter((c) => c.expectedCategory === 'restaurant').length < 400) {
  const food = pick(foods);
  const term = rand() < 0.62 ? pick(food.he) : pick(food.en);
  add('restaurant', pick(restaurantTemplates)({ term, dest: pick(destinations) }), 'should_route_and_try_results', [food.dish, food.type]);
}

while (cases.filter((c) => c.expectedCategory === 'synagogue').length < 220) {
  add('synagogue', pick(synagogueTemplates)({ term: pick(synagogueTerms), dest: pick(destinations) }), 'should_route_and_try_results');
}

while (cases.filter((c) => c.expectedCategory === 'minyan').length < 160) {
  add('minyan', pick(minyanTemplates)({ term: pick(minyanTerms), dest: pick(destinations) }), 'should_route_and_try_results');
}

while (cases.filter((c) => c.expectedCategory === 'hosting').length < 120) {
  add('hosting', pick(hostingTemplates)({ term: pick(hostingTerms), dest: pick(destinations) }), 'should_route_and_try_results');
}

while (cases.filter((c) => c.expectedCategory === 'destination').length < 50) {
  const dest = pick(destinations);
  add('destination', pick(destinationTemplates)(dest), 'destination_or_overview_ok');
}

while (cases.filter((c) => c.expectedCategory === 'unknown').length < 30) {
  add('unknown', pick(ambiguousTemplates)(pick(destinations)), 'clarification_or_safe_no_results_ok', ['ambiguous']);
}

while (cases.length < 1000) {
  const dest = pick(fakeDestinations);
  add('unknown', pick(impossibleTemplates)(dest), 'safe_no_results_ok', ['fake_destination']);
}

const jsonPath = path.join(__dirname, 'smart-search-random-1000.json');
const txtPath = path.join(__dirname, 'smart-search-random-1000.txt');

fs.writeFileSync(jsonPath, `${JSON.stringify(cases, null, 2)}\n`, 'utf8');
fs.writeFileSync(
  txtPath,
  cases.map((item) => `${item.id}\t${item.expectedCategory}\t${item.expectedBehavior}\t${item.query}`).join('\n') + '\n',
  'utf8',
);

console.log(`Wrote ${cases.length} cases`);
console.log(jsonPath);
console.log(txtPath);
