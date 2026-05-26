/**
 * SearchController
 * ================
 * Endpoint: POST /search
 *
 * המשתמש שולח טקסט חופשי →
 * המודל מסווג →
 * מחזירים לאיזה עמוד לנווט
 */

import { Body, Controller, Post } from '@nestjs/common';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ClassifierService } from './classifier.service';

class SearchDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsNumber()
  destinationId?: number;
}

@Controller('search')
export class SearchController {
  constructor(private readonly classifier: ClassifierService) {}

  @Post()
  search(@Body() dto: SearchDto) {
    const { text, destinationId } = dto;

    // מסווגים את הטקסט
    const result = this.classifier.classify(text);

    // מחזירים את הקטגוריה + לאן לנווט
    return {
      ...result,
      // נתיב ניווט לאפליקציה
      route: this.getRoute(result.category, destinationId),
    };
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
