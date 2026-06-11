import { Injectable, Logger } from '@nestjs/common';

export interface ClassifiedQuery {
  /** Cleaned keyword for name ILIKE search */
  keyword: string | undefined;
  /** Detected restaurant type: meat | dairy | pareve */
  type: string | undefined;
  /** Detected kashrut level: rabbinate | mehadrin | badatz */
  kashrut: string | undefined;
}

// req 4.3.1 — rule-based classifier that extracts restaurant search parameters
//             (type / kashrut / keyword) from free text
// req 4.3.2 — returns partial results when only some details are detected
// NOTE: this is a secondary filter extractor for restaurant search. The primary
// free-text category model is ClassifierService (TF-IDF + Naive Bayes, our own).
@Injectable()
export class SearchClassifierService {
  private readonly logger = new Logger(SearchClassifierService.name);

  // eslint-disable-next-line @typescript-eslint/require-await
  async classify(query: string): Promise<ClassifiedQuery> {
    return this.classifyWithRules(query);
  }

  // ── Rule-based classifier ─────────────────────────────────────────────────

  private readonly TYPE_PATTERNS: [RegExp, string][] = [
    [/\b(meat|fleish|fleishig|steak|burger|grill|bbq|chicken|beef)\b/i, 'meat'],
    [/\b(dairy|milchig|milk|cheese|pizza|pasta|cafe|coffee|ice.?cream)\b/i, 'dairy'],
    [/\b(pareve|parve|fish|sushi|vegan|vegetarian)\b/i, 'pareve'],
    // Hebrew
    [/בשרי|בשרית|המבורגר|בורגר|שווארמה|סטייק|קבב|אסאדו|שניצל|עוף/, 'meat'],
    [/חלבי|חלבית|פיצה|פסטה|קפה|גלידה|לאזניה|וופל|בורקס/, 'dairy'],
    [/פרווה|פרוה|סושי|דגים|פלאפל|חומוס|טבעוני|צמחוני/, 'pareve'],
  ];

  private readonly KASHRUT_PATTERNS: [RegExp, string][] = [
    [/\b(badatz|bd"tz|strictly kosher|glatt)\b/i, 'badatz'],
    [/\b(mehadrin|mehad[ae]rin)\b/i, 'mehadrin'],
    [/\b(rabbinate|rabbanut|regular kosher|kosher|kasher)\b/i, 'rabbinate'],
    // Hebrew
    [/בד["״]?ץ|בדץ/, 'badatz'],
    [/מהדרין/, 'mehadrin'],
    [/רבנות|כשר|כשרה/, 'rabbinate'],
  ];

  private readonly STOP_WORDS = new Set([
    'kosher', 'kasher', 'restaurant', 'restaurants', 'food', 'eat', 'eating',
    'place', 'places', 'near', 'me', 'find', 'looking', 'for', 'want',
    'a', 'an', 'the', 'in', 'at', 'with', 'and', 'or', 'that', 'is', 'are',
    'any', 'meat', 'dairy', 'pareve', 'parve', 'fish', 'mehadrin', 'badatz',
    'rabbinate', 'rabanut', 'glatt', 'fleish', 'fleishig', 'milchig',
    'where', 'can', 'i', 'to', 'around', 'nearby', 'hotel', 'cheap', 'family',
    'luxury', 'good', 'best', 'please',
    // Hebrew
    'מסעדה', 'מסעדות', 'כשר', 'כשרה', 'כשרים', 'בשרי', 'חלבי', 'פרווה',
    'רוצה', 'מחפש', 'מחפשת', 'אני', 'יש', 'אין', 'קרוב', 'קרובה',
    'איפה', 'אפשר', 'לאכול', 'אוכל', 'אוכלים', 'לאכל', 'בא', 'לי', 'ליד', 'המלון', 'מלון', 'באזור', 'סביב',
    'זול', 'זולה', 'יוקרתי', 'יוקרתית', 'משפחתי', 'משפחתית', 'טוב', 'טובה',
  ]);

  private classifyWithRules(query: string): ClassifiedQuery {
    const q = query.trim();
    const type = this.detect(q, this.TYPE_PATTERNS);
    const kashrut = this.detect(q, this.KASHRUT_PATTERNS);
    const keyword = this.extractKeyword(q);
    return { keyword, type, kashrut };
  }

  private detect(
    text: string,
    patterns: [RegExp, string][],
  ): string | undefined {
    for (const [re, label] of patterns) {
      if (re.test(text)) return label;
    }
    return undefined;
  }

  private extractKeyword(text: string): string | undefined {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9֐-׿\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !this.STOP_WORDS.has(w));
    return words.length > 0 ? words.join(' ') : undefined;
  }
}
