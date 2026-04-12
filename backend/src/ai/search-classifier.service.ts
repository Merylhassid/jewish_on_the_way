import { Injectable } from '@nestjs/common';

export interface ClassifiedQuery {
  /** Cleaned keyword for name ILIKE search */
  keyword: string | undefined;
  /** Detected restaurant type: meat | dairy | pareve */
  type: string | undefined;
  /** Detected kashrut level: rabbinate | mehadrin | badatz */
  kashrut: string | undefined;
}

// req 4.3.1 — rule-based text classifier that extracts search parameters from free text
// req 4.3.2 — returns partial results when only some details are detected
@Injectable()
export class SearchClassifierService {
  private readonly TYPE_PATTERNS: [RegExp, string][] = [
    [/\b(meat|fleish|fleishig|steak|burger|grill|bbq|chicken|beef)\b/i, 'meat'],
    [/\b(dairy|milchig|milk|cheese|pizza|pasta|cafe|coffee|ice.?cream)\b/i, 'dairy'],
    [/\b(pareve|parve|fish|sushi|vegan|vegetarian)\b/i, 'pareve'],
  ];

  private readonly KASHRUT_PATTERNS: [RegExp, string][] = [
    [/\b(badatz|bd"tz|strictly kosher|glatt)\b/i, 'badatz'],
    [/\b(mehadrin|mehad[ae]rin)\b/i, 'mehadrin'],
    [/\b(rabbinate|rabbanut|regular kosher|kosher|kasher)\b/i, 'rabbinate'],
  ];

  // Words that are classification signals, not search keywords
  private readonly STOP_WORDS = new Set([
    'kosher', 'kasher', 'restaurant', 'restaurants', 'food', 'eat', 'eating',
    'place', 'places', 'near', 'me', 'find', 'looking', 'for', 'want', 'a', 'an',
    'the', 'in', 'at', 'with', 'and', 'or', 'that', 'is', 'are', 'any',
    'meat', 'dairy', 'pareve', 'parve', 'fish', 'mehadrin', 'badatz', 'rabbinate',
    'rabanut', 'glatt', 'fleish', 'fleishig', 'milchig',
  ]);

  classify(query: string): ClassifiedQuery {
    const q = query.trim();

    const type = this.detect(q, this.TYPE_PATTERNS);
    const kashrut = this.detect(q, this.KASHRUT_PATTERNS);

    // Strip classification tokens to get the remaining keyword
    const keyword = this.extractKeyword(q);

    return { keyword, type, kashrut };
  }

  private detect(text: string, patterns: [RegExp, string][]): string | undefined {
    for (const [re, label] of patterns) {
      if (re.test(text)) return label;
    }
    return undefined;
  }

  private extractKeyword(text: string): string | undefined {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !this.STOP_WORDS.has(w));

    return words.length > 0 ? words.join(' ') : undefined;
  }
}
