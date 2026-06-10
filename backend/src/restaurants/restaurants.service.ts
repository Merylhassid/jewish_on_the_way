import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Restaurant } from '../restaurant.entity';
import { Destination } from '../destination.entity';
import { GeocodingService } from '../geocoding/geocoding.service';
import axios from 'axios';
import { FOOD_RELATIONS, NAME_TO_TAG, lookupFoodRelation } from './food-relations';
import { CITY_TRANSLATE, DESTINATION_ALIASES } from '../ai/destination-index.service';

export interface RestaurantFilters {
  type?: string;
  kashrut?: string;
  q?: string;
  lat?: number;
  lng?: number;
  offset?: number;
}

export interface ImportRestaurantDto {
  name: string;
  address: string;
  city: string;
  country: string;
  kashrutLevel: string;
  restaurantType?: string;
  phone?: string;
  destinationId: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface RestaurantClassificationResult {
  type: 'meat' | 'dairy' | 'pareve' | null;
  confidence: number;
  keywords: {
    meat: string[];
    dairy: string[];
    pareve: string[];
  };
  strongMeat: boolean;
  strongDairy: boolean;
  strongPareve: boolean;
}

function normalizeRestaurantSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[׳']/g, '')
    .replace(/[״"]/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/[.,;:!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addHebrewPrefixVariants(term: string): string[] {
  if (!/[א-ת]/.test(term)) return [term];
  return [term, `ב${term}`, `ל${term}`, `מ${term}`];
}

function buildDestinationSearchTerms(destination?: Destination | null): string[] {
  if (!destination) return [];

  const canonical = new Set<string>();
  for (const value of [destination.city, destination.name, destination.country]) {
    const normalized = normalizeRestaurantSearchText(value ?? '');
    if (normalized.length >= 3) canonical.add(normalized);
  }

  const terms = new Set<string>(canonical);

  for (const [hebrew, english] of Object.entries(CITY_TRANSLATE)) {
    if (canonical.has(normalizeRestaurantSearchText(english))) {
      for (const variant of addHebrewPrefixVariants(normalizeRestaurantSearchText(hebrew))) {
        terms.add(variant);
      }
    }
  }

  for (const [english, aliases] of Object.entries(DESTINATION_ALIASES)) {
    if (canonical.has(normalizeRestaurantSearchText(english))) {
      for (const alias of aliases) {
        for (const variant of addHebrewPrefixVariants(normalizeRestaurantSearchText(alias))) {
          terms.add(variant);
        }
      }
    }
  }

  return [...terms].sort((a, b) => b.length - a.length);
}

function stripDestinationTerms(keyword: string | undefined, destination?: Destination | null): string | undefined {
  if (!keyword) return undefined;

  let cleaned = normalizeRestaurantSearchText(keyword);
  for (const term of buildDestinationSearchTerms(destination)) {
    cleaned = cleaned.replace(new RegExp(`(^|\\s)${escapeRegExp(term)}(?=\\s|$)`, 'g'), ' ');
  }

  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.length > 1 ? cleaned : undefined;
}

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(
    @InjectRepository(Restaurant)
    private restaurantsRepo: Repository<Restaurant>,
    @InjectRepository(Destination)
    private destinationsRepo: Repository<Destination>,
    private readonly geocodingService: GeocodingService,
    private readonly config: ConfigService,
  ) {}

  // req 4.1 — list restaurants with optional filters + distance
  async findByDestination(
    destinationId: number,
    filters: RestaurantFilters = {},
  ): Promise<{ data: any[]; total: number }> {
    const { type, kashrut, q, lat, lng, offset = 0 } = filters;

    // With distance: raw SQL so PostGIS computes ST_Distance
    if (lat !== undefined && lng !== undefined) {
      // Build WHERE twice: once for count (no GPS params), once for data (GPS params)
      const countParams: any[] = [destinationId];
      let countWhere = `r."destinationId" = $1`;
      const gpsParams: any[] = [lng, lat, destinationId];
      let gpsWhere = `r."destinationId" = $3`;
      let cIdx = 2;
      let gIdx = 4;

      if (type) {
        countWhere += ` AND r.restaurant_type = $${cIdx++}`; countParams.push(type);
        gpsWhere   += ` AND r.restaurant_type = $${gIdx++}`; gpsParams.push(type);
      }
      if (kashrut) {
        countWhere += ` AND r.kashrut_level = $${cIdx++}`; countParams.push(kashrut);
        gpsWhere   += ` AND r.kashrut_level = $${gIdx++}`; gpsParams.push(kashrut);
      }
      if (q) {
        countWhere += ` AND r.name ILIKE $${cIdx++}`; countParams.push(`%${q}%`);
        gpsWhere   += ` AND r.name ILIKE $${gIdx++}`; gpsParams.push(`%${q}%`);
      }

      const countResult = await this.restaurantsRepo.query(
        `SELECT COUNT(*) FROM restaurants r WHERE ${countWhere}`, countParams,
      );
      const total = parseInt(countResult[0].count, 10);

      gpsParams.push(offset);
      const data = await this.restaurantsRepo.query(
        `SELECT r.id, r.name, r.restaurant_type AS "restaurantType", r.kashrut_level AS "kashrutLevel",
                r.address, r.opening_hours AS "openingHours", r.created_at AS "createdAt",
                ST_Y(r.location::geometry) AS lat, ST_X(r.location::geometry) AS lng,
                ROUND(ST_Distance(r.location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)::numeric) AS "distanceMeters"
         FROM restaurants r
         WHERE ${gpsWhere}
         ORDER BY "distanceMeters" ASC
         LIMIT 50 OFFSET $${gIdx}`,
        gpsParams,
      );
      return { data, total };
    }

    // Without distance: findAndCount (q filter server-side via ILike)
    const where: any = { destination: { id: destinationId } };
    if (type) where.restaurantType = type;
    if (kashrut) where.kashrutLevel = kashrut;
    if (q) where.name = ILike(`%${q}%`);

    const [data, total] = await this.restaurantsRepo.findAndCount({
      where,
      select: { id: true, name: true, restaurantType: true, kashrutLevel: true, address: true, openingHours: true, createdAt: true, location: true },
      order: { name: 'ASC' },
      take: 50,
      skip: offset,
    });
    return { data, total };
  }

  // כל המסעדות מכל ערי מדינה אחת, ממויינות לפי מרחק
  async findByParentDestination(parentId: number, filters: RestaurantFilters = {}): Promise<{ data: any[]; total: number }> {
    const { type, kashrut, q, lat, lng, offset = 0 } = filters;

    if (lat !== undefined && lng !== undefined) {
      const countParams: (string | number)[] = [parentId];
      let countSql = `
        SELECT COUNT(*)
        FROM restaurants r
        JOIN destinations d ON r."destinationId" = d.id
        WHERE d.parent_id = $1
      `;
      let countIdx = 2;

      let sql = `
        SELECT r.id, r.name,
               r.restaurant_type AS "restaurantType",
               r.kashrut_level   AS "kashrutLevel",
               r.address, r.opening_hours AS "openingHours",
               r.created_at AS "createdAt",
               d.city AS "destinationCity",
               ROUND(ST_Distance(
                 r.location::geography,
                 ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
               )::numeric) AS "distanceMeters"
        FROM restaurants r
        JOIN destinations d ON r."destinationId" = d.id
        WHERE d.parent_id = $3
      `;
      const params: (string | number)[] = [lng, lat, parentId];
      let idx = 4;
      if (type) {
        countSql += ` AND r.restaurant_type = $${countIdx}`;
        countParams.push(type);
        countIdx++;
        sql += ` AND r.restaurant_type = $${idx}`;
        params.push(type);
        idx++;
      }
      if (kashrut) {
        countSql += ` AND r.kashrut_level = $${countIdx}`;
        countParams.push(kashrut);
        countIdx++;
        sql += ` AND r.kashrut_level = $${idx}`;
        params.push(kashrut);
        idx++;
      }
      if (q) {
        countSql += ` AND r.name ILIKE $${countIdx}`;
        countParams.push(`%${q}%`);
        sql += ` AND r.name ILIKE $${idx}`;
        params.push(`%${q}%`);
        idx++;
      }

      const countResult = await this.restaurantsRepo.query(countSql, countParams);
      const total = parseInt(countResult[0].count, 10);

      params.push(offset);
      sql += ` ORDER BY "distanceMeters" ASC LIMIT 50 OFFSET $${idx}`;
      const data = await this.restaurantsRepo.query(sql, params);
      return { data, total };
    }

    const countParams: (string | number)[] = [parentId];
    let countSql = `
      SELECT COUNT(*)
      FROM restaurants r
      JOIN destinations d ON r."destinationId" = d.id
      WHERE d.parent_id = $1
    `;

    let sql = `
      SELECT r.id, r.name,
             r.restaurant_type AS "restaurantType",
             r.kashrut_level   AS "kashrutLevel",
             r.address, r.opening_hours AS "openingHours",
             r.created_at AS "createdAt",
             d.city AS "destinationCity"
      FROM restaurants r
      JOIN destinations d ON r."destinationId" = d.id
      WHERE d.parent_id = $1
    `;
    const params: (string | number)[] = [parentId];
    let idx = 2;
    let countIdx = 2;
    if (type) {
      countSql += ` AND r.restaurant_type = $${countIdx}`;
      countParams.push(type);
      countIdx++;
      sql += ` AND r.restaurant_type = $${idx}`;
      params.push(type);
      idx++;
    }
    if (kashrut) {
      countSql += ` AND r.kashrut_level = $${countIdx}`;
      countParams.push(kashrut);
      countIdx++;
      sql += ` AND r.kashrut_level = $${idx}`;
      params.push(kashrut);
      idx++;
    }
    if (q) {
      countSql += ` AND r.name ILIKE $${countIdx}`;
      countParams.push(`%${q}%`);
      sql += ` AND r.name ILIKE $${idx}`;
      params.push(`%${q}%`);
      idx++;
    }

    const countResult = await this.restaurantsRepo.query(countSql, countParams);
    const total = parseInt(countResult[0].count, 10);

    params.push(offset);
    sql += ` ORDER BY d.city ASC, r.name ASC LIMIT 50 OFFSET $${idx}`;
    const data = await this.restaurantsRepo.query(sql, params);
    return { data, total };
  }

  // req 4.4 — single restaurant details
  async findOne(id: number) {
    type Row = {
      id: number;
      name: string;
      restaurantType: string | null;
      kashrutLevel: string;
      isKosher: boolean | null;
      address: string | null;
      phone: string | null;
      category: string | null;
      openingHours: string | null;
      createdAt: string;
      lat: number | null;
      lng: number | null;
      destId: number | null;
      destName: string | null;
      destCity: string | null;
      destCountry: string | null;
    };

    const rows = (await this.restaurantsRepo.query(
      `SELECT
         r.id,
         r.name,
         r.restaurant_type   AS "restaurantType",
         r.kashrut_level     AS "kashrutLevel",
         r.is_kosher         AS "isKosher",
         r.address,
         r.phone,
         r.category,
         r.opening_hours     AS "openingHours",
         r.created_at        AS "createdAt",
         CASE WHEN r.location IS NOT NULL THEN ST_Y(r.location::geometry) END AS lat,
         CASE WHEN r.location IS NOT NULL THEN ST_X(r.location::geometry) END AS lng,
         d.id                AS "destId",
         d.name              AS "destName",
         d.city              AS "destCity",
         d.country           AS "destCountry"
       FROM restaurants r
       LEFT JOIN destinations d ON d.id = r."destinationId"
       WHERE r.id = $1`,
      [id],
    )) as Row[];
    if (!rows.length) throw new NotFoundException(`Restaurant #${id} not found`);
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      restaurantType: r.restaurantType,
      kashrutLevel: r.kashrutLevel,
      isKosher: r.isKosher,
      address: r.address,
      phone: r.phone,
      category: r.category,
      openingHours: r.openingHours,
      createdAt: r.createdAt,
      lat: r.lat,
      lng: r.lng,
      location: null,
      destination: r.destId
        ? { id: r.destId, name: r.destName, city: r.destCity, country: r.destCountry }
        : null,
    } as any;
  }

  async findNearby(
    lat: number,
    lng: number,
    limit = 10,
    kashrut?: string,
  ): Promise<any[]> {
    let sql = `
      SELECT
        r.id, r.name,
        r.restaurant_type   AS "restaurantType",
        r.kashrut_level     AS "kashrutLevel",
        r.address,
        ST_Y(r.location::geometry) AS lat,
        ST_X(r.location::geometry) AS lng,
        ROUND(ST_Distance(
          r.location::geography,
          ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
        )::numeric) AS "distanceMeters",
        d.id AS "destId", d.city, d.country
      FROM restaurants r
      LEFT JOIN destinations d ON d.id = r."destinationId"
      WHERE r.location IS NOT NULL
    `;
    const params: any[] = [lat, lng];
    if (kashrut) {
      params.push(kashrut);
      sql += ` AND r.kashrut_level = $${params.length}`;
    }
    params.push(limit);
    sql += ` ORDER BY r.location::geography <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography LIMIT $${params.length}`;
    return this.restaurantsRepo.query(sql, params) as Promise<any[]>;
  }

  /**
   * Import restaurants from a JSON array (produced by a CSV import script or admin UI).
   *
   * For each row:
   *  - Skip if a restaurant with the same name already exists in the same city
   *  - Geocode address with Nominatim (free, 1 req/sec)
   *  - Skip rows where geocoding returns null and record the failure
   *  - Save lat/lng + PostGIS geography point in one DB write
   */
  async importFromData(items: ImportRestaurantDto[]): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        // Duplicate check: same name + same city is almost certainly the same place
        const existing = await this.restaurantsRepo.findOne({
          where: { name: item.name, city: item.city } as any,
        });
        if (existing) {
          this.logger.log(`Skipping duplicate: ${item.name} in ${item.city}`);
          skipped++;
          continue;
        }

        const destination = await this.destinationsRepo.findOne({
          where: { id: item.destinationId },
        });
        if (!destination) {
          failed++;
          errors.push(`Destination ${item.destinationId} not found for: ${item.name}`);
          continue;
        }

        // Geocode once — result is stored permanently, never re-geocoded
        const coords = await this.geocodingService.geocode(item.address, item.city, item.country);
        if (!coords) {
          failed++;
          errors.push(`No coordinates for: ${item.name} — ${item.address}, ${item.city}, ${item.country}`);
          this.logger.warn(`Geocoding failed for "${item.name}" — skipping`);
          continue;
        }

        const restaurant = this.restaurantsRepo.create({
          name: item.name,
          address: item.address,
          city: item.city,
          country: item.country,
          phone: item.phone,
          kashrutLevel: item.kashrutLevel,
          restaurantType: item.restaurantType ?? null,
          isKosher: true,
          lat: coords.lat,
          lng: coords.lng,
          geocodedAt: new Date(),
          destination,
        } as any);

        await this.restaurantsRepo.save(restaurant);
        imported++;
        this.logger.log(`Imported: ${item.name} → (${coords.lat}, ${coords.lng})`);
      } catch (err) {
        failed++;
        this.logger.error(`Import error for "${item.name}": ${err.message}`);
        errors.push(`Failed to import "${item.name}"`);
      }
    }

    return { imported, skipped, failed, errors };
  }

  // Import kosher restaurants from Google Places API for all destinations
  async importKosherRestaurantsFromGoogle() {
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    this.logger.log('🔍 Starting restaurant import...');
    this.logger.log('API Key present:', !!apiKey);

    if (!apiKey || apiKey === 'your_google_places_api_key') {
      throw new Error(
        '❌ GOOGLE_PLACES_API_KEY is not set or still has placeholder value in .env',
      );
    }

    const destinations = await this.destinationsRepo.find();
    this.logger.log(
      `📍 Found ${destinations.length} destinations to process:\n`,
      destinations.map((d) => d.name).join(', '),
    );

    let totalImported = 0;
    let totalFound = 0;
    const destinationStats: { [key: string]: number } = {};

    for (const destination of destinations) {
      try {
        this.logger.log(`\n⏳ Processing: ${destination.name}`);

        const query = `kosher restaurant in ${destination.name}`;
        this.logger.log(`   Query: "${query}"`);

        let pageToken: string | undefined;
        let pageNumber = 1;
        let foundOnThisDestination = 0;
        destinationStats[destination.name] = 0;

        // Fetch up to 3 pages (Google returns ~20 results per page)
        while (pageNumber <= 3) {
          const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}${pageToken ? `&pagetoken=${pageToken}` : ''}`;

          const response = await axios.get(url);
          const places = response.data.results || [];

          if (places.length === 0) {
            this.logger.log(`   ✓ Page ${pageNumber}: No more results`);
            break;
          }

          this.logger.log(
            `   ✓ Page ${pageNumber}: Found ${places.length} results`,
          );
          foundOnThisDestination += places.length;
          totalFound += places.length;

          for (const place of places) {
            await this.processGooglePlace(place, apiKey, destination);
            totalImported++;
            destinationStats[destination.name]++;
          }

          // Check if there's a next page token
          if (!response.data.next_page_token) {
            this.logger.log(`   ✓ No more pages available`);
            break;
          }

          pageToken = response.data.next_page_token;
          pageNumber++;

          // Google API requires a small delay between page requests
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        this.logger.log(
          `   Summary for ${destination.name}: ${destinationStats[destination.name]} restaurants processed (${foundOnThisDestination} total found)`,
        );
      } catch (error) {
        this.logger.error(
          `\n❌ Error importing for ${destination.name}:`,
          error.message,
        );
        if (error.response?.data) {
          this.logger.error(`   API Error: ${JSON.stringify(error.response.data)}`);
        }
        // Continue with next destination
      }
    }

    const summary = {
      message: `✅ Sync complete: ${totalImported} restaurants processed across ${destinations.length} destinations (${totalFound} total found)`,
      stats: {
        totalProcessed: totalImported,
        totalFound,
        destinationsProcessed: destinations.length,
        detailsByDestination: destinationStats,
      },
    };

    this.logger.log('Final Summary: ' + JSON.stringify(summary));
    return summary;
  }

  // Reclassify all existing restaurants in the database
  async reclassifyExistingRestaurants() {
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    const BATCH_SIZE = 100;
    let skip = 0;
    let updatedCount = 0;
    let totalProcessed = 0;

    this.logger.log('🔄 Starting reclassification (batched)...');

    while (true) {
      const batch = await this.restaurantsRepo.find({ take: BATCH_SIZE, skip });
      if (batch.length === 0) break;

      for (const restaurant of batch) {
        try {
          const place = {
            name: restaurant.name,
            formatted_address: restaurant.address,
            types: [],
          };

          const details =
            restaurant.googlePlaceId && apiKey
              ? await this.getPlaceDetails(restaurant.googlePlaceId, apiKey)
              : {};

          const classification = this.classifyRestaurantType(place, details);
          const newType = classification.type ?? null;
          const newConfidence = classification.confidence;

          const shouldUpdate =
            restaurant.restaurantType !== newType ||
            restaurant.restaurantTypeConfidence !== newConfidence;

          if (shouldUpdate) {
            restaurant.restaurantType = newType;
            restaurant.restaurantTypeConfidence = newConfidence;
            await this.restaurantsRepo.save(restaurant);
            updatedCount++;
          }

          this.logger.debug(
            `      🔄 Reclassified "${restaurant.name}": ${newType || 'unknown'} (confidence: ${newConfidence.toFixed(2)}) | meat=[${classification.keywords.meat.join(', ')}] dairy=[${classification.keywords.dairy.join(', ')}] pareve=[${classification.keywords.pareve.join(', ')}]`,
          );
        } catch (error) {
          this.logger.error(
            `      ❌ Failed to reclassify "${restaurant.name}":`,
            error.message,
          );
        }
      }

      totalProcessed += batch.length;
      skip += BATCH_SIZE;
    }

    const summary = {
      message: `✅ Reclassification complete: ${updatedCount} restaurants updated out of ${totalProcessed}`,
      totalRestaurants: totalProcessed,
      updated: updatedCount,
    };

    this.logger.log('Reclassification Summary: ' + JSON.stringify(summary));
    return summary;
  }

  private async processGooglePlace(
    place: any,
    apiKey: string,
    destination: Destination,
  ): Promise<void> {
    const existing = await this.restaurantsRepo.findOne({
      where: { googlePlaceId: place.place_id },
    });

    const placeDetails = await this.getPlaceDetails(place.place_id, apiKey);
    const classification = this.classifyRestaurantType(place, placeDetails);

    this.logger.debug(
      `      📊 Classification for "${place.name}": ${classification.type || 'unknown'} (confidence: ${classification.confidence.toFixed(2)}) | meat=[${classification.keywords.meat.join(', ')}] dairy=[${classification.keywords.dairy.join(', ')}] pareve=[${classification.keywords.pareve.join(', ')}]`,
    );

    if (existing) {
      existing.restaurantType = classification.type ?? null;
      existing.restaurantTypeConfidence = classification.confidence;
      existing.rating = place.rating || existing.rating;
      existing.address = place.formatted_address;
      existing.name = place.name;
      existing.location = {
        type: 'Point',
        coordinates: [place.geometry.location.lng, place.geometry.location.lat],
      };
      existing.isKosher = true;
      await this.restaurantsRepo.save(existing);
      this.logger.log(
        `      🔄 Updated: "${place.name}" (rating: ${place.rating || 'N/A'}, type: ${classification.type || 'unknown'})`,
      );
    } else {
      const restaurant = this.restaurantsRepo.create({
        googlePlaceId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        rating: place.rating || undefined,
        isKosher: true,
        restaurantType: classification.type ?? null,
        restaurantTypeConfidence: classification.confidence,
        kashrutLevel: 'unknown',
        location: {
          type: 'Point',
          coordinates: [place.geometry.location.lng, place.geometry.location.lat],
        },
        destination,
      });
      await this.restaurantsRepo.save(restaurant);
      this.logger.log(
        `      ✅ Imported: "${place.name}" (rating: ${place.rating || 'N/A'}, type: ${classification.type || 'unknown'})`,
      );
    }
  }

  // Get detailed place information from Google Places Details API
  private async getPlaceDetails(placeId: string, apiKey: string) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,reviews,editorial_summary,types&key=${apiKey}`;
      const response = await axios.get(url);
      return response.data.result || {};
    } catch (error) {
      this.logger.warn(
        `   ⚠️  Failed to get details for place ${placeId}:`,
        error.message,
      );
      return {};
    }
  }

  // Classify restaurant type based on name, reviews, place details and metadata
  private classifyRestaurantType(
    place: any,
    details: any,
  ): RestaurantClassificationResult {
    const name = (place.name || '').toLowerCase();
    const address = (place.formatted_address || '').toLowerCase();
    const editorialSummary = (
      details.editorial_summary?.overview || ''
    ).toLowerCase();
    const reviewText = (details.reviews || [])
      .map((r: any) => (r.text || '').toLowerCase())
      .join(' ');
    const placeTypes = [...(place.types || []), ...(details.types || [])]
      .map((type: string) => type.toLowerCase())
      .join(' ');

    const allText = [
      name,
      address,
      editorialSummary,
      reviewText,
      placeTypes,
    ].join(' ');
    const normalizedText = allText
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const strongMeatKeywords = [
      'steak',
      'grill',
      'bbq',
      'burger',
      'shawarma',
      'kebab',
      'butcher',
      'smokehouse',
      'meat restaurant',
      'chicken restaurant',
      'steakhouse',
      'barbecue',
      'ribs',
      'rotisserie',
    ];
    const strongDairyKeywords = [
      'cafe',
      'coffee',
      'bakery',
      'pizza',
      'pasta',
      'cheese',
      'breakfast',
      'brunch',
      'patisserie',
      'ice cream',
      'gelato',
      'creperie',
    ];
    const strongPareveKeywords = [
      'falafel',
      'hummus',
      'vegan',
      'vegetarian',
      'sushi',
      'fish',
      'salad',
      'plant-based',
      'poke',
      'bowl',
    ];

    const weakMeatKeywords = [
      'meat',
      'grilled',
      'hamburger',
      'chicken',
      'bbq',
      'barbecue',
    ];
    const weakDairyKeywords = [
      'cheese',
      'dairy',
      'milk',
      'yogurt',
      'sandwich',
      'bagel',
      'croissant',
      'dessert',
    ];
    const weakPareveKeywords = [
      'healthy',
      'fresh',
      'vegetarian',
      'vegan',
      'salad',
      'grain',
      'rice',
      'falafel',
      'hummus',
    ];

    const findKeywords = (keywords: string[]) =>
      keywords.filter((keyword) => normalizedText.includes(keyword));
    const meatMatches = findKeywords([
      ...new Set([...strongMeatKeywords, ...weakMeatKeywords]),
    ]);
    const dairyMatches = findKeywords([
      ...new Set([...strongDairyKeywords, ...weakDairyKeywords]),
    ]);
    const pareveMatches = findKeywords([
      ...new Set([...strongPareveKeywords, ...weakPareveKeywords]),
    ]);

    const strongMeatMatches = findKeywords(strongMeatKeywords);
    const strongDairyMatches = findKeywords(strongDairyKeywords);
    const strongPareveMatches = findKeywords(strongPareveKeywords);

    const meatTypes = ['meal_takeaway', 'restaurant', 'food', 'barbecue'];
    const dairyTypes = ['bakery', 'cafe', 'meal_takeaway'];
    const pareveTypes = ['meal_takeaway', 'restaurant'];

    const hasMeatType =
      (details.types || []).some((t: string) =>
        meatTypes.includes(t.toLowerCase()),
      ) ||
      (place.types || []).some((t: string) =>
        meatTypes.includes(t.toLowerCase()),
      );
    const hasDairyType =
      (details.types || []).some((t: string) =>
        dairyTypes.includes(t.toLowerCase()),
      ) ||
      (place.types || []).some((t: string) =>
        dairyTypes.includes(t.toLowerCase()),
      );
    const hasPareveType =
      (details.types || []).some((t: string) =>
        pareveTypes.includes(t.toLowerCase()),
      ) ||
      (place.types || []).some((t: string) =>
        pareveTypes.includes(t.toLowerCase()),
      );

    let meatScore =
      strongMeatMatches.length * 4 +
      (meatMatches.length - strongMeatMatches.length) * 1.5 +
      (hasMeatType ? 2 : 0);
    let dairyScore =
      strongDairyMatches.length * 4 +
      (dairyMatches.length - strongDairyMatches.length) * 1.5 +
      (hasDairyType ? 2 : 0);
    let pareveScore = 0;

    if (!strongMeatMatches.length && !strongDairyMatches.length) {
      pareveScore =
        strongPareveMatches.length * 4 +
        (pareveMatches.length - strongPareveMatches.length) * 1.5 +
        (hasPareveType ? 1 : 0);
    }

    if (
      name.includes('pizza') ||
      name.includes('pasta') ||
      name.includes('italian')
    ) {
      dairyScore += 3;
    }
    if (
      name.includes('burger') ||
      name.includes('grill') ||
      name.includes('steak') ||
      name.includes('smokehouse') ||
      name.includes('kebab') ||
      name.includes('shawarma')
    ) {
      meatScore += 3;
    }
    if (
      name.includes('falafel') ||
      name.includes('hummus') ||
      name.includes('vegan') ||
      name.includes('vegetarian') ||
      name.includes('sushi') ||
      name.includes('fish') ||
      name.includes('salad')
    ) {
      pareveScore += 3;
    }

    const scores: Array<{
      type: RestaurantClassificationResult['type'];
      score: number;
    }> = [
      { type: 'meat', score: meatScore },
      { type: 'dairy', score: dairyScore },
      { type: 'pareve', score: pareveScore },
    ];

    const sorted = scores.slice().sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    const runnerUp = sorted[1];
    const totalScore = meatScore + dairyScore + pareveScore;
    const confidence = totalScore > 0 ? winner.score / totalScore : 0;

    if (winner.score < 4 || confidence < 0.35) {
      return {
        type: null,
        confidence: 0,
        keywords: {
          meat: meatMatches,
          dairy: dairyMatches,
          pareve: pareveMatches,
        },
        strongMeat: strongMeatMatches.length > 0,
        strongDairy: strongDairyMatches.length > 0,
        strongPareve: strongPareveMatches.length > 0,
      };
    }

    if (
      winner.type === 'pareve' &&
      (strongMeatMatches.length > 0 || strongDairyMatches.length > 0)
    ) {
      return {
        type: null,
        confidence: 0,
        keywords: {
          meat: meatMatches,
          dairy: dairyMatches,
          pareve: pareveMatches,
        },
        strongMeat: strongMeatMatches.length > 0,
        strongDairy: strongDairyMatches.length > 0,
        strongPareve: strongPareveMatches.length > 0,
      };
    }

    if (
      runnerUp.score > 0 &&
      winner.score / Math.max(runnerUp.score, 1) < 1.2
    ) {
      return {
        type: null,
        confidence: 0,
        keywords: {
          meat: meatMatches,
          dairy: dairyMatches,
          pareve: pareveMatches,
        },
        strongMeat: strongMeatMatches.length > 0,
        strongDairy: strongDairyMatches.length > 0,
        strongPareve: strongPareveMatches.length > 0,
      };
    }

    return {
      type: winner.type,
      confidence: Math.min(Math.round(confidence * 100) / 100, 1),
      keywords: {
        meat: meatMatches,
        dairy: dairyMatches,
        pareve: pareveMatches,
      },
      strongMeat: strongMeatMatches.length > 0,
      strongDairy: strongDairyMatches.length > 0,
      strongPareve: strongPareveMatches.length > 0,
    };
  }

  // ── Smart search — tiered (tag → ILIKE → broad fallback) ──────────────────

  async smartSearch(
    keyword: string | undefined,
    classifierType: string | undefined,
    kashrut: string | undefined,
    destinationId: number,
    lat?: number,
    lng?: number,
    originalQuery?: string,
  ): Promise<{
    data: any[];
    total: number;
    matchTier: 1 | 2 | 3 | 4;
    matchedVia: string[];
    message: string | null;
  }> {
    const destination = await this.destinationsRepo.findOne({
      where: { id: destinationId },
      select: ['id', 'name', 'city', 'country'],
    });
    const cleanedKeyword = stripDestinationTerms(keyword, destination);

    // Use keyword first; fall back to original query so Hebrew food terms like "פיצה"
    // still hit the food-relations table even when the classifier strips the keyword
    const lookupTerm = cleanedKeyword ?? stripDestinationTerms(originalQuery, destination);
    const relation = lookupTerm ? lookupFoodRelation(lookupTerm) : undefined;
    const searchTags = relation?.searchTags ?? [];
    const fallbackType = relation?.fallbackType;

    const SPARSE_THRESHOLD = 5;
    const SUPPLEMENT_MAX_METERS = 30000; // only pull in results from nearby cities (≤30km)
    const MAX_RESULTS = 40; // cap the final list — best first, then fill with similar
    const kwNorm = cleanedKeyword ? normalizeRestaurantSearchText(cleanedKeyword) : '';
    const nameMatchesKeyword = (r: any): boolean =>
      kwNorm.length > 0 && normalizeRestaurantSearchText(r.name ?? '').includes(kwNorm);
    const supplement = async (localData: any[]): Promise<any[]> => {
      // Without GPS we cannot tell which global results are nearby, so cities like
      // Eilat would appear before local results. Skip supplement entirely; the
      // mobile re-runs the search once GPS arrives, at which point filtering is safe.
      if (lat === undefined || lng === undefined) return localData;

      const ids = new Set(localData.map((r: any) => r.id));
      const g = await this.searchGlobal(searchTags, cleanedKeyword, classifierType ?? fallbackType, kashrut, lat, lng);
      // Only keep nearby results with known coordinates (≤30km)
      const extra = g.data.filter(
        (r: any) => !ids.has(r.id) && r.distanceMeters != null && r.distanceMeters <= SUPPLEMENT_MAX_METERS,
      );
      if (extra.length === 0) return localData;
      const combined = [...localData, ...extra];
      // Sort purely by distance — nearest first
      combined.sort((a: any, b: any) =>
        (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999),
      );
      return combined.slice(0, MAX_RESULTS);
    };

    // Tier 1: name ILIKE — most specific (finds "גלידת ים", "שניצל בגדדי")
    if (cleanedKeyword) {
      const result = await this.findByDestination(destinationId, { q: cleanedKeyword, kashrut, lat, lng });
      if (result.data.length > 0) {
        const data = result.data.length < SPARSE_THRESHOLD
          ? await supplement(result.data)
          : result.data;
        const supplemented = data.length > result.data.length;
        return {
          data,
          total: data.length,
          matchTier: 1,
          matchedVia: [cleanedKeyword],
          message: supplemented ? 'מציג גם תוצאות מערים קרובות' : null,
        };
      }
    }

    // Tier 2: food-relation tags — category match (dairy, meat, etc.)
    if (searchTags.length > 0) {
      const result = await this.searchByTags(searchTags, kashrut, destinationId, lat, lng);
      if (result.data.length > 0) {
        const kwLower = cleanedKeyword?.toLowerCase().trim() ?? '';
        const tagMatch = searchTags.some(t => t === kwLower || kwLower.includes(t));
        const isDirectMatch = !cleanedKeyword || tagMatch;
        // Indirect match (e.g. גלידה→dairy) always supplements so global ILIKE can find actual ice cream
        const shouldSupplement = !isDirectMatch || result.data.length < SPARSE_THRESHOLD;
        const data = shouldSupplement ? await supplement(result.data) : result.data;
        const supplemented = data.length > result.data.length;
        return {
          data,
          total: data.length,
          matchTier: 2,
          matchedVia: searchTags,
          message: supplemented ? 'מציג גם תוצאות מערים קרובות' : null,
        };
      }
    }

    // Tier 3: drop keyword — use classifier type or fallback type + kashrut
    const effectiveType = classifierType ?? fallbackType;
    const result3 = await this.findByDestination(destinationId, { type: effectiveType, kashrut, lat, lng });
    if (result3.data.length > 0) {
      const data = await supplement(result3.data);
      const supplemented = data.length > result3.data.length;
      return {
        data,
        total: data.length,
        matchTier: 3,
        matchedVia: [],
        message: supplemented ? 'מציג גם תוצאות מערים קרובות' : null,
      };
    }

    // Tier 3.5: search globally across all destinations (fallback when local search fails)
    const globalResult = await this.searchGlobal(searchTags, cleanedKeyword, effectiveType, kashrut, lat, lng);
    if (globalResult.data.length > 0) {
      return {
        ...globalResult,
        matchTier: 3,
        matchedVia: ['global'],
        message: `לא נמצאו תוצאות בעיר זו — מציג תוצאות מערים אחרות`,
      };
    }

    // Tier 4: nothing found anywhere
    return {
      data: [],
      total: 0,
      matchTier: 4,
      matchedVia: [],
      message: cleanedKeyword
        ? `לא נמצאו תוצאות עבור "${cleanedKeyword}"`
        : 'לא נמצאו מסעדות.',
    };
  }

  private async searchGlobal(
    tags: string[],
    keyword: string | undefined,
    type: string | undefined,
    kashrut: string | undefined,
    lat?: number,
    lng?: number,
  ): Promise<{ data: any[]; total: number }> {
    const hasGps = lat !== undefined && lng !== undefined;
    const select = `r.id, r.name, r.restaurant_type AS "restaurantType", r.kashrut_level AS "kashrutLevel",
                    r.address, r.opening_hours AS "openingHours", d.city AS "destinationCity"`;
    const distSelect = hasGps
      ? `, ROUND(ST_Distance(r.location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)::numeric) AS "distanceMeters"`
      : '';
    const orderBy = hasGps ? `ORDER BY "distanceMeters" ASC` : `ORDER BY r.name ASC`;
    const baseParams: any[] = hasGps ? [lng, lat] : [];
    const paramOffset = baseParams.length;

    const tryQuery = async (where: string, params: any[]): Promise<any[]> => {
      const full = [...baseParams, ...params];
      const q = `SELECT ${select}${distSelect} FROM restaurants r JOIN destinations d ON d.id = r."destinationId" WHERE ${where} ${orderBy} LIMIT 30`;
      return this.restaurantsRepo.query(q, full);
    };

    // Accumulate across all layers (don't stop at the first hit) so the caller can
    // fill the list: exact name-matches PLUS similar (tag/type) results from nearby
    // cities. Dedupe by id; the caller decides final ordering and distance cap.
    const seen = new Set<number>();
    const results: any[] = [];
    const addAll = (rows: any[]) => {
      for (const r of rows) {
        if (!seen.has(r.id)) { seen.add(r.id); results.push(r); }
      }
    };

    // 1. keyword ILIKE — most specific (finds "גלידת ים", not just dairy cafes)
    if (keyword) {
      const where = kashrut
        ? `r.name ILIKE $${paramOffset + 1} AND r.kashrut_level = $${paramOffset + 2}`
        : `r.name ILIKE $${paramOffset + 1}`;
      const params = kashrut ? [`%${keyword}%`, kashrut] : [`%${keyword}%`];
      addAll(await tryQuery(where, params));
    }

    // 2. tags — category match (dairy, meat, …)
    if (tags.length > 0) {
      const where = kashrut
        ? `r.tags && $${paramOffset + 1}::text[] AND r.kashrut_level = $${paramOffset + 2}`
        : `r.tags && $${paramOffset + 1}::text[]`;
      const params = kashrut ? [tags, kashrut] : [tags];
      addAll(await tryQuery(where, params));
    }

    // 3. type
    if (type) {
      const where = kashrut
        ? `r.restaurant_type = $${paramOffset + 1} AND r.kashrut_level = $${paramOffset + 2}`
        : `r.restaurant_type = $${paramOffset + 1}`;
      const params = kashrut ? [type, kashrut] : [type];
      addAll(await tryQuery(where, params));
    }

    return { data: results, total: results.length };
  }

  private async searchByTags(
    tags: string[],
    kashrut: string | undefined,
    destinationId: number,
    lat?: number,
    lng?: number,
  ): Promise<{ data: any[]; total: number }> {
    // Count (no GPS needed)
    const cParams: any[] = [destinationId, tags];
    let cWhere = `r."destinationId" = $1 AND r.tags && $2::text[]`;
    if (kashrut) { cParams.push(kashrut); cWhere += ` AND r.kashrut_level = $${cParams.length}`; }

    const countResult = await this.restaurantsRepo.query(
      `SELECT COUNT(*) FROM restaurants r WHERE ${cWhere}`, cParams,
    );
    const total = parseInt(countResult[0].count, 10);
    if (total === 0) return { data: [], total: 0 };

    // Data with optional GPS ordering
    if (lat !== undefined && lng !== undefined) {
      const dParams: any[] = [lng, lat, destinationId, tags];
      let dWhere = `r."destinationId" = $3 AND r.tags && $4::text[]`;
      if (kashrut) { dParams.push(kashrut); dWhere += ` AND r.kashrut_level = $${dParams.length}`; }

      const data = await this.restaurantsRepo.query(
        `SELECT r.id, r.name, r.restaurant_type AS "restaurantType", r.kashrut_level AS "kashrutLevel",
                r.address, r.opening_hours AS "openingHours",
                ST_Y(r.location::geometry) AS lat, ST_X(r.location::geometry) AS lng,
                ROUND(ST_Distance(r.location::geography,
                  ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)::numeric) AS "distanceMeters"
         FROM restaurants r WHERE ${dWhere}
         ORDER BY "distanceMeters" ASC LIMIT 50`,
        dParams,
      );
      return { data, total };
    }

    const dParams: any[] = [destinationId, tags];
    let dWhere = `r."destinationId" = $1 AND r.tags && $2::text[]`;
    if (kashrut) { dParams.push(kashrut); dWhere += ` AND r.kashrut_level = $${dParams.length}`; }

    const data = await this.restaurantsRepo.query(
      `SELECT r.id, r.name, r.restaurant_type AS "restaurantType", r.kashrut_level AS "kashrutLevel",
              r.address, r.opening_hours AS "openingHours"
       FROM restaurants r WHERE ${dWhere}
       ORDER BY r.name ASC LIMIT 50`,
      dParams,
    );
    return { data, total };
  }

  // One-time admin operation: derive tags from restaurant name + category
  async seedTags(): Promise<{ updated: number; total: number }> {
    const BATCH = 100;
    let skip = 0, updated = 0, total = 0;

    while (true) {
      const batch = await this.restaurantsRepo.find({
        select: { id: true, name: true, category: true, tags: true },
        take: BATCH,
        skip,
      });
      if (!batch.length) break;

      for (const r of batch) {
        const text = `${r.name ?? ''} ${r.category ?? ''}`;
        const existingTags = Array.isArray((r as any).tags) ? (r as any).tags : [];
        const tags = new Set<string>(existingTags);
        const before = [...tags].sort().join('|');
        for (const [regex, tag] of NAME_TO_TAG) {
          if (regex.test(text)) tags.add(tag);
        }
        const nextTags = [...tags].sort();
        if (nextTags.length > 0 && nextTags.join('|') !== before) {
          await this.restaurantsRepo.update(r.id, { tags: nextTags } as any);
          updated++;
        }
      }

      total += batch.length;
      skip += BATCH;
    }

    this.logger.log(`seedTags: ${updated} updated out of ${total}`);
    return { updated, total };
  }

  // Batch import restaurants for specified destinations
  async importBatch(destinationIds: number[], limit: number) {
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    this.logger.log('🔍 Starting batch restaurant import...');
    this.logger.log('API Key present:', !!apiKey);

    if (!apiKey || apiKey === 'your_google_places_api_key') {
      throw new Error(
        '❌ GOOGLE_PLACES_API_KEY is not set or still has placeholder value in .env',
      );
    }

    // Fetch specified destinations
    const destinations = await this.destinationsRepo
      .createQueryBuilder('d')
      .where('d.id IN (:...ids)', { ids: destinationIds })
      .orderBy('d.id')
      .take(limit)
      .getMany();

    this.logger.log(
      `📍 Processing ${destinations.length} destinations:`,
      destinations.map((d) => `${d.name} (${d.city})`).join(', '),
    );

    let totalImported = 0;
    let totalFound = 0;
    const results: Array<{
      destination: string;
      city: string;
      processed?: number;
      found?: number;
      error?: string;
    }> = [];

    for (const destination of destinations) {
      try {
        this.logger.log(
          `\n⏳ Processing: ${destination.name} (${destination.city})`,
        );

        const query = `kosher restaurant in ${destination.name}`;
        this.logger.log(`   Query: "${query}"`);

        let pageToken: string | undefined;
        let pageNumber = 1;
        let foundOnThisDestination = 0;
        let importedOnThisDestination = 0;

        // Fetch up to 3 pages (Google returns ~20 results per page)
        while (pageNumber <= 3) {
          const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}${pageToken ? `&pagetoken=${pageToken}` : ''}`;

          const response = await axios.get(url);
          const places = response.data.results || [];

          if (places.length === 0) {
            this.logger.log(`   ✓ Page ${pageNumber}: No more results`);
            break;
          }

          this.logger.log(
            `   ✓ Page ${pageNumber}: Found ${places.length} results`,
          );
          foundOnThisDestination += places.length;
          totalFound += places.length;

          for (const place of places) {
            await this.processGooglePlace(place, apiKey, destination);
            totalImported++;
            importedOnThisDestination++;
          }

          // Check if there's a next page token
          if (!response.data.next_page_token) {
            this.logger.log(`   ✓ No more pages available`);
            break;
          }

          pageToken = response.data.next_page_token;
          pageNumber++;

          // Google API requires a small delay between page requests
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        this.logger.log(
          `   Summary for ${destination.name}: ${importedOnThisDestination} restaurants processed (${foundOnThisDestination} total found)`,
        );

        results.push({
          destination: destination.name,
          city: destination.city,
          processed: importedOnThisDestination,
          found: foundOnThisDestination,
        });

        // Add delay between destinations (5 seconds)
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        this.logger.error(
          `\n❌ Error importing for ${destination.name}:`,
          error.message,
        );
        if (error.response?.data) {
          this.logger.error(`   API Error: ${JSON.stringify(error.response.data)}`);
        }
        results.push({
          destination: destination.name,
          city: destination.city,
          error: error.message,
        });
        // Continue with next destination
      }
    }

    const summary = {
      message: `✅ Batch import complete: ${totalImported} restaurants processed across ${destinations.length} destinations (${totalFound} total found)`,
      stats: {
        totalProcessed: totalImported,
        totalFound,
        destinationsProcessed: destinations.length,
        results,
      },
    };

    this.logger.log('Batch Import Summary: ' + JSON.stringify(summary));
    return summary;
  }
}
