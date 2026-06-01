/**
 * SearchController
 * ================
 * Endpoint: POST /search
 *
 * Pipeline של שני מודלים:
 *   Model 1 (ClassifierService)      → קטגוריה (restaurant/synagogue/minyan/hosting)
 *   Model 2 (DenominationClassifier) → נוסח    (ashkenaz/sfarad/chabad/teimanim)
 *                                       רלוונטי רק כשקטגוריה = synagogue/minyan
 */

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, MaxLength, MinLength } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassifierService } from './classifier.service';
import { DenominationClassifierService } from './denomination-classifier.service';
import { Destination } from '../destination.entity';

class SearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  text!: string;

  @IsOptional()
  @IsNumber()
  destinationId?: number;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}

// מילון תרגום ערים נפוצות עברית → אנגלית
const CITY_TRANSLATE: Record<string, string> = {
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

// מילון תרגום שמות מדינות עברית → אנגלית (לפי עמודת country בDB)
const COUNTRY_TRANSLATE: Record<string, string> = {
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

// Extra aliases for destinations that are present in the DB but are not covered by CITY_TRANSLATE.
// This remains code-only intentionally: no migration/table is required before submission.
const DESTINATION_ALIASES: Record<string, string[]> = {
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
  // Harmless if Rhodes is not currently in the DB; useful if it is added later.
  Rhodes: ['רודוס', 'rodos'],
};

const DESTINATION_STOP_WORDS = new Set([
  'בית', 'כנסת', 'בית כנסת', 'מסעדה', 'מסעדת', 'כשר', 'כשרה', 'כשרים',
  'אוכל', 'לאכול', 'ארוחה', 'מניין', 'מנין', 'שחרית', 'מנחה', 'מעריב',
  'תפילה', 'תפילת', 'אירוח', 'שבת', 'משפחה', 'מחפש', 'מחפשת', 'צריך',
  'צריכה', 'איפה', 'אפשר', 'קרוב', 'קרובה', 'אליי', 'לידי', 'באזור',
  'נוסח', 'קהילה', 'יהודית',
  'synagogue', 'restaurant', 'kosher', 'minyan', 'hosting', 'host',
  'near', 'nearby', 'me', 'in', 'at', 'the',
]);

interface DestinationResolution {
  destination: Destination | null;
  explicitMention: boolean;
}

// מילות מפתח לסוג מסעדה וכשרות
const RESTAURANT_TYPE_KEYWORDS: Record<string, string> = {
  'בשרי':'meat','בשרית':'meat','בשר':'meat','meat':'meat',
  'חלבי':'dairy','חלבית':'dairy','חלב':'dairy','dairy':'dairy','milky':'dairy',
  'פרווה':'parve','פרוה':'parve','parve':'parve','pareve':'parve',
};
const KASHRUT_KEYWORDS: Record<string, string> = {
  'מהדרין':'mehadrin','mehadrin':'mehadrin',
  'בדץ':'badatz','badatz':'badatz',
  'רבנות':'rabbinate','rabbinate':'rabbinate',
};

function extractRestaurantFilters(text: string): { type: string | null; kashrut: string | null } {
  const lower = text.toLowerCase();
  let type: string | null = null;
  let kashrut: string | null = null;
  for (const [kw, val] of Object.entries(RESTAURANT_TYPE_KEYWORDS)) {
    if (lower.includes(kw)) { type = val; break; }
  }
  for (const [kw, val] of Object.entries(KASHRUT_KEYWORDS)) {
    if (lower.includes(kw)) { kashrut = val; break; }
  }
  return { type, kashrut };
}

const SFARAD_DENOMINATION_PATTERNS = [
  /(?:^|[\s,.;:!?])נוסח\s+ספרד(?:$|[\s,.;:!?])/,
  /(?:^|[\s,.;:!?])ספרדי(?:$|[\s,.;:!?])/,
  /(?:^|[\s,.;:!?])ספרדית(?:$|[\s,.;:!?])/,
  /(?:^|[\s,.;:!?])ספרדים(?:$|[\s,.;:!?])/,
  /(?:^|[\s,.;:!?])ספרדיות(?:$|[\s,.;:!?])/,
];

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
    return candidate.replace(/\s/g, '').length >= 4;
  }
  return candidate.length >= 4;
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
      if (!DESTINATION_STOP_WORDS.has(pair) && !DESTINATION_STOP_WORDS.has(word) && !DESTINATION_STOP_WORDS.has(nextWord)) {
        addCandidate(pair);
      }
      // גם זוג עם מילה ראשונה ללא קידומת עברית (בזכרון יעקב → זכרון יעקב)
      const wordVariants = addHebrewPrefixVariants(word);
      if (wordVariants.length > 1 && !DESTINATION_STOP_WORDS.has(word)) {
        const strippedPair = `${wordVariants[1]} ${nextWord}`;
        if (!DESTINATION_STOP_WORDS.has(strippedPair) && !DESTINATION_STOP_WORDS.has(wordVariants[1])) {
          addCandidate(strippedPair);
        }
      }
    }
  }

  return candidates;
}

export function detectCountryInText(text: string): string | null {
  const lower = text.toLowerCase();
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

@Controller('search')
export class SearchController {
  constructor(
    private readonly classifier: ClassifierService,
    private readonly denomClassifier: DenominationClassifierService,
    @InjectRepository(Destination)
    private readonly destRepo: Repository<Destination>,
  ) {}

  @Get('classify')
  classifyText(@Query('text') text: string) {
    if (!text?.trim()) return { category: null, emoji: null, denomination: null, confidence: 0 };
    const result = this.classifier.classify(text);
    if (result.confidence < 0.45) return { category: null, emoji: null, denomination: null, confidence: result.confidence };
    let denomination: string | null = null;
    let denomEmoji: string = '';
    let denomLabel: string = '';
    if (result.category === 'synagogue' || result.category === 'minyan') {
      const denomResult = this.denomClassifier.classify(text);
      if (denomResult.denomination) {
        denomination = denomResult.denomination;
        denomEmoji   = denomResult.emoji;
        denomLabel   = this.denomClassifier.getHebrewLabel(denomination);
      }
    }
    return { category: result.category, emoji: result.emoji, denomination, denomEmoji, denomLabel, confidence: result.confidence };
  }

  @Post()
  async search(@Body() dto: SearchDto) {
    const { text, destinationId } = dto;

    // ── שלב 1: Model 1 — סיווג קטגוריה ────────────────
    const result = this.classifier.classify(text);
    if (result.confidence < 0.45) {
      return { error: 'low_confidence', message: 'לא הצלחתי להבין מה אתה מחפש. נסה לכתוב למשל: "מסעדה כשרה בתל אביב"', confidence: result.confidence };
    }

    // ── שלב 2: Model 2 — סיווג נוסח (רק לבתי כנסת/מניין) ──
    let denomination: string | null = null;
    let denomEmoji:   string        = '';
    let denomLabel:   string        = '';

    if (result.category === 'synagogue' || result.category === 'minyan') {
      const denomResult = this.denomClassifier.classify(text);
      if (denomResult.denomination) {
        denomination = denomResult.denomination;
        denomEmoji   = denomResult.emoji;
        denomLabel   = this.denomClassifier.getHebrewLabel(denomination);
      }
    }

    // ── שלב 3: חילוץ פילטרים למסעדות ─────────────────
    const { type: restaurantType, kashrut: restaurantKashrut } =
      result.category === 'restaurant' ? extractRestaurantFilters(text) : { type: null, kashrut: null };

    // ── שלב 4: חיפוש עיר ──────────────────────────────
    if (destinationId) {
      return {
        ...result,
        route: this.getRoute(result.category, destinationId, denomination, restaurantType, restaurantKashrut),
        destinationId,
        denomination,
        denomEmoji,
        denomLabel,
        restaurantType,
        restaurantKashrut,
      };
    }

    const destinationResolution = await this.resolveDestinationFromText(text);
    let foundDest = destinationResolution.destination;
    let gpsUsed = false;

    if (!foundDest) {
      // בדוק אם הוזכרה מדינה → חפש parent destination לפי country
      const countryEng = detectCountryInText(text);
      if (countryEng) {
        const parentDest = await this.findParentDestinationByCountry(countryEng);
        if (parentDest) {
          const route = this.getCountryRoute(result.category, parentDest.id, restaurantType, restaurantKashrut);
          return {
            ...result,
            route,
            destinationId: parentDest.id,
            detectedCity:  parentDest.city ?? parentDest.country,
            gpsUsed:       false,
            denomination, denomEmoji, denomLabel,
            restaurantType, restaurantKashrut,
          };
        }
        // מדינה הוזכרה אבל אין בDB — לא מפעילים GPS
      } else if (!destinationResolution.explicitMention && dto.lat != null && dto.lng != null) {
        // אין עיר, אין מדינה ואין יעד מפורש שלא נפתר — נסה GPS
        foundDest = await this.findNearestDestination(dto.lat, dto.lng);
        if (foundDest) gpsUsed = true;
      }
    }

    return {
      ...result,
      route:         this.getRoute(result.category, foundDest?.id, denomination, restaurantType, restaurantKashrut),
      destinationId: foundDest?.id,
      detectedCity:  foundDest?.city ?? null,
      gpsUsed,
      denomination,
      denomEmoji,
      denomLabel,
      restaurantType,
      restaurantKashrut,
    };
  }

  // ── חיפוש parent destination לפי שם מדינה ──────────
  private async findParentDestinationByCountry(countryEng: string): Promise<Destination | null> {
    const rows = await this.destRepo.query(
      `SELECT id, city, country FROM destinations WHERE country ILIKE $1 AND parent_id IS NULL LIMIT 1`,
      [`%${countryEng}%`],
    );
    if (!rows.length) return null;
    return this.destRepo.findOne({ where: { id: rows[0].id } });
  }

  // ── חיפוש יעד בתוך הטקסט מתוך אינדקס שמות/כינויים ─────────
  private async resolveDestinationFromText(text: string): Promise<DestinationResolution> {
    const candidates = buildDestinationCandidates(text);
    const destinations = await this.loadDestinationsForSearch();
    const aliasIndex = this.buildDestinationAliasIndex(destinations);

    for (const candidate of candidates) {
      if (candidate === 'ספרד' && hasSfaradDenominationSignal(text.toLowerCase()) && !hasExplicitSpainLocation(text.toLowerCase())) {
        continue;
      }
      const destination = aliasIndex.get(candidate);
      if (destination) {
        return { destination, explicitMention: true };
      }
    }

    return {
      destination: null,
      explicitMention: candidates.some(isExplicitDestinationCandidate),
    };
  }

  private async loadDestinationsForSearch(): Promise<Destination[]> {
    return this.destRepo.find({ select: ['id', 'name', 'city', 'country'] });
  }

  private buildDestinationAliasIndex(destinations: Destination[]): Map<string, Destination> {
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

    return index;
  }

  // ── חיפוש destination הכי קרוב לפי GPS ────────────
  private async findNearestDestination(lat: number, lng: number): Promise<Destination | null> {
    const MAX_METERS = 100_000; // 100 ק"מ
    const rows = await this.destRepo.query(
      `SELECT id FROM destinations
       WHERE parent_id IS NOT NULL
         AND ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) < $3
       ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
       LIMIT 1`,
      [lng, lat, MAX_METERS],
    );
    if (!rows.length) return null;
    return this.destRepo.findOne({ where: { id: rows[0].id } });
  }

  // ── נתיב ברמת מדינה ────────────────────────────────
  private getCountryRoute(category: string, parentId: number, restaurantType?: string | null, restaurantKashrut?: string | null): string {
    switch (category) {
      case 'restaurant': {
        const params = new URLSearchParams({ fromParent: 'true' });
        if (restaurantType)    params.set('type',    restaurantType);
        if (restaurantKashrut) params.set('kashrut', restaurantKashrut);
        return `/restaurants/${parentId}?${params.toString()}`;
      }
      case 'synagogue':
      case 'minyan':
      case 'hosting':
        return `/destination/${parentId}/subdestinations`;
      default:
        return `/destination/${parentId}/subdestinations`;
    }
  }

  // ── בניית נתיב ניווט ───────────────────────────────
  private getRoute(category: string, destinationId?: number, denomination?: string | null, restaurantType?: string | null, restaurantKashrut?: string | null): string {
    if (!destinationId) return `/${category}s`;

    const denomParam = denomination ? `?denomination=${denomination}` : '';

    switch (category) {
      case 'restaurant': {
        const params = new URLSearchParams();
        if (restaurantType)    params.set('type',    restaurantType);
        if (restaurantKashrut) params.set('kashrut', restaurantKashrut);
        const qs = params.toString();
        return `/restaurants/${destinationId}${qs ? `?${qs}` : ''}`;
      }
      case 'synagogue':  return `/synagogues/${destinationId}${denomParam}`;
      case 'minyan':     return `/minyans/${destinationId}${denomParam}`;
      case 'hosting':    return `/hosting/${destinationId}`;
      default:           return '/';
    }
  }
}
