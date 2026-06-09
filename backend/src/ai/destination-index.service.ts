import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Destination } from '../destination.entity';

// ── Translation dictionaries ─────────────────────────────────────────────────

export const CITY_TRANSLATE: Record<string, string> = {
  // ישראל — שמות מלאים
  'תל אביב': 'Tel Aviv',
  'ירושלים': 'Jerusalem',
  'חיפה': 'Haifa',
  'אשקלון': 'Ashkelon',
  'אשדוד': 'Ashdod',
  'נתניה': 'Netanya',
  'ראשון לציון': 'Rishon LeZion',
  'פתח תקווה': 'Petah Tikva',
  'פתח תקוה': 'Petah Tikva',
  'רמת גן': 'Ramat Gan',
  'באר שבע': 'Beer Sheva',
  'רחובות': 'Rehovot',
  'בת ים': 'Bat Yam',
  'הרצליה': 'Herzliya',
  'רעננה': 'Raanana',
  'ראש העין': 'Rosh HaAyin',
  'מודיעין': 'Modi\'in',
  'רמלה': 'Ramla',
  'לוד': 'Lod',
  'אילת': 'Eilat',
  'יבנה': 'Yavne',
  'נס ציונה': 'Nes Ziona',
  'הוד השרון': 'Hod HaSharon',
  'כפר סבא': 'Kfar Saba',
  'רמת השרון': 'Ramat HaSharon',
  'יהוד': 'Yehud',
  'עפולה': 'Afula',
  'טבריה': 'Tiberias',
  'נהריה': 'Nahariya',
  'קריית שמונה': 'Kiryat Shmona',
  'קרית שמונה': 'Kiryat Shmona',
  'דימונה': 'Dimona',
  'שדרות': 'Sderot',
  'נתיבות': 'Netivot',
  'בני ברק': 'Bnei Brak',
  'גבעתיים': 'Givatayim',
  'גבעת שמואל': 'Givat Shmuel',
  'חדרה': 'Hadera',
  'קרית אתא': 'Kiryat Ata',
  'קריית אתא': 'Kiryat Ata',
  'קרית ביאליק': 'Kiryat Bialik',
  'קריית ביאליק': 'Kiryat Bialik',
  'קרית מוצקין': 'Kiryat Motzkin',
  'קריית מוצקין': 'Kiryat Motzkin',
  'קרית גת': 'Kiryat Gat',
  'קריית גת': 'Kiryat Gat',
  'קרית אונו': 'Kiryat Ono',
  'קריית אונו': 'Kiryat Ono',
  'גדרה': 'Gedera',
  'גן יבנה': 'Gan Yavne',
  'מעלה אדומים': 'Maale Adumim',
  'מזכרת בתיה': 'Mazkeret Batya',
  'מבשרת ציון': 'Mevaseret Zion',
  'מגדל העמק': 'Migdal HaEmek',
  'אור יהודה': 'Or Yehuda',
  'פרדס חנה': 'Pardes Hanna',
  'פרדס חנה כרכור': 'Pardes Hanna',
  'ראש פינה': 'Rosh Pina',
  'זכרון יעקב': 'Zichron Yaakov',
  'יקנעם': 'Yokneam',
  'קיסריה': 'Caesarea',
  'שוהם': 'Shoham',
  'סביון': 'Savyon',
  'אור עקיבא': 'Or Akiva',
  'טירת כרמל': 'Tirat Carmel',
  'עכו': 'Acre',
  'נצרת עילית': 'Nof HaGalil',
  'נוף הגליל': 'Nof HaGalil',
  'אריאל': 'Ariel',
  'מודיעין עילית': 'Modi\'in Illit',
  'ביתר עילית': 'Beitar Illit',
  'בית שמש': 'Beit Shemesh',
  // ישראל — כינויים קצרים
  'ראשון': 'Rishon LeZion',
  'פתח': 'Petah Tikva',
  'מבשרת': 'Mevaseret Zion',
  'מעלה': 'Maale Adumim',
  // כינויים קצרים לערים בינלאומיות
  'לוס': 'Los Angeles',
  'ניו': 'New York',
  'סאו': 'Sao Paulo',
  'הונג': 'Hong Kong',
  'בואנוס': 'Buenos Aires',
  // אירופה
  'לונדון': 'London',
  'פריז': 'Paris',
  'ברלין': 'Berlin',
  'אמסטרדם': 'Amsterdam',
  'רומא': 'Rome',
  'ברצלונה': 'Barcelona',
  'מדריד': 'Madrid',
  'וינה': 'Vienna',
  'וורשה': 'Warsaw',
  'קרקוב': 'Krakow',
  'בודפשט': 'Budapest',
  'פראג': 'Prague',
  'בריסל': 'Brussels',
  'ציריך': 'Zurich',
  'ז\'נבה': 'Geneva',
  'קופנהגן': 'Copenhagen',
  'סטוקהולם': 'Stockholm',
  'אוסלו': 'Oslo',
  'הלסינקי': 'Helsinki',
  'ליסבון': 'Lisbon',
  'בוקרשט': 'Bucharest',
  'זגרב': 'Zagreb',
  'סלוניקי': 'Thessaloniki',
  'אתונה': 'Athens',
  'דובלין': 'Dublin',
  'מנצ\'סטר': 'Manchester',
  // אמריקה
  'ניו יורק': 'New York',
  'מיאמי': 'Miami',
  'לוס אנג\'לס': 'Los Angeles',
  'שיקגו': 'Chicago',
  'בוסטון': 'Boston',
  'טורונטו': 'Toronto',
  'מונטריאול': 'Montreal',
  'סאו פאולו': 'Sao Paulo',
  'ריו': 'Rio de Janeiro',
  'בואנוס איירס': 'Buenos Aires',
  // אסיה ואוקיאניה
  'בנגקוק': 'Bangkok',
  'פוקט': 'Phuket',
  'קוסמוי': 'Koh Samui',
  'טוקיו': 'Tokyo',
  'סינגפור': 'Singapore',
  'הונג קונג': 'Hong Kong',
  'דובאי': 'Dubai',
  'סידני': 'Sydney',
  'מלבורן': 'Melbourne',
  'מומבאי': 'Mumbai',
  'ניו דלהי': 'New Delhi',
  // אפריקה
  'יוהנסבורג': 'Johannesburg',
  'קייפטאון': 'Cape Town',
  'קזבלנקה': 'Casablanca',
};

export const COUNTRY_TRANSLATE: Record<string, string> = {
  'תאילנד':'Thailand','צרפת':'France','גרמניה':'Germany','ספרד':'Spain',
  'איטליה':'Italy','יוון':'Greece','יפן':'Japan','סין':'China','הודו':'India',
  'טורקיה':'Turkey','אנגליה':'United Kingdom','בריטניה':'United Kingdom',
  'פולין':'Poland','הונגריה':'Hungary','אוסטריה':'Austria','שוויץ':'Switzerland',
  'בלגיה':'Belgium','הולנד':'Netherlands','פורטוגל':'Portugal','רוסיה':'Russia',
  'מרוקו':'Morocco','ברזיל':'Brazil','ארגנטינה':'Argentina','קנדה':'Canada',
  'אוסטרליה':'Australia','מקסיקו':'Mexico','ארצות הברית':'United States',
  'אמריקה':'United States','שוודיה':'Sweden','נורווגיה':'Norway',
  'דנמרק':'Denmark','פינלנד':'Finland','רומניה':'Romania','בולגריה':'Bulgaria',
  'קרואטיה':'Croatia','אוקראינה':'Ukraine','דרום אפריקה':'South Africa',
  'ישראל':'Israel',
};

export const DESTINATION_ALIASES: Record<string, string[]> = {
  Porto: ['פורטו'],
  Cannes: ['קאן'],
  Nice: ['ניס', 'ניצה'],
  Cyprus: ['קפריסין'],
  Larnaca: ['לרנקה'],
  Limassol: ['לימסול'],
  Paphos: ['פאפוס', 'פפוס'],
  Marrakech: ['מרקש', 'מרקאש'],
  'Czech Republic': ['צכיה', 'צ׳כיה', "צ'כיה"],
  Dallas: ['דאלאס', 'דלס'],
  'Las Vegas': ['לאס וגאס', 'וגאס'],
  'Chiang Mai': ['צאנג מאי', 'צ׳אנג מאי', "צ'אנג מאי"],
  'Ko Samui': ['קוסמוי', 'קו סמוי'],
  'Koh Phangan': ['קופנגן', 'קו פנגן'],
  Pai: ['פאי'],
  Akko: ['עכו'],
  "Be'er Yaakov": ['באר יעקב'],
  "Beit She'an": ['בית שאן'],
  Binyamina: ['בנימינה'],
  Holon: ['חולון'],
  Karmiel: ['כרמיאל'],
  Katzrin: ['קצרין'],
  "Ma'alot": ['מעלות', 'מעלות תרשיחא'],
  Nesher: ['נשר'],
  'Ness Ziona': ['נס ציונה'],
  Ofakim: ['אופקים'],
  Modiin: ['מודיעין'],
  Safed: ['צפת'],
  Savion: ['סביון'],
  'Tel Mond': ['תל מונד'],
  Ireland: ['אירלנד'],
  UAE: ['איחוד האמירויות', 'האמירויות', 'אמירויות'],
  Rhodes: ['רודוס', 'rodos'],
};

export const DESTINATION_STOP_WORDS = new Set([
  'בית', 'בתי', 'כנסת', 'בית כנסת', 'בתי כנסת', 'מסעדה', 'מסעדת', 'כשר', 'כשרה', 'כשרים',
  'אוכל', 'לאכול', 'ארוחה', 'ארוחת', 'מניין', 'מנין', 'שחרית', 'מנחה', 'מעריב',
  'תפילה', 'תפילת', 'אירוח', 'שבת', 'משפחה', 'מחפש', 'מחפשת', 'צריך',
  'צריכה', 'איפה', 'אפשר', 'קרוב', 'קרובה', 'אליי', 'לידי', 'באזור',
  'נוסח', 'קהילה', 'יהודית', 'מקום', 'טוב', 'טובה', 'כשרה', 'מומלצת',
  // Hebrew food / kashrut terms — not city names; prevent GPS-fallback block
  'פיצה', 'המבורגר', 'מבורגר', 'בורגר', 'שווארמה', 'סושי', 'קפה', 'גלידה',
  'פלאפל', 'חומוס', 'סטייק', 'שניצל', 'דגים', 'קבב', 'אסאדו', 'פסטה',
  'בורקס', 'וופל', 'לאזניה', 'טבעוני', 'טבעונית', 'בשרי', 'חלבי', 'בשרית', 'חלבית',
  'שוקולד', 'ממתקים', 'מתוקים', 'עוגיות', 'מאפה', 'מאפים', 'קרואסון', 'בייגל', 'סנדוויץ', 'נודלס',
  'חלה', 'פיתה', 'לחם', 'גבינה', 'יוגורט', 'שקשוקה', 'חביתה', 'אומלט',
  'ריזוטו', 'ניוקי', 'קארי', 'ראמן', 'פוקה', 'טאקו', 'בוריטו', 'נאן',
  'מרק', 'תבשיל', 'אורז', 'קינוח', 'קינוחים', 'מנה', 'מנות',
  'עוף', 'מנגל', 'בשר', 'סלט', 'עוגה', 'חלב', 'פרווה', 'פרוה', 'מהדרין', 'בדץ', 'רבנות',
  'צמחוני', 'צמחונית', 'גלוטן', 'ללא', 'מטבח', 'אסיאתי', 'אסייתי',
  // Additional kashrut / quality adjectives that aren't cities
  'מהדרין', 'בדץ', 'רבנות',
  // English food/restaurant terms — prevent GPS-fallback block
  'synagogue', 'restaurant', 'kosher', 'minyan', 'hosting', 'host',
  'near', 'nearby', 'me', 'in', 'at', 'the',
  'food', 'eat', 'pizza', 'burger', 'hamburger', 'shawarma', 'sushi', 'kebab',
  'schnitzel', 'pasta', 'cafe', 'coffee', 'grill', 'bbq', 'falafel', 'hummus',
  'chicken', 'steak', 'vegan', 'salad', 'bakery', 'fish', 'meat', 'dairy', 'pareve',
  'vegetarian', 'dinner', 'breakfast', 'lunch', 'waffle', 'ice', 'cream',
]);

const SFARAD_DENOMINATION_PATTERNS = [
  /(?:^|[\s,.;:!?])נוסח\s+ספרד(?:$|[\s,.;:!?])/,
  /(?:^|[\s,.;:!?])ספרדי(?:$|[\s,.;:!?])/,
  /(?:^|[\s,.;:!?])ספרדית(?:$|[\s,.;:!?])/,
  /(?:^|[\s,.;:!?])ספרדים(?:$|[\s,.;:!?])/,
  /(?:^|[\s,.;:!?])ספרדיות(?:$|[\s,.;:!?])/,
];

// ── Pure helper functions ────────────────────────────────────────────────────

export function normalizeDestinationText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[׳']/g, '')
    .replace(/[״"]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/[.,;:!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasHebrewLetters(text: string): boolean {
  return /[א-ת]/.test(text);
}

function addHebrewPrefixVariants(token: string): string[] {
  const variants = [token];
  if (/^[בלמ][א-ת]{2,}$/.test(token)) {
    variants.push(token.slice(1));
  }
  return variants;
}

function isSfaradDenominationCandidate(candidate: string): boolean {
  return candidate === 'ספרדי' || candidate === 'ספרדית' || candidate === 'נוסח ספרד';
}

function isExplicitDestinationCandidate(candidate: string): boolean {
  if (!candidate || DESTINATION_STOP_WORDS.has(candidate) || isSfaradDenominationCandidate(candidate)) {
    return false;
  }
  if (hasHebrewLetters(candidate)) {
    return candidate.replace(/\s/g, '').length >= 3;
  }
  return candidate.length >= 3;
}

export function buildDestinationCandidates(text: string): string[] {
  const normalized = normalizeDestinationText(text);
  if (!normalized) return [];

  const candidates: string[] = [];
  const seen = new Set<string>();
  const addCandidate = (candidate: string) => {
    const normalizedCandidate = normalizeDestinationText(candidate);
    if (!normalizedCandidate || seen.has(normalizedCandidate)) return;
    seen.add(normalizedCandidate);
    candidates.push(normalizedCandidate);
  };

  const words = normalized.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!DESTINATION_STOP_WORDS.has(word)) {
      for (const variant of addHebrewPrefixVariants(word)) {
        addCandidate(variant);
      }
    }

    if (i < words.length - 1) {
      const nextWord = words[i + 1];
      const pair = `${word} ${nextWord}`;
      // Generate pair only if the pair itself is not a stop word AND at least one word is not
      // a stop word. This lets "בית שמש" through ("שמש" is not a stop word) while blocking
      // "בורקס קרוב" (both words are stop words → not a city).
      if (!DESTINATION_STOP_WORDS.has(pair) && (!DESTINATION_STOP_WORDS.has(word) || !DESTINATION_STOP_WORDS.has(nextWord))) {
        addCandidate(pair);
      }
      const wordVariants = addHebrewPrefixVariants(word);
      if (wordVariants.length > 1 && !DESTINATION_STOP_WORDS.has(word)) {
        const strippedPair = `${wordVariants[1]} ${nextWord}`;
        if (!DESTINATION_STOP_WORDS.has(strippedPair)) {
          addCandidate(strippedPair);
        }
      }
    }
  }

  return candidates;
}

function hasSfaradDenominationSignal(text: string): boolean {
  return SFARAD_DENOMINATION_PATTERNS.some((pattern) => pattern.test(text));
}

function hasExplicitSpainLocation(text: string): boolean {
  return /(?:^|[\s,.;:!?])(?:ב|ל)ספרד(?:$|[\s,.;:!?])/.test(text);
}

function hasHebrewCountryToken(text: string, countryHeb: string): boolean {
  const escaped = countryHeb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[\\s,.;:!?])${escaped}(?:$|[\\s,.;:!?])`).test(text);
}

const ENGLISH_COUNTRY_NAMES: Record<string, string> = {
  'italy': 'Italy', 'uae': 'UAE', 'spain': 'Spain', 'portugal': 'Portugal',
  'france': 'France', 'cyprus': 'Cyprus', 'morocco': 'Morocco',
  'czech republic': 'Czech Republic', 'czechia': 'Czech Republic',
  'united kingdom': 'United Kingdom', 'uk': 'United Kingdom',
  'ireland': 'Ireland', 'greece': 'Greece', 'turkey': 'Turkey',
  'germany': 'Germany', 'austria': 'Austria', 'poland': 'Poland',
  'hungary': 'Hungary', 'romania': 'Romania', 'croatia': 'Croatia',
  'ukraine': 'Ukraine', 'thailand': 'Thailand', 'japan': 'Japan',
  'china': 'China', 'india': 'India', 'australia': 'Australia',
  'canada': 'Canada', 'brazil': 'Brazil', 'argentina': 'Argentina',
  'united states': 'United States', 'usa': 'United States',
  'south africa': 'South Africa', 'switzerland': 'Switzerland',
  'belgium': 'Belgium', 'netherlands': 'Netherlands', 'sweden': 'Sweden',
  'norway': 'Norway', 'denmark': 'Denmark', 'finland': 'Finland',
};

export function detectCountryInText(text: string): string | null {
  const lower = text.toLowerCase();

  // Check English country names (longest match first to avoid 'uk' matching inside other words)
  const sortedEnglish = Object.entries(ENGLISH_COUNTRY_NAMES).sort((a, b) => b[0].length - a[0].length);
  for (const [eng, canonical] of sortedEnglish) {
    const idx = lower.indexOf(eng);
    if (idx === -1) continue;
    const before = idx === 0 || /[\s,.]/.test(lower[idx - 1]);
    const after = idx + eng.length >= lower.length || /[\s,.]/.test(lower[idx + eng.length]);
    if (before && after) return canonical;
  }

  for (const [heb, eng] of Object.entries(COUNTRY_TRANSLATE)) {
    const countryHeb = heb.toLowerCase();
    if (countryHeb === 'ספרד') {
      if (hasSfaradDenominationSignal(lower) && !hasExplicitSpainLocation(lower)) {
        continue;
      }
      if (hasExplicitSpainLocation(lower) || hasHebrewCountryToken(lower, countryHeb)) {
        return eng;
      }
      continue;
    }
    if (lower.includes(countryHeb)) return eng;
  }
  return null;
}

// ── Standalone index builder (exported for testing) ─────────────────────────

export function buildDestinationAliasIndex(destinations: Destination[]): Map<string, Destination> {
    const index = new Map<string, Destination>();
    const canonicalIndex = new Map<string, Destination>();

    const add = (alias: string | null | undefined, destination: Destination, target = index) => {
      const normalized = normalizeDestinationText(alias ?? '');
      if (!normalized || target.has(normalized)) return;
      target.set(normalized, destination);
    };

    for (const destination of destinations) {
      add(destination.city, destination);
      add(destination.name, destination);
      add(destination.city, destination, canonicalIndex);
      add(destination.name, destination, canonicalIndex);
    }

    const findCanonical = (canonical: string): Destination | undefined =>
      canonicalIndex.get(normalizeDestinationText(canonical));

    for (const [hebrewCity, englishCity] of Object.entries(CITY_TRANSLATE)) {
      const destination = findCanonical(englishCity);
      if (destination) add(hebrewCity, destination);
    }

    for (const [hebrewCountry, englishCountry] of Object.entries(COUNTRY_TRANSLATE)) {
      const destination = findCanonical(englishCountry);
      if (destination) add(hebrewCountry, destination);
    }

    for (const [canonicalName, aliases] of Object.entries(DESTINATION_ALIASES)) {
      const destination = findCanonical(canonicalName);
      if (!destination) continue;
      for (const alias of aliases) {
        add(alias, destination);
      }
    }

    for (const [key, destination] of Array.from(index.entries())) {
      const words = key.split(/\s+/);
      if (words.length < 2) continue;
      const firstWord = words[0];
      if (firstWord.length < 3 || DESTINATION_STOP_WORDS.has(firstWord)) continue;
      if (!index.has(firstWord)) index.set(firstWord, destination);
    }

  return index;
}

// ── Levenshtein distance ─────────────────────────────────────────────────────

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

// ── DestinationIndexService ──────────────────────────────────────────────────

@Injectable()
export class DestinationIndexService implements OnModuleInit {
  private aliasIndex: Map<string, Destination> = new Map();

  constructor(
    @InjectRepository(Destination)
    private readonly destRepo: Repository<Destination>,
  ) {}

  async onModuleInit() {
    await this.rebuildIndex();
  }

  async rebuildIndex(): Promise<void> {
    // Load only city-level destinations (those with a parent).
    // Country/parent destinations are intentionally excluded: country searches
    // fall through to detectCountryInText → getCountryRoute → fromParent=true,
    // which fetches all restaurants/synagogues across that country's sub-cities.
    const destinations = await this.destRepo
      .createQueryBuilder('d')
      .select(['d.id', 'd.name', 'd.city', 'd.country'])
      .where('d.parent_id IS NOT NULL')
      .getMany();
    this.aliasIndex = buildDestinationAliasIndex(destinations);
  }

  getIndex(): Map<string, Destination> {
    return this.aliasIndex;
  }

  fuzzyMatch(candidates: string[]): Destination | null {
    const allAliases = Array.from(this.aliasIndex.entries());
    for (const candidate of candidates) {
      if (candidate.length < 3) continue;
      const threshold = candidate.length <= 5 ? 1 : 2;
      for (const [alias, dest] of allAliases) {
        if (Math.abs(alias.length - candidate.length) > threshold) continue;
        if (levenshtein(candidate, alias) <= threshold) return dest;
      }
    }
    return null;
  }
}
