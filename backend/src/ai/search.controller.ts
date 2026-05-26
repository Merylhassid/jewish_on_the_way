/**
 * SearchController
 * ================
 * Endpoint: POST /search
 *
 * מקבל טקסט חופשי → מסווג קטגוריה + מחפש עיר ב-DB → מחזיר נתיב ניווט
 */

import { Body, Controller, Post } from '@nestjs/common';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ClassifierService } from './classifier.service';
import { Destination } from '../destination.entity';

class SearchDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsNumber()
  destinationId?: number;
}

// מילון תרגום ערים נפוצות עברית → אנגלית
const CITY_TRANSLATE: Record<string, string> = {
  'תל אביב': 'Tel Aviv',
  'ירושלים': 'Jerusalem',
  'חיפה': 'Haifa',
  'אשקלון': 'Ashkelon',
  'אשדוד': 'Ashdod',
  'נתניה': 'Netanya',
  'ראשון לציון': 'Rishon LeZion',
  'פתח תקווה': 'Petah Tikva',
  'רמת גן': 'Ramat Gan',
  'באר שבע': 'Beer Sheva',
  'רחובות': 'Rehovot',
  'בת ים': 'Bat Yam',
  'הרצליה': 'Herzliya',
  'רעננה': 'Raanana',
  'לונדון': 'London',
  'פריז': 'Paris',
  'ברלין': 'Berlin',
  'אמסטרדם': 'Amsterdam',
  'רומא': 'Rome',
  'ניו יורק': 'New York',
  'מיאמי': 'Miami',
  'לוס אנג\'לס': 'Los Angeles',
};

@Controller('search')
export class SearchController {
  constructor(
    private readonly classifier: ClassifierService,
    @InjectRepository(Destination)
    private readonly destRepo: Repository<Destination>,
  ) {}

  @Post()
  async search(@Body() dto: SearchDto) {
    const { text, destinationId } = dto;

    // שלב 1 — סיווג קטגוריה עם המודל שלנו
    const result = this.classifier.classify(text);

    // שלב 2 — אם כבר יש destinationId (ממסך עיר) — נשתמש בו
    if (destinationId) {
      return { ...result, route: this.getRoute(result.category, destinationId), destinationId };
    }

    // שלב 3 — ניסיון לחלץ שם עיר מהטקסט ולחפש ב-DB
    const foundDest = await this.findDestinationInText(text);

    return {
      ...result,
      route:         this.getRoute(result.category, foundDest?.id),
      destinationId: foundDest?.id,
      detectedCity:  foundDest?.city ?? null,
    };
  }

  // ── חיפוש עיר בתוך הטקסט ──────────────────────────────────
  private async findDestinationInText(text: string): Promise<Destination | null> {
    const lower = text.toLowerCase();

    // בדיקה 1 — תרגום עברית לאנגלית
    for (const [heb, eng] of Object.entries(CITY_TRANSLATE)) {
      if (lower.includes(heb.toLowerCase())) {
        const dest = await this.destRepo.findOne({ where: { city: ILike(`%${eng}%`) } });
        if (dest) return dest;
      }
    }

    // בדיקה 2 — חיפוש ישיר באנגלית (אם המשתמש כתב באנגלית)
    const words = text.split(/[\s,]+/).filter((w) => w.length > 3);
    for (const word of words) {
      const dest = await this.destRepo.findOne({ where: { city: ILike(`%${word}%`) } });
      if (dest) return dest;
    }

    return null;
  }

  private getRoute(category: string, destinationId?: number): string {
    if (!destinationId) return `/${category}s`;
    switch (category) {
      case 'restaurant': return `/restaurants/${destinationId}`;
      case 'synagogue':  return `/synagogues/${destinationId}`;
      case 'minyan':     return `/minyans/${destinationId}`;
      case 'hosting':    return `/hosting/${destinationId}`;
      default:           return '/';
    }
  }
}
