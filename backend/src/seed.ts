/**
 * Seed script — populates destinations + kosher restaurants
 *
 * Usage:
 *   npm run seed                         # seed data only
 *   npm run seed -- admin you@email.com  # also set a user as admin
 */
import 'reflect-metadata';
import { config } from 'dotenv';
config({ path: __dirname + '/../.env' });

import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Destination } from './destination.entity';
import { Restaurant } from './restaurant.entity';
import { User } from './users/user.entity';
import { Minyan } from './minyan.entity';
import { MinyanRegistration } from './minyan-registration.entity';
import { Synagogue } from './synagogue.entity';
import { HostingOffer } from './hosting/entities/hosting-offer.entity';
import { HostingRequest } from './hosting/entities/hosting-request.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [Destination, Restaurant, User, Minyan, MinyanRegistration, Synagogue, HostingOffer, HostingRequest],
  synchronize: true,
  logging: false,
});

// ─── Seed data ────────────────────────────────────────────────────────────────

// Israel parent destination (country level — no restaurants, cities are children)
const ISRAEL_PARENT = {
  name: 'Israel',
  city: 'Israel',
  country: 'Israel',
  countryCode: 'IL',
  description: 'The Jewish homeland — a country with vibrant cities, holy sites, kosher food on every corner, and the largest Jewish community in the world.',
  lat: 31.0461,
  lng: 34.8516,
};

// All Israeli cities — restaurants are populated via Google Places API (no hardcoded restaurants)
const ISRAEL_CITIES = [
  { name: 'Tel Aviv',        city: 'Tel Aviv',        lat: 32.0853, lng: 34.7818, description: 'The White City — Israel\'s vibrant cultural capital on the Mediterranean.' },
  { name: 'Jerusalem',       city: 'Jerusalem',       lat: 31.7683, lng: 35.2137, description: 'The eternal capital of Israel and the Jewish people — a city of history, faith, and vibrant Jewish life.' },
  { name: 'Haifa',           city: 'Haifa',           lat: 32.7940, lng: 34.9896, description: 'Israel\'s northern port city on the slopes of Mount Carmel, known for coexistence and stunning views.' },
  { name: 'Bnei Brak',       city: 'Bnei Brak',       lat: 32.0841, lng: 34.8337, description: 'One of Israel\'s most religious cities, home to a large ultra-Orthodox community with exceptional mehadrin dining.' },
  { name: 'Netanya',         city: 'Netanya',         lat: 32.3226, lng: 34.8532, description: 'A coastal city on the Sharon plain known for its French-speaking Jewish community and beautiful beaches.' },
  { name: 'Beer Sheva',      city: 'Beer Sheva',      lat: 31.2518, lng: 34.7913, description: 'The capital of the Negev desert, a growing student city with a rich Bedouin market tradition.' },
  { name: 'Eilat',           city: 'Eilat',           lat: 29.5578, lng: 34.9519, description: 'Israel\'s southernmost city on the Red Sea — a year-round resort destination with diving and luxury hotels.' },
  { name: 'Ramat Gan',       city: 'Ramat Gan',       lat: 32.0700, lng: 34.8242, description: 'A prosperous city in the Tel Aviv metropolitan area, home to the Diamond Exchange and the Safari park.' },
  { name: 'Herzliya',        city: 'Herzliya',        lat: 32.1663, lng: 34.8438, description: 'A prestigious coastal city north of Tel Aviv, known for its high-tech industry and marina.' },
  { name: 'Petah Tikva',     city: 'Petah Tikva',     lat: 32.0871, lng: 34.8878, description: 'One of Israel\'s oldest cities, known as the "Mother of Moshavot", with a large and active Jewish community.' },
  { name: 'Rishon LeZion',   city: 'Rishon LeZion',   lat: 31.9642, lng: 34.8007, description: 'One of the founding cities of modern Israel, with a rich wine heritage and a large Sephardic community.' },
  { name: 'Rehovot',         city: 'Rehovot',         lat: 31.8969, lng: 34.8078, description: 'A science and agriculture city in the center of Israel, home to the Weizmann Institute of Science.' },
  { name: 'Modi\'in',        city: 'Modi\'in',        lat: 31.8969, lng: 35.0103, description: 'A modern planned city between Tel Aviv and Jerusalem, popular with young religious-Zionist families.' },
  { name: 'Beit Shemesh',    city: 'Beit Shemesh',    lat: 31.7458, lng: 34.9879, description: 'A growing city in the Judean foothills, popular with English-speaking Orthodox immigrants.' },
  { name: 'Tzfat',           city: 'Tzfat',           lat: 32.9646, lng: 35.4958, description: 'The mystical Kabbalistic city in the Galilee mountains — one of Judaism\'s four holy cities.' },
  { name: 'Tiberias',        city: 'Tiberias',        lat: 32.7940, lng: 35.5300, description: 'A holy city on the Sea of Galilee, burial place of the Rambam and great Talmudic sages.' },
  { name: 'Nahariya',        city: 'Nahariya',        lat: 33.0075, lng: 35.0939, description: 'A charming coastal city in the Western Galilee, Israel\'s northernmost Mediterranean city.' },
  { name: 'Akko',            city: 'Akko',            lat: 32.9244, lng: 35.0683, description: 'An ancient port city with a UNESCO World Heritage Old City, rich in Jewish and Crusader history.' },
  { name: 'Ashdod',          city: 'Ashdod',          lat: 31.8040, lng: 34.6550, description: 'Israel\'s largest port city, one of the main immigrant absorption centers with a large Russian-speaking Jewish community.' },
  { name: 'Ashkelon',        city: 'Ashkelon',        lat: 31.6688, lng: 34.5740, description: 'A coastal city in the southern coastal plain with ancient history and a large Sephardic community.' },
  { name: 'Ra\'anana',       city: 'Ra\'anana',       lat: 32.1849, lng: 34.8706, description: 'A green, affluent city in the Sharon region, very popular with English-speaking olim.' },
  { name: 'Kfar Saba',       city: 'Kfar Saba',       lat: 32.1764, lng: 34.9077, description: 'A leafy city in the Sharon plain adjacent to Ra\'anana, known for its green boulevards and quality of life.' },
  { name: 'Holon',           city: 'Holon',           lat: 32.0111, lng: 34.7795, description: 'An industrial and residential city south of Tel Aviv, known for the Israeli Cartoon Museum and youth culture.' },
  { name: 'Bat Yam',         city: 'Bat Yam',         lat: 32.0204, lng: 34.7516, description: 'A lively coastal city bordering Tel Aviv to the south, with long beaches and a vibrant nightlife scene.' },
  { name: 'Givatayim',       city: 'Givatayim',       lat: 32.0745, lng: 34.8136, description: 'A small but densely populated city in the heart of the Tel Aviv metropolitan area.' },
  { name: 'Lod',             city: 'Lod',             lat: 31.9514, lng: 34.8953, description: 'An ancient biblical city near Ben Gurion Airport, with a rapidly developing Jewish neighborhood.' },
  { name: 'Ramla',           city: 'Ramla',           lat: 31.9282, lng: 34.8706, description: 'An ancient city in the central coastal plain, founded in the Arab period and home to mixed communities.' },
  { name: 'Nazareth Illit',  city: 'Nazareth Illit',  lat: 32.7068, lng: 35.3322, description: 'A Jewish city in the Lower Galilee, also known as Nof HaGalil, overlooking the Jezreel Valley.' },
  { name: 'Dimona',          city: 'Dimona',          lat: 31.0687, lng: 35.0316, description: 'A desert city in the Negev, known for its large Yemenite Jewish community and unique culture.' },
  { name: 'Arad',            city: 'Arad',            lat: 31.2596, lng: 35.2122, description: 'A planned city on the edge of the Negev desert, known for its dry clean air and ancient archaeological site.' },
];

// Country → cities structure (restaurants come from Google Places API)
const COUNTRY_DESTINATIONS = [
  // ── France ────────────────────────────────────────────────────────────────
  {
    parent: { name: 'France', city: 'France', country: 'France', countryCode: 'FR', description: 'Home to the largest Jewish community in Europe (~500,000), with rich Sephardic and Ashkenazi traditions across many cities.', lat: 46.2276, lng: 2.2137 },
    cities: [
      { name: 'Paris',             city: 'Paris',             lat:  48.8566, lng:   2.3522, description: 'The City of Light — home to ~250,000 Jews, the Marais Jewish quarter, and world-class kosher restaurants.' },
      { name: 'Marseille',         city: 'Marseille',         lat:  43.2965, lng:   5.3698, description: 'France\'s second city with a large Sephardic Jewish community and vibrant North-African Jewish culture.' },
      { name: 'Lyon',              city: 'Lyon',              lat:  45.7640, lng:   4.8357, description: 'A major Jewish hub in southeast France with an active community and several kosher establishments.' },
      { name: 'Nice',              city: 'Nice',              lat:  43.7102, lng:   7.2620, description: 'A Riviera city with a sizable Jewish community and several kosher restaurants on the Côte d\'Azur.' },
      { name: 'Strasbourg',        city: 'Strasbourg',        lat:  48.5734, lng:   7.7521, description: 'An Alsatian city with deep Jewish roots and a historic synagogue dating to the 19th century.' },
      { name: 'Toulouse',          city: 'Toulouse',          lat:  43.6047, lng:   1.4442, description: 'A growing Jewish community in southwest France with active communal life and kosher options.' },
      { name: 'Bordeaux',          city: 'Bordeaux',          lat:  44.8378, lng:  -0.5792, description: 'A historic Jewish community in the wine capital of France, with a 17th-century Sephardic heritage.' },
      { name: 'Montpellier',       city: 'Montpellier',       lat:  43.6108, lng:   3.8767, description: 'A university city in southern France with one of the oldest Jewish histories in the country.' },
    ],
  },
  // ── United Kingdom ────────────────────────────────────────────────────────
  {
    parent: { name: 'United Kingdom', city: 'United Kingdom', country: 'United Kingdom', countryCode: 'GB', description: 'Home to over 280,000 Jews, one of the world\'s most established Jewish communities with deep cultural roots.', lat: 55.3781, lng: -3.4360 },
    cities: [
      { name: 'London',            city: 'London',            lat:  51.5074, lng:  -0.1278, description: 'Europe\'s largest Jewish community outside France, centered in Golders Green, Stamford Hill, and Hendon.' },
      { name: 'Manchester',        city: 'Manchester',        lat:  53.4808, lng:  -2.2426, description: 'The UK\'s second-largest Jewish community, concentrated in Prestwich and Whitefield with excellent kosher dining.' },
      { name: 'Leeds',             city: 'Leeds',             lat:  53.8008, lng:  -1.5491, description: 'A historic Jewish community in Yorkshire, known for Moortown and Chapel Allerton neighborhoods.' },
      { name: 'Gateshead',         city: 'Gateshead',         lat:  54.9627, lng:  -1.6035, description: 'Home to one of the most prestigious yeshivas in Europe and a tightly-knit Orthodox community.' },
      { name: 'Glasgow',           city: 'Glasgow',           lat:  55.8642, lng:  -4.2518, description: 'Scotland\'s main Jewish community, with roots going back to the 18th century in the Giffnock area.' },
      { name: 'Birmingham',        city: 'Birmingham',        lat:  52.4862, lng:  -1.8904, description: 'A growing Jewish community in England\'s second city, centered in Edgbaston and Solihull.' },
      { name: 'Brighton',          city: 'Brighton',          lat:  50.8225, lng:  -0.1372, description: 'A seaside city with a liberal Jewish community and several kosher-friendly establishments.' },
    ],
  },
  // ── Argentina ─────────────────────────────────────────────────────────────
  {
    parent: { name: 'Argentina', city: 'Argentina', country: 'Argentina', countryCode: 'AR', description: 'Home to the largest Jewish community in Latin America (~180,000), with deep Ashkenazi and Sephardic roots.', lat: -38.4161, lng: -63.6167 },
    cities: [
      { name: 'Buenos Aires',      city: 'Buenos Aires',      lat: -34.6037, lng: -58.3816, description: 'Latin America\'s Jewish capital — Once neighborhood, world-class kosher restaurants, and rich cultural life.' },
      { name: 'Córdoba',           city: 'Córdoba',           lat: -31.4201, lng: -64.1888, description: 'Argentina\'s second city with an active Jewish community, federation, and kosher establishments.' },
      { name: 'Rosario',           city: 'Rosario',           lat: -32.9468, lng: -60.6393, description: 'A major industrial city on the Paraná river with a historic Jewish community and communal institutions.' },
      { name: 'Mendoza',           city: 'Mendoza',           lat: -32.8895, lng: -68.8458, description: 'Argentina\'s wine capital at the foot of the Andes, with a small but active Jewish community.' },
      { name: 'Mar del Plata',     city: 'Mar del Plata',     lat: -38.0054, lng: -57.5426, description: 'A popular coastal resort city where many Buenos Aires Jewish families spend the summer.' },
    ],
  },
  // ── Canada ────────────────────────────────────────────────────────────────
  {
    parent: { name: 'Canada', city: 'Canada', country: 'Canada', countryCode: 'CA', description: 'Home to ~390,000 Jews, Canada has one of the most vibrant and welcoming Jewish communities in the world.', lat: 56.1304, lng: -106.3468 },
    cities: [
      { name: 'Toronto',           city: 'Toronto',           lat:  43.6532, lng:  -79.3832, description: 'Canada\'s largest Jewish community (~180,000), centered in North York with outstanding kosher dining.' },
      { name: 'Montreal',          city: 'Montreal',          lat:  45.5017, lng:  -73.5673, description: 'A historic Jewish community known for legendary smoked meat, bagels, and Côte-Saint-Luc neighborhood.' },
      { name: 'Vancouver',         city: 'Vancouver',         lat:  49.2827, lng: -123.1207, description: 'A growing Jewish community on Canada\'s West Coast, concentrated in Oak Ridge and Oakridge areas.' },
      { name: 'Ottawa',            city: 'Ottawa',            lat:  45.4215, lng:  -75.6972, description: 'Canada\'s capital with a well-organized Jewish community and several kosher establishments.' },
      { name: 'Winnipeg',          city: 'Winnipeg',          lat:  49.8951, lng:  -97.1384, description: 'A historic prairie Jewish community with deep roots dating to early 20th-century Eastern European immigration.' },
      { name: 'Calgary',           city: 'Calgary',           lat:  51.0447, lng: -114.0719, description: 'A rapidly growing Jewish community in Alberta, with modern synagogues and kosher options.' },
    ],
  },
  // ── Australia ─────────────────────────────────────────────────────────────
  {
    parent: { name: 'Australia', city: 'Australia', country: 'Australia', countryCode: 'AU', description: 'Home to ~120,000 Jews, with thriving communities in Melbourne and Sydney and active Chabad networks nationwide.', lat: -25.2744, lng: 133.7751 },
    cities: [
      { name: 'Melbourne',         city: 'Melbourne',         lat: -37.8136, lng:  144.9631, description: 'Australia\'s largest Jewish community, centered in St Kilda, Caulfield, and the southeast suburbs.' },
      { name: 'Sydney',            city: 'Sydney',            lat: -33.8688, lng:  151.2093, description: 'Australia\'s second Jewish hub, with communities in Bondi, Vaucluse, and the Eastern Suburbs.' },
      { name: 'Perth',             city: 'Perth',             lat: -31.9505, lng:  115.8605, description: 'A small but growing Jewish community on Australia\'s West Coast with an active Chabad presence.' },
      { name: 'Adelaide',          city: 'Adelaide',          lat: -34.9285, lng:  138.6007, description: 'A historic Jewish community in South Australia, one of the oldest in the country.' },
      { name: 'Brisbane',          city: 'Brisbane',          lat: -27.4698, lng:  153.0251, description: 'A growing Jewish community in Queensland with several synagogues and kosher establishments.' },
      { name: 'Gold Coast',        city: 'Gold Coast',        lat: -28.0167, lng:  153.4000, description: 'A popular holiday destination with a growing Jewish community and kosher-friendly tourism infrastructure.' },
    ],
  },
  // ── Germany ───────────────────────────────────────────────────────────────
  {
    parent: { name: 'Germany', city: 'Germany', country: 'Germany', countryCode: 'DE', description: 'Home to a rapidly growing Jewish community (~200,000), largely made up of immigrants from the former Soviet Union.', lat: 51.1657, lng: 10.4515 },
    cities: [
      { name: 'Berlin',            city: 'Berlin',            lat:  52.5200, lng:  13.4050, description: 'Germany\'s capital has a vibrant and growing Jewish community with kosher restaurants and synagogues.' },
      { name: 'Frankfurt',         city: 'Frankfurt',         lat:  50.1109, lng:   8.6821, description: 'A major Jewish hub with a historic community, the Westend Synagogue, and strong communal institutions.' },
      { name: 'Munich',            city: 'Munich',            lat:  48.1351, lng:  11.5820, description: 'Bavaria\'s Jewish community is centered around the Ohel Jakob Synagogue in the city center.' },
      { name: 'Hamburg',           city: 'Hamburg',           lat:  53.5753, lng:   9.9954, description: 'A historic port city with a longstanding Jewish community and active cultural life.' },
      { name: 'Düsseldorf',        city: 'Düsseldorf',        lat:  51.2217, lng:   6.7762, description: 'Home to a sizable Jewish community, including many Russian-speaking immigrants from the 1990s.' },
      { name: 'Cologne',           city: 'Cologne',           lat:  50.9333, lng:   6.9500, description: 'One of Germany\'s oldest Jewish communities, with roots dating back to the Roman era.' },
    ],
  },
  // ── Brazil ────────────────────────────────────────────────────────────────
  {
    parent: { name: 'Brazil', city: 'Brazil', country: 'Brazil', countryCode: 'BR', description: 'Home to ~100,000 Jews, Brazil has the largest Jewish community in South America outside Argentina.', lat: -14.2350, lng: -51.9253 },
    cities: [
      { name: 'São Paulo',         city: 'São Paulo',         lat: -23.5505, lng:  -46.6333, description: 'Brazil\'s Jewish capital — Higienópolis neighborhood has dozens of synagogues and kosher restaurants.' },
      { name: 'Rio de Janeiro',    city: 'Rio de Janeiro',    lat: -22.9068, lng:  -43.1729, description: 'A sizable Jewish community in one of South America\'s most iconic cities, with kosher options in Barra da Tijuca.' },
      { name: 'Porto Alegre',      city: 'Porto Alegre',      lat: -30.0346, lng:  -51.2177, description: 'A historic Jewish community in southern Brazil with strong Ashkenazi heritage.' },
      { name: 'Belo Horizonte',    city: 'Belo Horizonte',    lat: -19.9191, lng:  -43.9386, description: 'Brazil\'s third-largest city with an active Jewish community and communal organizations.' },
      { name: 'Curitiba',          city: 'Curitiba',          lat: -25.4297, lng:  -49.2711, description: 'A growing Jewish community in Paraná state with a Chabad center and several Jewish institutions.' },
    ],
  },
  // ── South Africa ──────────────────────────────────────────────────────────
  {
    parent: { name: 'South Africa', city: 'South Africa', country: 'South Africa', countryCode: 'ZA', description: 'Home to ~70,000 Jews, one of the most per-capita involved Jewish communities in the world.', lat: -30.5595, lng: 22.9375 },
    cities: [
      { name: 'Johannesburg',      city: 'Johannesburg',      lat: -26.2041, lng:   28.0473, description: 'The largest Jewish community in Africa, centered in Sandton, Glenhazel, and Houghton with extensive kosher infrastructure.' },
      { name: 'Cape Town',         city: 'Cape Town',         lat: -33.9249, lng:   18.4241, description: 'A vibrant Jewish community in the Cape, centered in Sea Point and the Atlantic Seaboard.' },
      { name: 'Durban',            city: 'Durban',            lat: -29.8587, lng:   31.0218, description: 'A smaller but active Jewish community on South Africa\'s KwaZulu-Natal coast.' },
    ],
  },
  // ── Belgium ───────────────────────────────────────────────────────────────
  {
    parent: { name: 'Belgium', city: 'Belgium', country: 'Belgium', countryCode: 'BE', description: 'Home to ~30,000 Jews, with Antwerp being one of the most significant Orthodox Jewish centers in the world.', lat: 50.5039, lng: 4.4699 },
    cities: [
      { name: 'Antwerp',           city: 'Antwerp',           lat:  51.2194, lng:   4.4025, description: 'The diamond capital of the world and home to one of Europe\'s most vibrant Orthodox Jewish communities.' },
      { name: 'Brussels',          city: 'Brussels',          lat:  50.8503, lng:   4.3517, description: 'Belgium\'s capital with a diverse Jewish community and several kosher restaurants and synagogues.' },
    ],
  },
  // ── Netherlands ───────────────────────────────────────────────────────────
  {
    parent: { name: 'Netherlands', city: 'Netherlands', country: 'Netherlands', countryCode: 'NL', description: 'Home to ~40,000 Jews, the Netherlands has a historic Jewish legacy — Amsterdam was once called the "Jerusalem of the West".', lat: 52.1326, lng: 5.2913 },
    cities: [
      { name: 'Amsterdam',         city: 'Amsterdam',         lat:  52.3676, lng:   4.9041, description: 'The "Jerusalem of the West" — the Jewish Historical Museum, Anne Frank House, and a growing kosher scene.' },
      { name: 'Rotterdam',         city: 'Rotterdam',         lat:  51.9244, lng:   4.4777, description: 'A modern port city with a smaller but active Jewish community and several communal organizations.' },
      { name: 'The Hague',         city: 'The Hague',         lat:  52.0705, lng:   4.3007, description: 'The seat of the Dutch government with a Jewish community and historical significance for international Jewish affairs.' },
    ],
  },
  // ── Italy ─────────────────────────────────────────────────────────────────
  {
    parent: { name: 'Italy', city: 'Italy', country: 'Italy', countryCode: 'IT', description: 'Home to ~28,000 Jews with one of the oldest continuous Jewish presences in the world — the Roman Jewish community dates back 2,000 years.', lat: 41.8719, lng: 12.5674 },
    cities: [
      { name: 'Rome',              city: 'Rome',              lat:  41.9028, lng:   12.4964, description: 'The oldest Jewish community in the world outside Israel — the Jewish Ghetto and Great Synagogue are iconic landmarks.' },
      { name: 'Milan',             city: 'Milan',             lat:  45.4642, lng:    9.1900, description: 'Italy\'s largest Jewish community today, with a central synagogue on Via Guastalla and kosher restaurants.' },
      { name: 'Florence',          city: 'Florence',          lat:  43.7696, lng:   11.2558, description: 'A historic Tuscan city with a beautiful synagogue and a small but tight-knit Jewish community.' },
      { name: 'Venice',            city: 'Venice',            lat:  45.4408, lng:   12.3155, description: 'Home to the world\'s first Jewish ghetto (1516) — a UNESCO site and essential stop for Jewish history.' },
      { name: 'Turin',             city: 'Turin',             lat:  45.0703, lng:    7.6869, description: 'A historic Jewish community in Piedmont with a magnificent Moorish-style synagogue.' },
    ],
  },
  // ── Switzerland ───────────────────────────────────────────────────────────
  {
    parent: { name: 'Switzerland', city: 'Switzerland', country: 'Switzerland', countryCode: 'CH', description: 'Home to ~18,000 Jews, Switzerland has a historic Jewish community and serves as a global center for Jewish organizations.', lat: 46.8182, lng: 8.2275 },
    cities: [
      { name: 'Zurich',            city: 'Zurich',            lat:  47.3769, lng:   8.5417, description: 'Switzerland\'s largest city with the country\'s most significant Jewish community and several kosher restaurants.' },
      { name: 'Geneva',            city: 'Geneva',            lat:  46.2044, lng:   6.1432, description: 'Home to many international Jewish organizations and a diverse Jewish community from across Europe.' },
      { name: 'Basel',             city: 'Basel',             lat:  47.5596, lng:   7.5886, description: 'Historic site of the First Zionist Congress (1897) — a pilgrimage city for Jewish history enthusiasts.' },
    ],
  },
  // ── Hungary ───────────────────────────────────────────────────────────────
  {
    parent: { name: 'Hungary', city: 'Hungary', country: 'Hungary', countryCode: 'HU', description: 'Home to ~50,000 Jews, Hungary has one of the largest Jewish communities in Central Europe, centered in Budapest.', lat: 47.1625, lng: 19.5033 },
    cities: [
      { name: 'Budapest',          city: 'Budapest',          lat:  47.4979, lng:   19.0402, description: 'Home to Europe\'s largest synagogue (Dohány Street) and a thriving Jewish quarter with restaurants and cultural life.' },
      { name: 'Debrecen',          city: 'Debrecen',          lat:  47.5316, lng:   21.6273, description: 'Hungary\'s second city with a historic Jewish community and a beautifully restored synagogue.' },
    ],
  },
  // ── Austria ───────────────────────────────────────────────────────────────
  {
    parent: { name: 'Austria', city: 'Austria', country: 'Austria', countryCode: 'AT', description: 'Home to ~15,000 Jews, Vienna was once the cultural capital of European Jewry before the Holocaust.', lat: 47.5162, lng: 14.5501 },
    cities: [
      { name: 'Vienna',            city: 'Vienna',            lat:  48.2082, lng:   16.3738, description: 'Once the heart of European Jewish intellectual life — the Naschmarkt area and Leopoldstadt have kosher restaurants and synagogues.' },
      { name: 'Graz',              city: 'Graz',              lat:  47.0707, lng:   15.4395, description: 'Austria\'s second city with a small but active Jewish community and a historic synagogue.' },
    ],
  },
  // ── Mexico ────────────────────────────────────────────────────────────────
  {
    parent: { name: 'Mexico', city: 'Mexico', country: 'Mexico', countryCode: 'MX', description: 'Home to ~40,000 Jews, Mexico\'s community is one of the most insular and well-organized in Latin America.', lat: 23.6345, lng: -102.5528 },
    cities: [
      { name: 'Mexico City',       city: 'Mexico City',       lat:  19.4326, lng:  -99.1332, description: 'The heart of Mexican Jewish life — Polanco and Lomas neighborhoods have dozens of kosher restaurants and synagogues.' },
      { name: 'Guadalajara',       city: 'Guadalajara',       lat:  20.6597, lng: -103.3496, description: 'Mexico\'s second city with a small but active Jewish community and communal institutions.' },
      { name: 'Monterrey',         city: 'Monterrey',         lat:  25.6866, lng: -100.3161, description: 'A growing Jewish community in northern Mexico\'s industrial capital.' },
    ],
  },
  // ── Morocco ───────────────────────────────────────────────────────────────
  {
    parent: { name: 'Morocco', city: 'Morocco', country: 'Morocco', countryCode: 'MA', description: 'Home to ~2,000 remaining Jews with a rich 2,000-year heritage — a pilgrimage destination for hundreds of thousands of Moroccan Jewish descendants worldwide.', lat: 31.7917, lng: -7.0926 },
    cities: [
      { name: 'Casablanca',        city: 'Casablanca',        lat:  33.5731, lng:  -7.5898, description: 'Morocco\'s largest city with the most significant remaining Jewish community and the Beth-El Synagogue.' },
      { name: 'Marrakech',         city: 'Marrakech',         lat:  31.6295, lng:  -7.9811, description: 'Home to the Mellah (Jewish quarter) and the historic Lazama Synagogue, a must-visit for Jewish travelers.' },
      { name: 'Fez',               city: 'Fez',               lat:  34.0181, lng:  -5.0078, description: 'The spiritual capital of Morocco with a historic Jewish quarter and the Ibn Danan Synagogue.' },
      { name: 'Meknes',            city: 'Meknes',            lat:  33.8935, lng:  -5.5547, description: 'A former imperial city with a Mellah and historic Jewish cemetery, home to the tomb of Rabbi Moshe ben Maimon\'s ancestor.' },
      { name: 'Essaouira',         city: 'Essaouira',         lat:  31.5085, lng:  -9.7595, description: 'A seaside city known for the annual Mimouna festival and the tomb of Rabbi Haim Pinto, a major pilgrimage site.' },
    ],
  },
  // ── Tunisia ───────────────────────────────────────────────────────────────
  {
    parent: { name: 'Tunisia', city: 'Tunisia', country: 'Tunisia', countryCode: 'TN', description: 'Home to ~1,500 remaining Jews, Tunisia hosts the famous El Ghriba synagogue pilgrimage on Djerba — one of the holiest Jewish sites in the world.', lat: 33.8869, lng: 9.5375 },
    cities: [
      { name: 'Djerba',            city: 'Djerba',            lat:  33.8075, lng:  10.8451, description: 'Island home to the El Ghriba synagogue — one of the oldest in the world and a major annual pilgrimage site.' },
      { name: 'Tunis',             city: 'Tunis',             lat:  36.8065, lng:  10.1815, description: 'Tunisia\'s capital with a small remaining Jewish community and the historic Hara neighborhood.' },
    ],
  },
  // ── Turkey ────────────────────────────────────────────────────────────────
  {
    parent: { name: 'Turkey', city: 'Turkey', country: 'Turkey', countryCode: 'TR', description: 'Home to ~15,000 Jews, Turkey has a significant Sephardic heritage dating to the expulsion from Spain in 1492.', lat: 38.9637, lng: 35.2433 },
    cities: [
      { name: 'Istanbul',          city: 'Istanbul',          lat:  41.0082, lng:  28.9784, description: 'Home to the vast majority of Turkish Jews — the Balat and Galata neighborhoods are historic centers of Sephardic culture.' },
      { name: 'Izmir',             city: 'Izmir',             lat:  38.4192, lng:  27.1287, description: 'A port city with a historic Sephardic Jewish community and several synagogues still in use.' },
    ],
  },
  // ── Greece ────────────────────────────────────────────────────────────────
  {
    parent: { name: 'Greece', city: 'Greece', country: 'Greece', countryCode: 'GR', description: 'Home to ~5,000 Jews, Greece has ancient Jewish communities with rich Romaniote and Sephardic traditions.', lat: 39.0742, lng: 21.8243 },
    cities: [
      { name: 'Athens',            city: 'Athens',            lat:  37.9838, lng:  23.7275, description: 'The Greek capital with an active Jewish community, the Etz Hayyim Synagogue, and the Jewish Museum of Greece.' },
      { name: 'Thessaloniki',      city: 'Thessaloniki',      lat:  40.6401, lng:  22.9444, description: 'Once known as the "Jerusalem of the Balkans" — home to a major Sephardic community before the Holocaust.' },
      { name: 'Rhodes',            city: 'Rhodes',            lat:  36.4341, lng:  28.2176, description: 'The medieval Jewish quarter (La Juderia) on this island is one of the best-preserved in the world.' },
    ],
  },
  // ── Ukraine ───────────────────────────────────────────────────────────────
  {
    parent: { name: 'Ukraine', city: 'Ukraine', country: 'Ukraine', countryCode: 'UA', description: 'Home to ~50,000 Jews with a deeply significant history — the Baal Shem Tov founded Chasidism here, and Uman draws tens of thousands for Rosh Hashana.', lat: 48.3794, lng: 31.1656 },
    cities: [
      { name: 'Kyiv',              city: 'Kyiv',              lat:  50.4501, lng:  30.5234, description: 'Ukraine\'s capital with a growing Jewish community, the Brodsky Synagogue, and several kosher restaurants.' },
      { name: 'Uman',              city: 'Uman',              lat:  48.7500, lng:  30.2167, description: 'Burial place of Rabbi Nachman of Breslov — draws 30,000+ pilgrims for Rosh Hashana annually.' },
      { name: 'Lviv',              city: 'Lviv',              lat:  49.8397, lng:  24.0297, description: 'A historic city in western Ukraine with a rich pre-war Jewish heritage and restored synagogue.' },
      { name: 'Dnipro',            city: 'Dnipro',            lat:  48.4647, lng:  35.0462, description: 'Home to one of the largest Jewish communities in Ukraine with a world-renowned Menorah Jewish center.' },
    ],
  },
  // ── Poland ────────────────────────────────────────────────────────────────
  {
    parent: { name: 'Poland', city: 'Poland', country: 'Poland', countryCode: 'PL', description: 'Once home to the world\'s largest Jewish population — an essential destination for Holocaust remembrance and Jewish heritage tourism.', lat: 51.9194, lng: 19.1451 },
    cities: [
      { name: 'Warsaw',            city: 'Warsaw',            lat:  52.2297, lng:  21.0122, description: 'Site of the Warsaw Ghetto Uprising — the POLIN Museum of Polish Jewish History is a world-class institution.' },
      { name: 'Kraków',            city: 'Kraków',            lat:  50.0647, lng:  19.9450, description: 'The Kazimierz Jewish quarter has been beautifully restored — a vibrant center of Jewish culture with restaurants and synagogues.' },
      { name: 'Łódź',              city: 'Łódź',              lat:  51.7592, lng:  19.4560, description: 'Once home to 233,000 Jews — the Łódź Ghetto was the second largest in occupied Europe.' },
      { name: 'Lublin',            city: 'Lublin',            lat:  51.2465, lng:  22.5684, description: 'The "Jerusalem of the Kingdom of Poland" — home to the famous Yeshivas Chachmei Lublin, now restored.' },
    ],
  },
  // ── Czech Republic ────────────────────────────────────────────────────────
  {
    parent: { name: 'Czech Republic', city: 'Czech Republic', country: 'Czech Republic', countryCode: 'CZ', description: 'Home to ~10,000 Jews, Prague has one of the most intact medieval Jewish quarters in the world.', lat: 49.8175, lng: 15.4730 },
    cities: [
      { name: 'Prague',            city: 'Prague',            lat:  50.0755, lng:  14.4378, description: 'The Josefov Jewish Quarter — six historic synagogues, the Old Jewish Cemetery, and the Jewish Museum make this a must-visit.' },
      { name: 'Brno',              city: 'Brno',              lat:  49.1951, lng:  16.6068, description: 'Czech Republic\'s second city with a small but active Jewish community and a historic synagogue.' },
    ],
  },
  // ── Uruguay ───────────────────────────────────────────────────────────────
  {
    parent: { name: 'Uruguay', city: 'Uruguay', country: 'Uruguay', countryCode: 'UY', description: 'Home to ~17,000 Jews, Uruguay has one of the highest concentrations of Jews per capita in South America.', lat: -32.5228, lng: -55.7658 },
    cities: [
      { name: 'Montevideo',        city: 'Montevideo',        lat: -34.9011, lng: -56.1645, description: 'Uruguay\'s capital is home to virtually all of the country\'s Jewish community, with several kosher restaurants and synagogues.' },
      { name: 'Punta del Este',    city: 'Punta del Este',    lat: -34.9717, lng: -54.9367, description: 'A glamorous beach resort frequented by Jewish families from across South America, with kosher options in season.' },
    ],
  },
  // ── Chile ─────────────────────────────────────────────────────────────────
  {
    parent: { name: 'Chile', city: 'Chile', country: 'Chile', countryCode: 'CL', description: 'Home to ~18,000 Jews, Chile has a well-established Jewish community concentrated almost entirely in Santiago.', lat: -35.6751, lng: -71.5430 },
    cities: [
      { name: 'Santiago',          city: 'Santiago',          lat: -33.4489, lng: -70.6693, description: 'Chile\'s capital and home to virtually the entire Jewish community — Las Condes neighborhood has most kosher restaurants.' },
      { name: 'Viña del Mar',      city: 'Viña del Mar',      lat: -33.0153, lng: -71.5500, description: 'A popular Pacific coast resort with a Chabad center and Jewish tourists from Santiago year-round.' },
    ],
  },
  // ── Colombia ──────────────────────────────────────────────────────────────
  {
    parent: { name: 'Colombia', city: 'Colombia', country: 'Colombia', countryCode: 'CO', description: 'Home to ~6,000 Jews, Colombia has a small but diverse Jewish community spread across several cities.', lat: 4.5709, lng: -74.2973 },
    cities: [
      { name: 'Bogotá',            city: 'Bogotá',            lat:   4.7110, lng: -74.0721, description: 'Colombia\'s capital with the largest Jewish community, centered in the Chico and Rosales neighborhoods.' },
      { name: 'Medellín',          city: 'Medellín',          lat:   6.2442, lng: -75.5812, description: 'A transformed and vibrant city with a small Sephardic Jewish community and a Chabad center.' },
      { name: 'Cali',              city: 'Cali',              lat:   3.4516, lng: -76.5320, description: 'Colombia\'s salsa capital with a small but active Jewish community and communal institutions.' },
      { name: 'Barranquilla',      city: 'Barranquilla',      lat:  10.9685, lng: -74.7813, description: 'A Caribbean port city with a historic Sephardic Jewish community and beautiful synagogue.' },
    ],
  },
];

// United States — kept as Daniel seeded it (standalone city with restaurants)
const DESTINATIONS = [
  {
    name: 'New York',
    city: 'New York',
    country: 'United States',
    countryCode: 'US',
    description: 'Home to the largest Jewish population outside Israel, with endless kosher dining options.',
    lat: 40.7128,
    lng: -74.0060,
    restaurants: [
      { name: 'Katz\'s Delicatessen', type: 'meat', kashrut: 'rabbinate', address: '205 E Houston St, Manhattan', hours: 'Mon-Wed 8:00-22:30, Thu 8:00-02:30, Fri-Sun 24h', lat: 40.7223, lng: -73.9874 },
      { name: 'Taam Tov',             type: 'meat', kashrut: 'mehadrin',  address: '41 W 47th St, Manhattan',     hours: 'Sun-Thu 11:00-20:00, Fri 11:00-13:00',           lat: 40.7579, lng: -73.9812 },
      { name: 'Prime Grill',          type: 'meat', kashrut: 'mehadrin',  address: '60 E 49th St, Manhattan',     hours: 'Sun-Thu 12:00-22:00, Fri 12:00-14:00',           lat: 40.7563, lng: -73.9754 },
      { name: 'Pardes',               type: 'meat', kashrut: 'mehadrin',  address: '15 Lafayette Ave, Brooklyn',  hours: 'Sun-Thu 17:30-22:00',                            lat: 40.6868, lng: -73.9774 },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

// Build future dates relative to today
function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

async function main() {
  await AppDataSource.initialize();
  console.log('✅  Connected to DB');

  const destRepo    = AppDataSource.getRepository(Destination);
  const restRepo    = AppDataSource.getRepository(Restaurant);
  const userRepo    = AppDataSource.getRepository(User);
  const minyanRepo  = AppDataSource.getRepository(Minyan);

  // ── Optional: set a user as admin ──
  const args = process.argv.slice(2);
  if (args[0] === 'admin' && args[1]) {
    const email = args[1].toLowerCase();
    const user = await userRepo.findOne({ where: { email } });
    if (!user) {
      console.error(`❌  No user found with email: ${email}`);
    } else {
      user.role = 'admin';
      await userRepo.save(user);
      console.log(`✅  ${email} is now an admin`);
    }
  }

  // ── Seed Israel parent + all Israeli cities ──
  let newDest = 0;
  let newRest = 0;

  let israelDest = await destRepo.findOne({ where: { city: 'Israel', country: 'Israel' } });
  if (!israelDest) {
    israelDest = destRepo.create({
      name: ISRAEL_PARENT.name,
      city: ISRAEL_PARENT.city,
      country: ISRAEL_PARENT.country,
      countryCode: ISRAEL_PARENT.countryCode,
      description: ISRAEL_PARENT.description,
      location: { type: 'Point', coordinates: [ISRAEL_PARENT.lng, ISRAEL_PARENT.lat] },
    });
    israelDest = await destRepo.save(israelDest);
    console.log(`  ➕  Country: Israel`);
    newDest++;
  } else {
    console.log(`  ⏭️   Country already exists: Israel`);
  }

  for (const city of ISRAEL_CITIES) {
    let cityDest = await destRepo.findOne({ where: { city: city.city, country: 'Israel' } });
    if (!cityDest) {
      cityDest = destRepo.create({
        name: city.name,
        city: city.city,
        country: 'Israel',
        countryCode: 'IL',
        description: city.description,
        location: { type: 'Point', coordinates: [city.lng, city.lat] },
        parent: israelDest,
      });
      await destRepo.save(cityDest);
      console.log(`    ➕  City: ${city.city}`);
      newDest++;
    } else {
      // Ensure parent is set (in case city was seeded before without parent)
      if (!cityDest.parentId) {
        cityDest.parent = israelDest;
        await destRepo.save(cityDest);
        console.log(`    🔗  Linked to Israel: ${city.city}`);
      } else {
        console.log(`    ⏭️   City already exists: ${city.city}`);
      }
    }
  }

  // ── Seed France, UK, Argentina, Canada (country parent + cities) ──
  for (const country of COUNTRY_DESTINATIONS) {
    const p = country.parent;
    let countryDest = await destRepo.findOne({ where: { city: p.city, country: p.country } });
    if (!countryDest) {
      countryDest = destRepo.create({
        name: p.name, city: p.city, country: p.country, countryCode: p.countryCode,
        description: p.description,
        location: { type: 'Point', coordinates: [p.lng, p.lat] },
      });
      countryDest = await destRepo.save(countryDest);
      console.log(`  ➕  Country: ${p.name}`);
      newDest++;
    } else {
      console.log(`  ⏭️   Country already exists: ${p.name}`);
    }

    for (const city of country.cities) {
      let cityDest = await destRepo.findOne({ where: { city: city.city, country: p.country } });
      if (!cityDest) {
        cityDest = destRepo.create({
          name: city.name, city: city.city, country: p.country, countryCode: p.countryCode,
          description: city.description,
          location: { type: 'Point', coordinates: [city.lng, city.lat] },
          parent: countryDest,
        });
        await destRepo.save(cityDest);
        console.log(`    ➕  City: ${city.city}`);
        newDest++;
      } else {
        if (!cityDest.parentId) {
          cityDest.parent = countryDest;
          await destRepo.save(cityDest);
          console.log(`    🔗  Linked to ${p.name}: ${city.city}`);
        } else {
          console.log(`    ⏭️   City already exists: ${city.city}`);
        }
      }
    }
  }

  // ── Seed United States + restaurants ──
  for (const data of DESTINATIONS) {
    let dest = await destRepo.findOne({ where: { city: data.city, country: data.country } });

    if (!dest) {
      dest = destRepo.create({
        name: data.name,
        city: data.city,
        country: data.country,
        countryCode: data.countryCode,
        description: data.description,
        location: { type: 'Point', coordinates: [data.lng, data.lat] },
      });
      dest = await destRepo.save(dest);
      console.log(`  ➕  Destination: ${data.city}`);
      newDest++;
    } else {
      console.log(`  ⏭️   Destination already exists: ${data.city}`);
    }

    for (const r of data.restaurants) {
      const exists = await restRepo.findOne({ where: { name: r.name, destination: { id: dest.id } } });
      const coords = { type: 'Point', coordinates: [r.lng ?? data.lng, r.lat ?? data.lat] };
      if (!exists) {
        const rest = restRepo.create({
          name: r.name,
          restaurantType: r.type,
          kashrutLevel: r.kashrut,
          address: r.address,
          openingHours: r.hours,
          location: coords,
          destination: dest,
        });
        await restRepo.save(rest);
        console.log(`      ➕  Restaurant: ${r.name}`);
        newRest++;
      } else {
        // Update coordinates so distance calculation works correctly
        exists.location = coords as any;
        await restRepo.save(exists);
        console.log(`      🔄  Updated coords: ${r.name}`);
      }
    }
  }

  // ── Seed sample minyans (first 3 destinations only) ──
  const MINYAN_SAMPLES = [
    { prayerType: 'shacharit', dayOffset: 1, time: '08:00', locationText: 'Main synagogue, ground floor' },
    { prayerType: 'mincha',    dayOffset: 1, time: '18:30', locationText: 'Hotel lobby minyan' },
    { prayerType: 'maariv',    dayOffset: 2, time: '20:00', locationText: 'Chabad house' },
    { prayerType: 'shacharit', dayOffset: 3, time: '07:30', locationText: 'Community centre, room 2', notes: 'Nusach Ashkenaz' },
    { prayerType: 'musaf',     dayOffset: 5, time: '09:30', locationText: 'Great Synagogue', notes: 'Shabbat minyan — Nusach Sfarad' },
  ];

  let newMinyan = 0;
  const destNames = ['Tel Aviv', 'Paris', 'New York'];
  for (const cityName of destNames) {
    const dest = await destRepo.findOne({ where: { city: cityName } });
    if (!dest) continue;
    for (const m of MINYAN_SAMPLES) {
      const date = futureDate(m.dayOffset);
      const exists = await minyanRepo.findOne({
        where: { prayerType: m.prayerType, date, destination: { id: dest.id } },
      });
      if (!exists) {
        const minyan = minyanRepo.create({
          prayerType: m.prayerType,
          date,
          time: m.time,
          locationText: m.locationText,
          notes: m.notes,
          participantsCount: 1,
          destination: dest,
        });
        await minyanRepo.save(minyan);
        console.log(`      ➕  Minyan: ${m.prayerType} @ ${cityName} on ${date}`);
        newMinyan++;
      }
    }
  }

  // ── Seed 1000 demo users (req 10.2) ──────────────────────────────────────────
  const existingCount = await userRepo.count();
  const TARGET_USERS = 1000;

  if (existingCount < TARGET_USERS) {
    const toCreate = TARGET_USERS - existingCount;
    console.log(`\n👤  Creating ${toCreate} demo users (current: ${existingCount})…`);

    const FIRST_NAMES = ['Aaron', 'Avraham', 'Benjamin', 'Daniel', 'David', 'Eliyahu', 'Ezra',
      'Gideon', 'Hannah', 'Isaac', 'Jacob', 'Joshua', 'Leah', 'Levi', 'Miriam',
      'Moshe', 'Naomi', 'Noah', 'Rachel', 'Rebecca', 'Ruth', 'Samuel', 'Sarah',
      'Shimon', 'Shlomo', 'Tamar', 'Yosef', 'Yitzhak', 'Zahava', 'Ziva'];
    const LAST_NAMES = ['Cohen', 'Levi', 'Katz', 'Shapiro', 'Goldstein', 'Friedman',
      'Silverstein', 'Rosenberg', 'Blum', 'Klein', 'Weiss', 'Schwartz',
      'Horowitz', 'Greenberg', 'Berkowitz', 'Stern', 'Feldman', 'Rubin',
      'Kaufman', 'Adler', 'Bernstein', 'Marcus', 'Jacobs', 'Rosen', 'Gluck'];

    const passwordHash = await bcrypt.hash('Demo1234!', 10);
    const BATCH = 50;
    let created = 0;

    for (let i = 0; i < toCreate; i += BATCH) {
      const batch: User[] = [];
      for (let j = 0; j < BATCH && i + j < toCreate; j++) {
        const idx = existingCount + i + j + 1;
        const fn = FIRST_NAMES[(i + j) % FIRST_NAMES.length];
        const ln = LAST_NAMES[(i + j) % LAST_NAMES.length];
        batch.push(
          userRepo.create({
            email: `demo.user${idx}@jewishontheway.test`,
            passwordHash,
            firstName: fn,
            lastName: ln,
          }),
        );
      }
      await userRepo.save(batch);
      created += batch.length;
      process.stdout.write(`\r  Created ${created}/${toCreate} users…`);
    }
    console.log(`\n✅  ${created} demo users created`);
  } else {
    console.log(`\n⏭️   Already have ${existingCount} users — skipping user seed`);
  }

  console.log(`\n✅  Done — ${newDest} destinations, ${newRest} restaurants, ${newMinyan} minyans added`);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
