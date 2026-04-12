import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RestaurantsService } from './restaurants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchClassifierService } from '../ai/search-classifier.service';

@UseGuards(JwtAuthGuard)
@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly classifier: SearchClassifierService,
  ) {}

  // GET /restaurants?destinationId=1&type=meat&kashrut=mehadrin&q=pizza&lat=48.8&lng=2.3
  // req 11.1 — cache filtered list for 30 s
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30_000)
  @Get()
  findAll(
    @Query('destinationId', ParseIntPipe) destinationId: number,
    @Query('type')    type?: string,
    @Query('kashrut') kashrut?: string,
    @Query('q')       q?: string,
    @Query('lat')     lat?: string,
    @Query('lng')     lng?: string,
  ) {
    return this.restaurantsService.findByDestination(destinationId, {
      type,
      kashrut,
      q,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
    });
  }

  // GET /restaurants/search?destinationId=1&q=I+want+a+badatz+steak+place
  // req 4.3.1/4.3.2 — AI text classifier extracts type/kashrut from free-text
  @Get('search')
  aiSearch(
    @Query('destinationId', ParseIntPipe) destinationId: number,
    @Query('q') q: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const { keyword, type, kashrut } = this.classifier.classify(q ?? '');
    return this.restaurantsService.findByDestination(destinationId, {
      q: keyword,
      type,
      kashrut,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
    });
  }

  // GET /restaurants/:id
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.restaurantsService.findOne(id);
  }
}
