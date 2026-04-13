import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { SearchFeedback } from './search-feedback.entity';

export interface ClassifiedQuery {
  /** Cleaned keyword for name ILIKE search */
  keyword: string | undefined;
  /** Detected restaurant type: meat | dairy | pareve */
  type: string | undefined;
  /** Detected kashrut level: rabbinate | mehadrin | badatz */
  kashrut: string | undefined;
}

interface AiResult {
  type: string | null;
  kashrut: string | null;
  keyword: string | null;
}

// req 4.3.1 — AI classifier that extracts search parameters from free text
// req 4.3.2 — returns partial results when only some details are detected
// Learns from user click behaviour via SearchFeedback few-shot examples
@Injectable()
export class SearchClassifierService {
  private readonly logger = new Logger(SearchClassifierService.name);
  private readonly client: Anthropic | null;

  constructor(
    @InjectRepository(SearchFeedback)
    private readonly feedbackRepo: Repository<SearchFeedback>,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set — falling back to rule-based classifier',
      );
    }
  }

  async classify(query: string): Promise<ClassifiedQuery> {
    if (this.client) {
      try {
        return await this.classifyWithAI(query);
      } catch (err) {
        this.logger.error(
          `Claude classify failed, falling back to rules: ${err}`,
        );
      }
    }
    return this.classifyWithRules(query);
  }

  // ── AI path ──────────────────────────────────────────────────────────────

  private async classifyWithAI(query: string): Promise<ClassifiedQuery> {
    // Fetch the 10 most recent clicks as few-shot examples so Claude learns from real users
    const examples = await this.feedbackRepo.find({
      where: { clickedRestaurantName: Not(IsNull()) },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    let fewShotBlock = '';
    if (examples.length > 0) {
      fewShotBlock = `\nHere are recent searches and the restaurant users actually chose — use these as learning examples:\n`;
      for (const ex of examples) {
        fewShotBlock += `- Query: "${ex.query}" → User clicked: "${ex.clickedRestaurantName}" (type: ${ex.clickedRestaurantType ?? 'unknown'}, kashrut: ${ex.clickedRestaurantKashrut ?? 'unknown'})\n`;
      }
      fewShotBlock += `\nUse these patterns to improve your classifications.\n`;
    }

    const systemPrompt = `You are a kosher restaurant search classifier for a Jewish travel app.
Your job is to extract structured search parameters from a user's free-text query.

Extract:
- type: one of "meat", "dairy", "pareve", or null
- kashrut: one of "rabbinate", "mehadrin", "badatz", or null
- keyword: any remaining search term (restaurant name, cuisine style, etc.), or null

Rules:
- meat/fleish/fleishig/steak/burger/grill/bbq/chicken/beef → type: "meat"
- dairy/milchig/milk/cheese/pizza/pasta/cafe/coffee/ice cream → type: "dairy"
- pareve/parve/fish/sushi/vegan/vegetarian → type: "pareve"
- badatz/strictly kosher/glatt → kashrut: "badatz"
- mehadrin → kashrut: "mehadrin"
- rabbinate/rabanut/regular kosher/kosher → kashrut: "rabbinate"
- Strip classification words from keyword; keep only the actual search term${fewShotBlock}

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{"type": "meat"|"dairy"|"pareve"|null, "kashrut": "rabbinate"|"mehadrin"|"badatz"|null, "keyword": "string"|null}`;

    const response = await this.client!.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      system: systemPrompt,
      messages: [
        { role: 'user', content: `Classify this search query: "${query}"` },
      ],
    });

    const text = (
      response.content[0] as { type: string; text: string }
    ).text.trim();
    const parsed = JSON.parse(text) as AiResult;

    return {
      type: parsed.type ?? undefined,
      kashrut: parsed.kashrut ?? undefined,
      keyword: parsed.keyword ?? undefined,
    };
  }

  // ── Rule-based fallback ───────────────────────────────────────────────────

  private readonly TYPE_PATTERNS: [RegExp, string][] = [
    [/\b(meat|fleish|fleishig|steak|burger|grill|bbq|chicken|beef)\b/i, 'meat'],
    [
      /\b(dairy|milchig|milk|cheese|pizza|pasta|cafe|coffee|ice.?cream)\b/i,
      'dairy',
    ],
    [/\b(pareve|parve|fish|sushi|vegan|vegetarian)\b/i, 'pareve'],
  ];

  private readonly KASHRUT_PATTERNS: [RegExp, string][] = [
    [/\b(badatz|bd"tz|strictly kosher|glatt)\b/i, 'badatz'],
    [/\b(mehadrin|mehad[ae]rin)\b/i, 'mehadrin'],
    [/\b(rabbinate|rabbanut|regular kosher|kosher|kasher)\b/i, 'rabbinate'],
  ];

  private readonly STOP_WORDS = new Set([
    'kosher',
    'kasher',
    'restaurant',
    'restaurants',
    'food',
    'eat',
    'eating',
    'place',
    'places',
    'near',
    'me',
    'find',
    'looking',
    'for',
    'want',
    'a',
    'an',
    'the',
    'in',
    'at',
    'with',
    'and',
    'or',
    'that',
    'is',
    'are',
    'any',
    'meat',
    'dairy',
    'pareve',
    'parve',
    'fish',
    'mehadrin',
    'badatz',
    'rabbinate',
    'rabanut',
    'glatt',
    'fleish',
    'fleishig',
    'milchig',
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
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !this.STOP_WORDS.has(w));
    return words.length > 0 ? words.join(' ') : undefined;
  }
}
