import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { RestaurantsService, RestaurantFilters, ImportRestaurantDto } from './restaurants.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { SearchClassifierService } from '../ai/search-classifier.service';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SearchFeedback } from '../ai/search-feedback.entity';
import { Restaurant } from '../restaurant.entity';

class RecordFeedbackDto {
  query!: string;
  detectedType?: string;
  detectedKashrut?: string;
  detectedKeyword?: string;
  clickedRestaurantName!: string;
  clickedRestaurantType?: string;
  clickedRestaurantKashrut?: string;
}

@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly classifier: SearchClassifierService,
    @InjectRepository(SearchFeedback)
    private readonly feedbackRepo: Repository<SearchFeedback>,
  ) {}

  // GET /restaurants?destinationId=1&type=meat&kashrut=mehadrin&q=pizza&lat=48.8&lng=2.3
  // GET /restaurants?parentDestinationId=282&type=meat  ← כל מסעדות המדינה
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Query('destinationId') destinationId?: string,
    @Query('parentDestinationId') parentDestinationId?: string,
    @Query('type') type?: string,
    @Query('kashrut') kashrut?: string,
    @Query('q') q?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const filters: RestaurantFilters = {
      type,
      kashrut,
      q,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
    };
    if (parentDestinationId) {
      return this.restaurantsService.findByParentDestination(parseInt(parentDestinationId, 10), filters);
    }
    if (!destinationId) throw new BadRequestException('destinationId is required');
    return this.restaurantsService.findByDestination(parseInt(destinationId, 10), filters);
  }

  // GET /restaurants/search?destinationId=1&q=I+want+a+badatz+steak+place
  // req 4.3.1/4.3.2 — AI text classifier extracts type/kashrut from free-text
  @UseGuards(JwtAuthGuard)
  @Get('search')
  async aiSearch(
    @Query('destinationId', ParseIntPipe) destinationId: number,
    @Query('q') q: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ): Promise<Restaurant[]> {
    const { keyword, type, kashrut } = await this.classifier.classify(q ?? '');

    // Persist this search so future Claude calls can learn from it
    const feedback = this.feedbackRepo.create({
      query: q ?? '',
      detectedType: type ?? null,
      detectedKashrut: kashrut ?? null,
      detectedKeyword: keyword ?? null,
    });
    void this.feedbackRepo.save(feedback);

    const filters: RestaurantFilters = {
      q: keyword,
      type,
      kashrut,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
    };
    return this.restaurantsService.findByDestination(destinationId, filters);
  }

  // POST /restaurants/search/feedback
  // Records which restaurant the user actually clicked — used as few-shot learning data
  @UseGuards(JwtAuthGuard)
  @Post('search/feedback')
  async recordFeedback(
    @Body() dto: RecordFeedbackDto,
  ): Promise<{ ok: boolean }> {
    // Find the most recent feedback row for this exact query with no click recorded yet
    const row = await this.feedbackRepo.findOne({
      where: { query: dto.query, clickedRestaurantName: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (row) {
      row.clickedRestaurantName = dto.clickedRestaurantName;
      row.clickedRestaurantType = dto.clickedRestaurantType ?? null;
      row.clickedRestaurantKashrut = dto.clickedRestaurantKashrut ?? null;
      await this.feedbackRepo.save(row);
    } else {
      // If no pending row found, just create a complete record
      await this.feedbackRepo.save(
        this.feedbackRepo.create({
          query: dto.query,
          detectedType: dto.detectedType ?? null,
          detectedKashrut: dto.detectedKashrut ?? null,
          detectedKeyword: dto.detectedKeyword ?? null,
          clickedRestaurantName: dto.clickedRestaurantName,
          clickedRestaurantType: dto.clickedRestaurantType ?? null,
          clickedRestaurantKashrut: dto.clickedRestaurantKashrut ?? null,
        }),
      );
    }

    return { ok: true };
  }

  // GET /restaurants/nearby?lat=X&lng=Y&limit=10&kashrut=mehadrin
  @UseGuards(JwtAuthGuard)
  @Get('nearby')
  findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('limit') limit?: string,
    @Query('kashrut') kashrut?: string,
  ) {
    if (!lat || !lng) throw new BadRequestException('lat and lng are required');
    return this.restaurantsService.findNearby(
      parseFloat(lat), parseFloat(lng),
      limit ? parseInt(limit) : 10,
      kashrut,
    );
  }

  // GET /restaurants/:id
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Restaurant> {
    return this.restaurantsService.findOne(id);
  }

  /**
   * POST /restaurants/import-json
   * Body: { restaurants: ImportRestaurantDto[] }
   *
   * Geocodes each restaurant via Nominatim (free), saves lat/lng + PostGIS point.
   * Use this for CSV-to-DB imports. Rate-limited to 1 req/sec internally.
   */
  @Post('import-json')
  async importFromJson(@Body() body: { restaurants: ImportRestaurantDto[] }) {
    if (!body.restaurants?.length) {
      throw new BadRequestException('restaurants array is required');
    }
    return this.restaurantsService.importFromData(body.restaurants);
  }

  // POST /restaurants/import-google — import kosher restaurants from Google Places
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('import-google')
  async importFromGoogle() {
    return this.restaurantsService.importKosherRestaurantsFromGoogle();
  }

  // POST /restaurants/reclassify — reprocess existing restaurants and update classification
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('reclassify')
  async reclassifyExisting() {
    return this.restaurantsService.reclassifyExistingRestaurants();
  }

  // POST /restaurants/import-batch — batch import restaurants for specified destinations
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('import-batch')
  async importBatch(
    @Body() body: { destinationIds: number[]; limit?: number },
  ) {
    const { destinationIds, limit = 3 } = body;
    if (!destinationIds?.length) {
      throw new BadRequestException('destinationIds is required');
    }
    return this.restaurantsService.importBatch(destinationIds, limit);
  }
}
