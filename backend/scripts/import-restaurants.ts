/**
 * FREE restaurant import script — no paid API, no credit card required.
 *
 * Reads raw ZapRest-scraped Hebrew text from restaurants-raw.txt, parses it,
 * geocodes via Nominatim/OpenStreetMap (100% free, 1 req/sec), and upserts
 * into the database.
 *
 * Distance is NEVER stored — calculated live via PostGIS ST_Distance.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/import-restaurants.ts
 *
 * Prerequisites:
 *   npx typeorm migration:run -d src/data-source.ts
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '../.env') });

import axios from 'axios';
import { DataSource } from 'typeorm';
import { Destination } from '../src/destination.entity';

// ─── DataSource ───────────────────────────────────────────────────────────────

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [path.join(__dirname, '../src/**/*.entity{.ts,.js}')],
  synchronize: false,
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRestaurant {
  name: string;
  address: string;
  city: string;
  country: string;
  phone?: string;
  kashrutLevel: string;
  foodType: 'meat' | 'dairy' | 'pareve' | 'unknown';
  category?: string;
  destinationName: string;
}

// ─── City / destination maps ──────────────────────────────────────────────────

const CITY_EN: Record<
  string,
  { city: string; country: string; destination: string }
> = {
  'תל אביב': {
    city: 'Tel Aviv',
    country: 'Israel',
    destination: 'Tel Aviv',
  },
  יפו: { city: 'Tel Aviv', country: 'Israel', destination: 'Tel Aviv' },
  'נמל תל-אביב': {
    city: 'Tel Aviv',
    country: 'Israel',
    destination: 'Tel Aviv',
  },
  'בני ברק': {
    city: 'Bnei Brak',
    country: 'Israel',
    destination: 'Bnei Brak',
  },
  'פרדס כץ': {
    city: 'Bnei Brak',
    country: 'Israel',
    destination: 'Bnei Brak',
  },
  'רמת גן': {
    city: 'Ramat Gan',
    country: 'Israel',
    destination: 'Ramat Gan',
  },
  גבעתיים: {
    city: 'Givatayim',
    country: 'Israel',
    destination: 'Givatayim',
  },
  חולון: { city: 'Holon', country: 'Israel', destination: 'Holon' },
  'בת ים': { city: 'Bat Yam', country: 'Israel', destination: 'Bat Yam' },
  'פתח תקווה': {
    city: 'Petah Tikva',
    country: 'Israel',
    destination: 'Tel Aviv',
  },
  'ראשון לציון': {
    city: 'Rishon LeZion',
    country: 'Israel',
    destination: 'Rishon LeZion',
  },
  אשדוד: {
    city: 'Ashdod',
    country: 'Israel',
    destination: 'Ashdod',
  },
  'נמל אשדוד': {
    city: 'Ashdod',
    country: 'Israel',
    destination: 'Ashdod',
  },
  'קניון לב אשדוד': {
    city: 'Ashdod',
    country: 'Israel',
    destination: 'Ashdod',
  },
  'טופ סנטר אשדוד': {
    city: 'Ashdod',
    country: 'Israel',
    destination: 'Ashdod',
  },
  'מרכז צימר אשדוד': {
    city: 'Ashdod',
    country: 'Israel',
    destination: 'Ashdod',
  },
  // ── Southern Israel ──────────────────────────────────────────────────────────
  אשקלון: { city: 'Ashkelon', country: 'Israel', destination: 'Ashkelon' },
  'קניון לב אשקלון': {
    city: 'Ashkelon',
    country: 'Israel',
    destination: 'Ashkelon',
  },
  'קריית מלאכי': {
    city: 'Kiryat Malachi',
    country: 'Israel',
    destination: 'Kiryat Gat',
  },
  'באר שבע': {
    city: "Be'er Sheva",
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  'ביג באר שבע': {
    city: "Be'er Sheva",
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  'קניון הנגב': {
    city: "Be'er Sheva",
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  'מרכז בי 7 באר שבע': {
    city: "Be'er Sheva",
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  'תחנה מרכזית באר שבע': {
    city: "Be'er Sheva",
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  ערד: { city: 'Arad', country: 'Israel', destination: "Be'er Sheva" },
  'קניון ערד': {
    city: 'Arad',
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  'צים סנטר ערד': {
    city: 'Arad',
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  'מצפה רמון': {
    city: 'Mitzpe Ramon',
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  'מרכז מסחרי מצפה רמון': {
    city: 'Mitzpe Ramon',
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  ירוחם: { city: 'Yeruham', country: 'Israel', destination: "Be'er Sheva" },
  עומר: { city: 'Omer', country: 'Israel', destination: "Be'er Sheva" },
  'מרכז מסחרי עומר': {
    city: 'Omer',
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  להבים: { city: 'Lahavim', country: 'Israel', destination: "Be'er Sheva" },
  'צומת שוקת': {
    city: 'Shoket Junction',
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  אילת: { city: 'Eilat', country: 'Israel', destination: 'Eilat' },
  'ביג אילת': { city: 'Eilat', country: 'Israel', destination: 'Eilat' },
  'מרכז שלום אילת': {
    city: 'Eilat',
    country: 'Israel',
    destination: 'Eilat',
  },
  'ישרוטל אגמים': {
    city: 'Eilat',
    country: 'Israel',
    destination: 'Eilat',
  },
  'מרכז מסחרי רד': {
    city: 'Eilat',
    country: 'Israel',
    destination: 'Eilat',
  },
  נתיבות: { city: 'Netivot', country: 'Israel', destination: 'Netivot' },
  'צים סנטר נתיבות': {
    city: 'Netivot',
    country: 'Israel',
    destination: 'Netivot',
  },
  'גלובוס סנטר נתיבות': {
    city: 'Netivot',
    country: 'Israel',
    destination: 'Netivot',
  },
  'מרכז מסחרי נתיבות': {
    city: 'Netivot',
    country: 'Israel',
    destination: 'Netivot',
  },
  'קריית גת': {
    city: 'Kiryat Gat',
    country: 'Israel',
    destination: 'Kiryat Gat',
  },
  'קרית גת': {
    city: 'Kiryat Gat',
    country: 'Israel',
    destination: 'Kiryat Gat',
  },
  'ישפרו סנטר קרית גת': {
    city: 'Kiryat Gat',
    country: 'Israel',
    destination: 'Kiryat Gat',
  },
  אופקים: { city: 'Ofakim', country: 'Israel', destination: 'Ofakim' },
  שדרות: { city: 'Sderot', country: 'Israel', destination: 'Sderot' },
  'פרץ סנטר שדרות': {
    city: 'Sderot',
    country: 'Israel',
    destination: 'Sderot',
  },
  דימונה: { city: 'Dimona', country: 'Israel', destination: 'Dimona' },
  'פרץ סנטר דימונה': {
    city: 'Dimona',
    country: 'Israel',
    destination: 'Dimona',
  },
  'עין בוקק': {
    city: 'Ein Bokek',
    country: 'Israel',
    destination: 'Ein Gedi',
  },
  // Small Negev towns / moshavim mapped to nearest DB destination
  רהט: { city: 'Rahat', country: 'Israel', destination: 'Rahat' },
  'ניר בנים': {
    city: 'Nir Banim',
    country: 'Israel',
    destination: 'Nir Banim',
  },
  'נווה זוהר': {
    city: 'Neve Zohar',
    country: 'Israel',
    destination: 'Ein Gedi',
  },
  אילות: { city: 'Eilot', country: 'Israel', destination: 'Eilat' },
  לוטן: { city: 'Lotan', country: 'Israel', destination: 'Eilat' },
  'מדרשת בן גוריון': {
    city: 'Midreshet Ben Gurion',
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  'מועצה אזורית אשכול': {
    city: 'Eshkol Region',
    country: 'Israel',
    destination: 'Ofakim',
  },
  גילת: { city: 'Gilat', country: 'Israel', destination: "Be'er Sheva" },
  רתמים: {
    city: 'Retamim',
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  טללים: {
    city: 'Talilim',
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  נטע: { city: 'Neta', country: 'Israel', destination: "Be'er Sheva" },
  'בית קמה': {
    city: 'Beit Kama',
    country: 'Israel',
    destination: "Be'er Sheva",
  },
  מבקיעים: {
    city: "Mabu'im",
    country: 'Israel',
    destination: 'Kiryat Gat',
  },
  'תלמי ביל"ו': {
    city: 'Talmei Bilu',
    country: 'Israel',
    destination: 'Kiryat Gat',
  },
  אמציה: {
    city: 'Amatzya',
    country: 'Israel',
    destination: 'Kiryat Gat',
  },
  ישע: { city: 'Yesha', country: 'Israel', destination: 'Ashkelon' },
  שקף: { city: 'Shekef', country: 'Israel', destination: 'Ashkelon' },
  בארי: { city: "Be'eri", country: 'Israel', destination: 'Sderot' },
  עוצם: { city: 'Otzem', country: 'Israel', destination: 'Netivot' },
  עמיעוז: { city: "Ami'oz", country: 'Israel', destination: 'Ofakim' },
  נווה: { city: 'Neve', country: 'Israel', destination: "Be'er Sheva" },
  // ── Northern Israel ──────────────────────────────────────────────────────────
  טבריה: {
    city: 'Tiberias',
    country: 'Israel',
    destination: 'Tiberias',
  },
  חיפה: { city: 'Haifa', country: 'Israel', destination: 'Haifa' },
  'מפרץ חיפה': { city: 'Haifa', country: 'Israel', destination: 'Haifa' },
  קיסריה: {
    city: 'Caesarea',
    country: 'Israel',
    destination: 'Caesarea',
  },
  'ראש פינה': {
    city: 'Rosh Pina',
    country: 'Israel',
    destination: 'Rosh Pina',
  },
  'זכרון יעקב': {
    city: 'Zichron Yaakov',
    country: 'Israel',
    destination: 'Zichron Yaakov',
  },
  קצרין: {
    city: 'Katzrin',
    country: 'Israel',
    destination: 'Katzrin',
  },
  'בית שאן': {
    city: "Beit She'an",
    country: 'Israel',
    destination: "Beit She'an",
  },
  'קריית ביאליק': {
    city: 'Kiryat Bialik',
    country: 'Israel',
    destination: 'Kiryat Bialik',
  },
  'קרית ביאליק': {
    city: 'Kiryat Bialik',
    country: 'Israel',
    destination: 'Kiryat Bialik',
  },
  עפולה: { city: 'Afula', country: 'Israel', destination: 'Afula' },
  'קרית אתא': {
    city: 'Kiryat Ata',
    country: 'Israel',
    destination: 'Kiryat Ata',
  },
  'קריית אתא': {
    city: 'Kiryat Ata',
    country: 'Israel',
    destination: 'Kiryat Ata',
  },
  'אור עקיבא': {
    city: 'Or Akiva',
    country: 'Israel',
    destination: 'Hadera',
  },
  נשר: { city: 'Nesher', country: 'Israel', destination: 'Nesher' },
  'קריית שמונה': {
    city: 'Kiryat Shmona',
    country: 'Israel',
    destination: 'Kiryat Shmona',
  },
  'קרית שמונה': {
    city: 'Kiryat Shmona',
    country: 'Israel',
    destination: 'Kiryat Shmona',
  },
  'מרכז מסחרי יקנעם': {
    city: 'Yokneam',
    country: 'Israel',
    destination: 'Yokneam',
  },
  יקנעם: { city: 'Yokneam', country: 'Israel', destination: 'Yokneam' },
  אבטליון: {
    city: 'Abtaliyon',
    country: 'Israel',
    destination: 'Karmiel',
  },
  'עכו העתיקה': { city: 'Akko', country: 'Israel', destination: 'Akko' },
  עכו: { city: 'Akko', country: 'Israel', destination: 'Akko' },
  'חצור הגלילית': {
    city: 'Hazor HaGlilit',
    country: 'Israel',
    destination: 'Kiryat Shmona',
  },
  מעונה: { city: "Ma'ona", country: 'Israel', destination: "Ma'ona" },
  'קריית טבעון': {
    city: "Kiryat Tiv'on",
    country: 'Israel',
    destination: "Kiryat Tiv'on",
  },
  'קרית טבעון': {
    city: "Kiryat Tiv'on",
    country: 'Israel',
    destination: "Kiryat Tiv'on",
  },
  'רמת ישי': {
    city: 'Ramat Yishai',
    country: 'Israel',
    destination: 'Ramat Yishai',
  },
  צפת: { city: 'Safed', country: 'Israel', destination: 'Safed' },
  'כפר תבור': {
    city: 'Kfar Tavor',
    country: 'Israel',
    destination: 'Kfar Tavor',
  },
  כרמיאל: { city: 'Karmiel', country: 'Israel', destination: 'Karmiel' },
  'ביג כרמיאל': {
    city: 'Karmiel',
    country: 'Israel',
    destination: 'Karmiel',
  },
  נהריה: { city: 'Nahariya', country: 'Israel', destination: 'Nahariya' },
  כחל: {
    city: 'Kahal',
    country: 'Israel',
    destination: 'Western Galilee',
  },
  'קריית מוצקין': {
    city: 'Kiryat Motzkin',
    country: 'Israel',
    destination: 'Kiryat Motzkin',
  },
  'קרית מוצקין': {
    city: 'Kiryat Motzkin',
    country: 'Israel',
    destination: 'Kiryat Motzkin',
  },
  רגבה: { city: 'Regba', country: 'Israel', destination: 'Regba' },
  "ג'וליס": {
    city: 'Julis',
    country: 'Israel',
    destination: 'Western Galilee',
  },
  // Haifa area
  'טירת כרמל': { city: 'Tirat Carmel', country: 'Israel', destination: 'Haifa' },
  'קניון חיפה': { city: 'Haifa', country: 'Israel', destination: 'Haifa' },
  'גרנד קניון חיפה': { city: 'Haifa', country: 'Israel', destination: 'Haifa' },
  'מרכז ביג חיפה': { city: 'Haifa', country: 'Israel', destination: 'Haifa' },
  'מרכז קניות סגול חיפה': { city: 'Haifa', country: 'Israel', destination: 'Haifa' },
  'נמל חיפה': { city: 'Haifa', country: 'Israel', destination: 'Haifa' },
  'קניון חוצות אלונים': { city: 'Haifa', country: 'Israel', destination: 'Haifa' },
  'דאלית אל-כרמל': { city: 'Daliyat al-Karmel', country: 'Israel', destination: 'Haifa' },
  'מדרך עוז': { city: 'Midrakh Oz', country: 'Israel', destination: 'Haifa' },
  'גבעת אלה': { city: 'Givat Ela', country: 'Israel', destination: 'Haifa' },
  אביטל: { city: 'Avital', country: 'Israel', destination: 'Haifa' },
  // Kiryat Ata/Kiryot area
  'ביג קריות': { city: 'Kiryat Bialik', country: 'Israel', destination: 'Kiryat Bialik' },
  'קרית ים': { city: 'Kiryat Yam', country: 'Israel', destination: 'Kiryat Yam' },
  'קריית ים': { city: 'Kiryat Yam', country: 'Israel', destination: 'Kiryat Yam' },
  שפרעם: { city: 'Shfaram', country: 'Israel', destination: 'Kiryat Ata' },
  // Nesher/Atlit
  עתלית: { city: 'Atlit', country: 'Israel', destination: 'Atlit' },
  // Hadera/Pardes Hanna area
  חריש: { city: 'Harish', country: 'Israel', destination: 'Hadera' },
  קציר: { city: 'Katzir', country: 'Israel', destination: 'Hadera' },
  נחשולים: { city: 'Nahsholim', country: 'Israel', destination: 'Caesarea' },
  // Akko area
  'קניון עכו': { city: 'Akko', country: 'Israel', destination: 'Akko' },
  אשרת: { city: 'Asherot', country: 'Israel', destination: 'Akko' },
  // Nahariya/Western Galilee
  'מעלות-תרשיחא': { city: "Ma'alot-Tarshiha", country: 'Israel', destination: "Ma'alot" },
  'ראש הנקרה': { city: 'Rosh HaNikra', country: 'Israel', destination: 'Rosh HaNikra' },
  שלומי: { city: 'Shlomi', country: 'Israel', destination: 'Nahariya' },
  יערה: { city: 'Yara', country: 'Israel', destination: 'Western Galilee' },
  'שבי ציון': { city: 'Shave Zion', country: 'Israel', destination: 'Nahariya' },
  'גשר הזיו': { city: 'Gesher HaZiv', country: 'Israel', destination: 'Nahariya' },
  לימן: { city: 'Liman', country: 'Israel', destination: 'Nahariya' },
  אכזיב: { city: 'Achziv', country: 'Israel', destination: 'Achziv' },
  'בוסתן הגליל': { city: 'Bustan HaGalil', country: 'Israel', destination: 'Nahariya' },
  'נחל צלמון': { city: 'Nahal Tzalmon', country: 'Israel', destination: 'Western Galilee' },
  כליל: { city: 'Kelil', country: 'Israel', destination: 'Western Galilee' },
  זרעית: { city: "Zar'it", country: 'Israel', destination: 'Western Galilee' },
  // Karmiel/Misgav area
  משגב: { city: 'Misgav', country: 'Israel', destination: 'Misgav' },
  'קניון לב כרמיאל': { city: 'Karmiel', country: 'Israel', destination: 'Karmiel' },
  'פארק תעשיות בר-לב': { city: 'Bar Lev Industrial Park', country: 'Israel', destination: 'Karmiel' },
  'מגדל תפן': { city: 'Migdal Tefen', country: 'Israel', destination: 'Karmiel' },
  'קלע אלון': { city: "Kela' Alon", country: 'Israel', destination: 'Karmiel' },
  הרדוף: { city: 'Harduf', country: 'Israel', destination: 'Karmiel' },
  'כפר חושן': { city: 'Kfar Hosen', country: 'Israel', destination: 'Karmiel' },
  חזון: { city: 'Hazon', country: 'Israel', destination: 'Karmiel' },
  מורן: { city: 'Moran', country: 'Israel', destination: 'Karmiel' },
  שפר: { city: 'Shafer', country: 'Israel', destination: 'Karmiel' },
  ירכא: { city: 'Yirka', country: 'Israel', destination: 'Western Galilee' },
  // Safed area
  'קניון שערי העיר צפת': { city: 'Safed', country: 'Israel', destination: 'Safed' },
  מירון: { city: 'Meron', country: 'Israel', destination: 'Safed' },
  'בר יוחאי': { city: 'Bar Yochai', country: 'Israel', destination: 'Safed' },
  ביריה: { city: 'Biria', country: 'Israel', destination: 'Safed' },
  'אור הגנוז': { city: 'Or HaGanuz', country: 'Israel', destination: 'Safed' },
  אמירים: { city: 'Amirim', country: 'Israel', destination: 'Safed' },
  דלתון: { city: 'Dalton', country: 'Israel', destination: 'Safed' },
  // Kiryat Shmona/Upper Galilee
  אביבים: { city: 'Avivim', country: 'Israel', destination: 'Kiryat Shmona' },
  עמיר: { city: 'Amir', country: 'Israel', destination: 'Kiryat Shmona' },
  'רשות החולה': { city: 'Hula Valley', country: 'Israel', destination: 'Kiryat Shmona' },
  'להבות הבשן': { city: 'Lahavot HaBashan', country: 'Israel', destination: 'Kiryat Shmona' },
  נוב: { city: 'Nov', country: 'Israel', destination: 'Kiryat Shmona' },
  גדות: { city: 'Gadot', country: 'Israel', destination: 'Kiryat Shmona' },
  יובל: { city: 'Yuval', country: 'Israel', destination: 'Kiryat Shmona' },
  // Rosh Pina area
  'חאן ראש פינה': { city: 'Rosh Pina', country: 'Israel', destination: 'Rosh Pina' },
  // Yesud HaMa'ala
  'יסוד המעלה': { city: "Yesud HaMa'ala", country: 'Israel', destination: "Yesud HaMa'ala" },
  // Katzrin/Golan
  'קניון לב קצרין': { city: 'Katzrin', country: 'Israel', destination: 'Katzrin' },
  חיספין: { city: 'Hispin', country: 'Israel', destination: 'Katzrin' },
  'בני יהודה': { city: 'Bnei Yehuda', country: 'Israel', destination: 'Katzrin' },
  'עין זיוון': { city: 'Ein Ziwan', country: 'Israel', destination: 'Katzrin' },
  "מג'דל שמס": { city: "Majdal Shams", country: 'Israel', destination: 'Katzrin' },
  בוקעאתא: { city: "Buq'ata", country: 'Israel', destination: 'Katzrin' },
  שעל: { city: "Sha'al", country: 'Israel', destination: 'Katzrin' },
  'גבעת יואב': { city: 'Givat Yoav', country: 'Israel', destination: 'Katzrin' },
  רוויה: { city: 'Rewaya', country: 'Israel', destination: 'Katzrin' },
  'מרום גולן': { city: 'Mrom Golan', country: 'Israel', destination: 'Mrom Golan' },
  נטור: { city: 'Natur', country: 'Israel', destination: 'Katzrin' },
  // Tiberias area
  'ביג פאשן דנילוף טבריה': { city: 'Tiberias', country: 'Israel', destination: 'Tiberias' },
  'טבריה עילית': { city: 'Tiberias', country: 'Israel', destination: 'Tiberias' },
  צמח: { city: 'Zemah', country: 'Israel', destination: 'Tiberias' },
  'כנרת - קבוצה': { city: 'Kineret', country: 'Israel', destination: 'Kineret' },
  'כנרת (מושבה)': { city: 'Kineret', country: 'Israel', destination: 'Kineret' },
  'אשדות יעקב מאוחד': { city: 'Ashdot Yaakov', country: 'Israel', destination: 'Tiberias' },
  יבנאל: { city: "Yavne'el", country: 'Israel', destination: 'Tiberias' },
  גינוסר: { city: 'Ginosar', country: 'Israel', destination: 'Tiberias' },
  'חד נס': { city: 'Had Nes', country: 'Israel', destination: 'Tiberias' },
  'פוריה עילית': { city: 'Poriya Illit', country: 'Israel', destination: 'Tiberias' },
  'חמת גדר': { city: 'Hamat Gader', country: 'Israel', destination: 'Tiberias' },
  אפיקים: { city: 'Afikim', country: 'Israel', destination: 'Tiberias' },
  // Beit She'an area
  'בית השיטה': { city: 'Beit HaShita', country: 'Israel', destination: "Beit She'an" },
  'בית אלפא': { city: 'Beit Alfa', country: 'Israel', destination: "Beit She'an" },
  מנחמיה: { city: 'Menahamia', country: 'Israel', destination: "Beit She'an" },
  גשר: { city: 'Gesher', country: 'Israel', destination: "Beit She'an" },
  'שדה אליהו': { city: 'Sede Eliyahu', country: 'Israel', destination: "Beit She'an" },
  'מעלה גלבוע': { city: 'Ma\'ale Gilboa', country: 'Israel', destination: "Beit She'an" },
  רחוב: { city: 'Rahov', country: 'Israel', destination: "Beit She'an" },
  // Afula/Jezreel Valley
  'עפולה עילית': { city: 'Afula', country: 'Israel', destination: 'Afula' },
  'מרחביה (קיבוץ)': { city: 'Merhavia', country: 'Israel', destination: 'Afula' },
  'שדי תרומות': { city: 'Sede Terumot', country: 'Israel', destination: 'Afula' },
  'הזורעים': { city: 'HaZore\'im', country: 'Israel', destination: 'Afula' },
  'גבעת אבני': { city: 'Givat Avni', country: 'Israel', destination: 'Afula' },
  'ניר יפה': { city: 'Nir Yafe', country: 'Israel', destination: 'Afula' },
  'אחוזת ברק': { city: 'Ahuzat Barak', country: 'Israel', destination: 'Afula' },
  שריד: { city: 'Sarid', country: 'Israel', destination: 'Afula' },
  'גן נר': { city: 'Gan Ner', country: 'Israel', destination: 'Afula' },
  'מועצה אזורית הגליל התחתון': { city: 'Lower Galilee', country: 'Israel', destination: 'Afula' },
  'עין העמק': { city: "Ein HaEmek", country: 'Israel', destination: 'Afula' },
  זרזיר: { city: 'Zarzir', country: 'Israel', destination: 'Afula' },
  ברקאי: { city: 'Barkai', country: 'Israel', destination: 'Hadera' },
  // Migdal HaEmek / Nof HaGalil (Nazareth Illit)
  'מגדל העמק': { city: 'Migdal HaEmek', country: 'Israel', destination: 'Migdal HaEmek' },
  'פרץ סנטר מגדל העמק': { city: 'Migdal HaEmek', country: 'Israel', destination: 'Migdal HaEmek' },
  'נצרת עילית (נוף הגליל)': { city: 'Nof HaGalil', country: 'Israel', destination: 'Nof HaGalil' },
  'קניון וואן נצרת עילית': { city: 'Nof HaGalil', country: 'Israel', destination: 'Nof HaGalil' },
  נצרת: { city: 'Nazareth', country: 'Israel', destination: 'Nof HaGalil' },
  // Yokneam area
  'קניון דרכים יקנעם': { city: 'Yokneam', country: 'Israel', destination: 'Yokneam' },
  'ביג יקנעם': { city: 'Yokneam', country: 'Israel', destination: 'Yokneam' },
  // Kfar Tavor / Lower Galilee
  אלונים: { city: 'Alonei Abba', country: 'Israel', destination: 'Kfar Tavor' },
  אילניה: { city: 'Ilaniya', country: 'Israel', destination: 'Kfar Tavor' },
  לביא: { city: 'Lavi', country: 'Israel', destination: 'Kfar Tavor' },
  'בית לחם הגלילית': { city: 'Beit Lehem HaGlilit', country: 'Israel', destination: 'Kfar Tavor' },
  'שדה אילן': { city: 'Sde Ilan', country: 'Israel', destination: 'Sde Ilan' },
  // Misgav area
  'אבן מנחם': { city: 'Even Menahem', country: 'Israel', destination: 'Western Galilee' },
  שתולה: { city: 'Shetula', country: 'Israel', destination: 'Western Galilee' },
  // ── Center Israel ─────────────────────────────────────────────────────────────
  'מודיעין והסביבה': { city: 'Modiin', country: 'Israel', destination: 'Modiin' },
  מודיעין: { city: 'Modiin', country: 'Israel', destination: 'Modiin' },
  'קניון מודיעין': { city: 'Modiin', country: 'Israel', destination: 'Modiin' },
  'ישפרו סנטר מודיעין': { city: 'Modiin', country: 'Israel', destination: 'Modiin' },
  'משמר איילון': { city: 'Mishmar Ayalon', country: 'Israel', destination: 'Modiin' },
  שילת: { city: 'Shilat', country: 'Israel', destination: 'Shilat' },
  'אור יהודה': { city: 'Or Yehuda', country: 'Israel', destination: 'Or Yehuda' },
  'עזריאלי אור יהודה אאוטלט': { city: 'Or Yehuda', country: 'Israel', destination: 'Or Yehuda' },
  אזור: { city: 'Azor', country: 'Israel', destination: 'Or Yehuda' },
  'ראש העין': { city: 'Rosh HaAyin', country: 'Israel', destination: 'Rosh HaAyin' },
  נופך: { city: 'Nofekh', country: 'Israel', destination: 'Rosh HaAyin' },
  רמלה: { city: 'Ramla', country: 'Israel', destination: 'Ramla' },
  'קניון רמלה': { city: 'Ramla', country: 'Israel', destination: 'Ramla' },
  'קניון קרית רמלה': { city: 'Ramla', country: 'Israel', destination: 'Ramla' },
  'טירת יהודה': { city: 'Tirat Yehuda', country: 'Israel', destination: 'Ramla' },
  'בית נחמיה': { city: 'Beit Nehemia', country: 'Israel', destination: 'Ramla' },
  'גבעת שמואל': { city: 'Givat Shmuel', country: 'Israel', destination: 'Givat Shmuel' },
  לוד: { city: 'Lod', country: 'Israel', destination: 'Lod' },
  'קניון לוד סנטר': { city: 'Lod', country: 'Israel', destination: 'Lod' },
  'כפר חב"ד': { city: "Kfar Chabad", country: 'Israel', destination: 'Lod' },
  אחיעזר: { city: "Ahi'ezer", country: 'Israel', destination: 'Lod' },
  'בית דגן': { city: 'Beit Dagan', country: 'Israel', destination: 'Lod' },
  יהוד: { city: 'Yehud', country: 'Israel', destination: 'Yehud' },
  'יהוד-מונוסון': { city: 'Yehud', country: 'Israel', destination: 'Yehud' },
  שוהם: { city: 'Shoham', country: 'Israel', destination: 'Shoham' },
  'קריית אונו': { city: 'Kiryat Ono', country: 'Israel', destination: 'Kiryat Ono' },
  'קרית אונו': { city: 'Kiryat Ono', country: 'Israel', destination: 'Kiryat Ono' },
  'קניון קרית אונו': { city: 'Kiryat Ono', country: 'Israel', destination: 'Kiryat Ono' },
  'קניון קריית אונו': { city: 'Kiryat Ono', country: 'Israel', destination: 'Kiryat Ono' },
  'גני תקווה': { city: 'Ganei Tikva', country: 'Israel', destination: 'Ganei Tikva' },
  'איירפורט סיטי': { city: 'Airport City', country: 'Israel', destination: 'Ben Gurion Airport' },
  'נתב"ג': { city: 'Ben Gurion Airport', country: 'Israel', destination: 'Ben Gurion Airport' },
  'טרמינל סנטר': { city: 'Ben Gurion Airport', country: 'Israel', destination: 'Ben Gurion Airport' },
  'בארות יצחק': { city: "Be'erot Yitzhak", country: 'Israel', destination: 'Ben Gurion Airport' },
  אלעד: { city: "El'ad", country: 'Israel', destination: 'Petah Tikva' },
  'כוכב יאיר': { city: 'Kokhav Yair', country: 'Israel', destination: 'Kfar Saba' },
  רינתיה: { city: 'Rinnatia', country: 'Israel', destination: 'Kfar Saba' },
  סביון: { city: 'Savion', country: 'Israel', destination: 'Savion' },
  'פארק המדע רחובות': { city: 'Rehovot', country: 'Israel', destination: 'Rehovot' },
  'פארק פרס': { city: 'Tel Aviv', country: 'Israel', destination: 'Tel Aviv' },
  'רמת אפעל': { city: 'Ramat Efal', country: 'Israel', destination: 'Tel Aviv' },
  'תחנה מרכזית חדשה תל אביב': { city: 'Tel Aviv', country: 'Israel', destination: 'Tel Aviv' },
  'קניון גבעתיים': {
    city: 'Givatayim',
    country: 'Israel',
    destination: 'Givatayim',
  },
  'קניון בת ים': { city: 'Bat Yam', country: 'Israel', destination: 'Bat Yam' },
  'טיילת בת ים': { city: 'Bat Yam', country: 'Israel', destination: 'Bat Yam' },
  'קניון חולון': {
    city: 'Holon',
    country: 'Israel',
    destination: 'Holon',
  },
  'מרכז סאדאב חולון': {
    city: 'Holon',
    country: 'Israel',
    destination: 'Holon',
  },
  'קניון לב העיר פתח תקווה': { city: 'Petah Tikva', country: 'Israel', destination: 'Tel Aviv' },
  'יכין סנטר פתח תקווה': { city: 'Petah Tikva', country: 'Israel', destination: 'Tel Aviv' },
  'קניון כיכר העיר פתח תקווה': { city: 'Petah Tikva', country: 'Israel', destination: 'Tel Aviv' },
  'B סנטר פתח תקווה': { city: 'Petah Tikva', country: 'Israel', destination: 'Tel Aviv' },
  'טיילת ראשון לציון': {
    city: 'Rishon LeZion',
    country: 'Israel',
    destination: 'Rishon LeZion',
  },
  'קייזר סנטר': {
    city: 'Rishon LeZion',
    country: 'Israel',
    destination: 'Rishon LeZion',
  },
  'שופינג רמת גן': {
    city: 'Ramat Gan',
    country: 'Israel',
    destination: 'Ramat Gan',
  },
  'דונה סנטר': { city: 'Tel Aviv', country: 'Israel', destination: 'Tel Aviv' },
  זיתן: { city: 'Zeitan', country: 'Israel', destination: 'Ramla' },
  נחלים: { city: 'Nehalim', country: 'Israel', destination: 'Petah Tikva' },
  'משמר השבעה': { city: 'Mishmar HaShiva', country: 'Israel', destination: 'Rehovot' },

  // ── Shfela ────────────────────────────────────────────────────────────────────
  יבנה: { city: 'Yavne', country: 'Israel', destination: 'Yavne' },
  גדרה: { city: 'Gedera', country: 'Israel', destination: 'Gedera' },
  אמונים: { city: 'Emunim', country: 'Israel', destination: 'Rehovot' },
  'נס ציונה': {
    city: 'Ness Ziona',
    country: 'Israel',
    destination: 'Ness Ziona',
  },

  // ── Sharon ────────────────────────────────────────────────────────────────────
  נתניה: { city: 'Netanya', country: 'Israel', destination: 'Netanya' },
  'כפר סבא': { city: 'Kfar Saba', country: 'Israel', destination: 'Kfar Saba' },
  רעננה: { city: "Ra'anana", country: 'Israel', destination: "Ra'anana" },
  'רמת השרון': { city: 'Ramat HaSharon', country: 'Israel', destination: 'Ramat HaSharon' },
  חדרה: { city: 'Hadera', country: 'Israel', destination: 'Hadera' },
  'מרכז מסחרי שערי חדרה': {
    city: 'Hadera',
    country: 'Israel',
    destination: 'Hadera',
  },
  'הרצליה פיתוח': {
    city: 'Herzliya',
    country: 'Israel',
    destination: 'Herzliya',
  },
  'מרינה הרצליה': {
    city: 'Herzliya',
    country: 'Israel',
    destination: 'Herzliya',
  },
  'ביתן אהרן': {
    city: "Bitan Aharon",
    country: 'Israel',
    destination: 'Netanya',
  },
  זמר: { city: 'Zemer', country: 'Israel', destination: 'Hadera' },
  'כפר מונש': { city: 'Kfar Monash', country: 'Israel', destination: 'Netanya' },

  // ── Jerusalem ─────────────────────────────────────────────────────────────────
  ירושלים: { city: 'Jerusalem', country: 'Israel', destination: 'Jerusalem' },
  'בית שמש': {
    city: 'Beit Shemesh',
    country: 'Israel',
    destination: 'Beit Shemesh',
  },
  'גבעת זאב': {
    city: "Givat Ze'ev",
    country: 'Israel',
    destination: 'Jerusalem',
  },
  'מבשרת ציון': {
    city: 'Mevasseret Zion',
    country: 'Israel',
    destination: 'Mevaseret',
  },
  'עין נקובא': {
    city: 'Ein Nakuba',
    country: 'Israel',
    destination: 'Jerusalem',
  },
};

const TEL_AVIV_NEIGHBORHOODS = new Set([
  'צפון תל אביב',
  'כיכר המדינה תל אביב',
  'פלורנטין',
  'נווה צדק',
  'שוק הכרמל',
  'מעוז אביב',
  'קניון עזריאלי',
  'מרכז שוסטר',
  'רמת החייל',
  'שכונת התקווה',
  'גן העיר',
  'לב תל אביב',
]);

const KNOWN_CITIES_HE = new Set([
  ...Object.keys(CITY_EN),
  ...TEL_AVIV_NEIGHBORHOODS,
]);

function resolveCity(hCity: string): {
  city: string;
  country: string;
  destination: string;
} {
  const t = hCity.trim();
  if (CITY_EN[t]) return CITY_EN[t];
  for (const n of TEL_AVIV_NEIGHBORHOODS) {
    if (t.includes(n) || n.includes(t)) {
      return { city: 'Tel Aviv', country: 'Israel', destination: 'Tel Aviv' };
    }
  }
  return { city: 'Tel Aviv', country: 'Israel', destination: 'Tel Aviv' };
}

// ─── Food type / kashrut parsing ──────────────────────────────────────────────

const FOOD_TYPES: Array<{
  re: RegExp;
  foodType: 'meat' | 'dairy' | 'pareve' | 'unknown';
  category: string;
}> = [
  { re: /מסעדת בשרים|בשרים/, foodType: 'meat', category: 'Israeli' },
  { re: /מסעדה בוכרית|בוכרית/, foodType: 'meat', category: 'Bukharian' },
  {
    re: /מסעדה מזרחית|מזרחית/,
    foodType: 'meat',
    category: 'Middle Eastern',
  },
  {
    re: /מסעדה ים תיכונית|ים תיכונית/,
    foodType: 'meat',
    category: 'Mediterranean',
  },
  { re: /מסעדה תימנית|תימנית/, foodType: 'meat', category: 'Yemenite' },
  { re: /מסעדה מרוקאית|מרוקאית/, foodType: 'meat', category: 'Moroccan' },
  { re: /טריפוליטאית/, foodType: 'meat', category: 'Tripolitanian' },
  {
    re: /מסעדה אתיופית|אתיופית/,
    foodType: 'meat',
    category: 'Ethiopian',
  },
  {
    re: /מסעדה גרוזינית|גרוזינית/,
    foodType: 'meat',
    category: 'Georgian',
  },
  { re: /המבורגרים/, foodType: 'meat', category: 'Burgers' },
  { re: /שווארמה/, foodType: 'meat', category: 'Shawarma' },
  { re: /שניצליה/, foodType: 'meat', category: 'Schnitzel' },
  { re: /מטבח ביתי/, foodType: 'meat', category: 'Home Cooking' },
  {
    re: /מסעדה חלבית|חלבית/,
    foodType: 'dairy',
    category: 'Israeli',
  },
  { re: /מסעדה איטלקית|איטלקית/, foodType: 'unknown', category: 'Italian' },
  { re: /מסעדה צרפתית|צרפתית/, foodType: 'unknown', category: 'French' },
  {
    re: /מסעדה אסייאתית|אסייאתית/,
    foodType: 'unknown',
    category: 'Asian',
  },
  { re: /מסעדה יפנית|יפנית/, foodType: 'unknown', category: 'Japanese' },
  {
    re: /מסעדה מקסיקנית|מקסיקנית/,
    foodType: 'unknown',
    category: 'Mexican',
  },
  { re: /מסעדה סינית|סינית/, foodType: 'unknown', category: 'Chinese' },
  { re: /מסעדה הודית|הודית/, foodType: 'unknown', category: 'Indian' },
  { re: /סושי/, foodType: 'unknown', category: 'Sushi' },
  {
    re: /סנדוויץ' בר|סנדביץ' בר|סנדוויץ בר/,
    foodType: 'unknown',
    category: 'Sandwich Bar',
  },
  { re: /קייטרינג/, foodType: 'unknown', category: 'Catering' },
  {
    re: /גלידריות|גלידה/,
    foodType: 'dairy',
    category: 'Ice Cream',
  },
  { re: /מסעדת דגים|דגים/, foodType: 'pareve', category: 'Seafood' },
  { re: /בתי קפה|קפה/, foodType: 'dairy', category: 'Cafe' },
  { re: /קונדיטוריה/, foodType: 'dairy', category: 'Bakery' },
  { re: /פיצריות|פיצה/, foodType: 'dairy', category: 'Pizza' },
  { re: /חומוסייה|חומוס/, foodType: 'pareve', category: 'Hummus' },
  { re: /מסעדה טבעונית|טבעוני/, foodType: 'pareve', category: 'Vegan' },
  { re: /פאבים|ברים/, foodType: 'unknown', category: 'Bar' },
  { re: /אוכל רחוב/, foodType: 'unknown', category: 'Street Food' },
  {
    re: /מסעדת קונספט|קונספט|^שף$/,
    foodType: 'unknown',
    category: 'Fine Dining',
  },
];

const BADATZ_RE = /בד["״״]ץ|בדץ/;
const MEHADRIN_RE = /למהדרין|מהדרין/;

function detectKashrutLevel(text: string): string {
  if (BADATZ_RE.test(text)) return 'badatz';
  if (MEHADRIN_RE.test(text)) return 'mehadrin';
  return 'rabbinate';
}

function parseTypeKashrut(
  typeLine: string,
  fullBlock: string,
): {
  foodType: 'meat' | 'dairy' | 'pareve' | 'unknown';
  category: string;
  kashrutLevel: string;
} {
  let foodType: 'meat' | 'dairy' | 'pareve' | 'unknown' = 'unknown';
  let category = 'Israeli';

  for (const { re, foodType: ft, category: cat } of FOOD_TYPES) {
    if (re.test(typeLine)) {
      foodType = ft;
      category = cat;
      break;
    }
  }

  // Search the full block — ZapRest often puts מהדרין/בד"ץ in the name line
  const kashrutLevel = detectKashrutLevel(fullBlock);

  return { foodType, category, kashrutLevel };
}

// ─── ZapRest raw-text parser ──────────────────────────────────────────────────

const PHONE_RE = /^(0[0-9]{1,2}[-\s][0-9]{6,8}|1[-][78]00[-][0-9]{6,7})$/;

const NOISE_RES = [
  /^נמצאו \d+ מסעדות/,
  /^פרטי המסעדה/,
  /^הזמנת שולחן/,
  /^הזמנת משלוח/,
  /^מפה$/,
  /^קדימה$/,
  /^ ?\d+ חוות דעת$/,
  /^TOP 10#\d+/i,
  /^Top 10 מסעדות/,
  /^מסעדות \S+ כשרות/,
  /^מסעדה מאזור/,
  /^כתבות אחרונות/,
  /קראו עוד/,
  /^\d{2}\/\d{2}\/\d{4}$/,
  /^מערכת\s+zap/i,
  /^מחפשים מסעדת/,
  /^לא תשארו רעבים/,
  /^בית ויס התחדש/,
  /^אניילוטי/,
  /^גבירותיי ורבותיי/,
  /^שלוש שנים/,
  /^נויפלד/,
  /^עודד פשטצקי/,
  /^ליאור נויפלד/,
  /^אורלי בויום/,
  /^יוליה פריליק/,
  /^קולינריה בהשגחה/,
  /^כשרות היא לא/,
  /^מחיר ₪/,
  /^\d+\s*ק"מ$/,
  /^קישור למסעדה$/,
];

function isNoise(line: string): boolean {
  return !line || NOISE_RES.some((re) => re.test(line));
}

function looksLikeTypeLine(line: string): boolean {
  if (line.includes('כשר')) return true;
  return [
    'מסעדת',
    'מסעדה',
    'בתי קפה',
    'פיצריות',
    'חומוסייה',
    'קונדיטוריה',
    'פאבים',
    'שניצליה',
    'שף',
    'אוכל רחוב',
    'מטבח ביתי',
    'שווארמה',
    'קייטרינג',
    'גלידריות',
    "סנדוויץ' בר",
    'סנדביץ',
  ].some((k) => line.includes(k));
}

function extractCityFromAddress(addrLine: string): {
  street: string;
  hebrewCity: string;
} {
  const beforePipe = addrLine.split('|')[0].trim();
  const parts = beforePipe
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 1) {
    return { street: '', hebrewCity: parts[0] };
  }

  for (let i = parts.length - 1; i >= 0; i--) {
    if (KNOWN_CITIES_HE.has(parts[i])) {
      return { street: parts.slice(0, i).join(', '), hebrewCity: parts[i] };
    }
  }

  return {
    street: parts.slice(0, -1).join(', '),
    hebrewCity: parts[parts.length - 1],
  };
}

function cleanName(raw: string): string {
  let name = raw.trim();
  // Strip inline kashrut qualifier: "אלברטו (כשר למהדרין)" → "אלברטו"
  name = name.replace(/\s*\([^)]*כשר[^)]*\)/g, '').trim();
  const dashIdx = name.indexOf(' - ');
  if (dashIdx !== -1) return name.slice(0, dashIdx).trim();
  return name;
}

function parseRawData(rawText: string): ParsedRestaurant[] {
  const results: ParsedRestaurant[] = [];

  const cleanLines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !isNoise(l));

  let blockStart = 0;

  for (let i = 0; i < cleanLines.length; i++) {
    if (!PHONE_RE.test(cleanLines[i])) continue;

    const block = cleanLines
      .slice(blockStart, i + 1)
      .filter((l) => l.length > 0);
    blockStart = i + 1;

    if (block.length < 2) continue;

    const phone = block[block.length - 1];
    const content = block.slice(0, -1);

    // Find last type/kashrut line scanning from the end
    let typeIdx = -1;
    for (let j = content.length - 1; j >= 0; j--) {
      if (looksLikeTypeLine(content[j])) {
        typeIdx = j;
        break;
      }
    }

    const nameLines = typeIdx !== -1 ? content.slice(0, typeIdx) : content;
    const addrLines = typeIdx !== -1 ? content.slice(typeIdx + 1) : [];

    // Name: prefer 2nd line (clean short name), skip bare city-name lines
    const nonCity = nameLines.filter((l) => !KNOWN_CITIES_HE.has(l));
    const rawName = nonCity.length > 1 ? nonCity[1] : (nonCity[0] ?? '');
    const name = cleanName(rawName);
    if (!name) continue;

    // Type / kashrut — search full block so מהדרין/בד"ץ in name lines is caught
    const typeLine = typeIdx !== -1 ? content[typeIdx] : '';
    const fullBlock = content.join(' ');
    const { foodType, category, kashrutLevel } = parseTypeKashrut(
      typeLine,
      fullBlock,
    );

    // Address / city
    let street = '';
    let hebrewCity = 'תל אביב';

    if (addrLines.length > 0) {
      const ext = extractCityFromAddress(addrLines[0]);
      street = ext.street;
      hebrewCity = ext.hebrewCity || hebrewCity;
    } else {
      for (const l of nameLines) {
        if (KNOWN_CITIES_HE.has(l)) {
          hebrewCity = l;
          break;
        }
      }
    }

    const { city, country, destination } = resolveCity(hebrewCity);
    const address = street
      ? `${street}, ${hebrewCity}, Israel`
      : `${hebrewCity}, Israel`;

    results.push({
      name,
      address,
      city,
      country,
      phone: phone || undefined,
      kashrutLevel,
      foodType,
      category,
      destinationName: destination,
    });
  }

  return results;
}

// ─── Nominatim geocoder ───────────────────────────────────────────────────────

interface GeoResult {
  lat: number;
  lng: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
}

async function geocode(
  name: string,
  address: string,
  city: string,
  country: string,
): Promise<GeoResult | null> {
  const strategies = [
    address,
    `${name}, ${address}`,
    `${name}, ${city}, ${country}`,
    `${address.split(',')[0]}, ${city}, ${country}`,
    `${city}, ${country}`,
  ];

  for (const q of strategies) {
    await new Promise((r) => setTimeout(r, 1100)); // Nominatim ToS: 1 req/sec
    try {
      const res = await axios.get(
        'https://nominatim.openstreetmap.org/search',
        {
          params: { q, format: 'json', limit: 1, addressdetails: 0 },
          headers: {
            'User-Agent': 'JewishOnTheWay/1.0 (meryl.hasid@gmail.com)',
          },
          timeout: 10000,
        },
      );
      const hits = res.data as NominatimResult[];
      if (hits.length > 0) {
        return { lat: parseFloat(hits[0].lat), lng: parseFloat(hits[0].lon) };
      }
    } catch {
      // try next strategy
    }
  }
  return null;
}

// ─── Ensure required columns exist (idempotent) ──────────────────────────────

async function ensureSchema(): Promise<void> {
  const stmts = [
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS city CHARACTER VARYING(128)`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS country CHARACTER VARYING(128)`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone CHARACTER VARYING(32)`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ`,
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS category CHARACTER VARYING(128)`,
    `ALTER TABLE restaurants ALTER COLUMN location DROP NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_restaurants_location_gist ON restaurants USING GIST (location)`,
    `CREATE INDEX IF NOT EXISTS idx_restaurants_country_city ON restaurants (country, city)`,
  ];
  for (const sql of stmts) {
    try {
      await AppDataSource.query(sql);
    } catch {
      // already exists — fine
    }
  }
  console.log('Schema verified.\n');
}

// ─── Import logic ─────────────────────────────────────────────────────────────

async function importRestaurants(parsed: ParsedRestaurant[]): Promise<void> {
  const destRepo = AppDataSource.getRepository(Destination);
  const destCache = new Map<string, number>();

  let inserted = 0,
    skipped = 0,
    noGeo = 0;

  for (const r of parsed) {
    // Resolve destination
    const destKey = r.destinationName.toLowerCase();
    let destId = destCache.get(destKey);
    if (destId === undefined) {
      const dest = await destRepo
        .createQueryBuilder('d')
        .where('LOWER(d.name) = :name', { name: destKey })
        .getOne();
      if (!dest) {
        console.warn(
          `  ✗ Destination not found: "${r.destinationName}" — skipping ${r.name}`,
        );
        skipped++;
        continue;
      }
      destCache.set(destKey, dest.id);
      destId = dest.id;
    }

    // Skip duplicates — raw SQL to avoid entity metadata dependency
    const dupRows = await AppDataSource.query<{ id: number }[]>(
      `SELECT id FROM restaurants WHERE name = $1 AND city = $2 LIMIT 1`,
      [r.name, r.city],
    );
    if (dupRows.length > 0) {
      skipped++;
      continue;
    }

    // Geocode
    console.log(`  → Geocoding: ${r.name} (${r.city})`);
    const geo = await geocode(r.name, r.address, r.city, r.country);
    if (!geo) {
      console.warn(`    ✗ Could not geocode — inserting without coordinates`);
      noGeo++;
    }

    // Insert via raw SQL — independent of TypeORM entity column cache
    const insertResult = await AppDataSource.query<{ id: number }[]>(
      `INSERT INTO restaurants
         (name, address, city, country, phone, kashrut_level, restaurant_type,
          category, is_kosher, lat, lng, "destinationId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        r.name,
        r.address,
        r.city,
        r.country,
        r.phone ?? null,
        r.kashrutLevel,
        r.foodType === 'unknown' ? null : r.foodType,
        r.category,
        true,
        geo?.lat ?? null,
        geo?.lng ?? null,
        destId,
      ],
    );

    const savedId = insertResult[0].id;

    // PostGIS geography column
    if (geo) {
      await AppDataSource.query(
        `UPDATE restaurants
            SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
          WHERE id = $3`,
        [geo.lng, geo.lat, savedId],
      );
    }

    inserted++;
    console.log(`    ✓ Saved: ${r.name}`);
  }

  console.log(
    `\nDone. Inserted: ${inserted} | Skipped: ${skipped} | No-geo: ${noGeo}`,
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const inputFile = process.argv[2] ?? 'restaurants-raw.txt';
  const rawPath = path.isAbsolute(inputFile)
    ? inputFile
    : path.join(__dirname, inputFile);
  if (!fs.existsSync(rawPath)) {
    console.error(`Input file not found: ${rawPath}`);
    process.exit(1);
  }

  const rawText = fs.readFileSync(rawPath, 'utf8');
  console.log('Parsing raw restaurant data…');
  const parsed = parseRawData(rawText);
  console.log(`Parsed ${parsed.length} restaurants.\n`);

  await AppDataSource.initialize();
  console.log('DB connected.\n');

  await ensureSchema();
  await importRestaurants(parsed);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
