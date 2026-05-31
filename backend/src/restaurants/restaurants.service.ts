import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Restaurant } from '../restaurant.entity';
import { Destination } from '../destination.entity';
import axios from 'axios';

export interface RestaurantFilters {
  type?: string;
  kashrut?: string;
  q?: string;
  lat?: number;
  lng?: number;
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

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private restaurantsRepo: Repository<Restaurant>,
    @InjectRepository(Destination)
    private destinationsRepo: Repository<Destination>,
  ) {}

  // req 4.1 — list restaurants with optional filters + distance
  async findByDestination(
    destinationId: number,
    filters: RestaurantFilters = {},
  ): Promise<Restaurant[]> {
    const { type, kashrut, q, lat, lng } = filters;

    // With distance: use raw SQL so PostGIS can compute ST_Distance
    if (lat !== undefined && lng !== undefined) {
      let sql = `
        SELECT
          r.id,
          r.name,
          r.restaurant_type   AS "restaurantType",
          r.kashrut_level     AS "kashrutLevel",
          r.address,
          r.opening_hours     AS "openingHours",
          r.created_at        AS "createdAt",
          ROUND(
            ST_Distance(
              r.location::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            )::numeric
          ) AS "distanceMeters"
        FROM restaurants r
        WHERE r."destinationId" = $3
      `;
      const params: (string | number)[] = [lng, lat, destinationId];
      let idx = 4;

      if (type) {
        sql += ` AND r.restaurant_type = $${idx}`;
        params.push(type);
        idx++;
      }
      if (kashrut) {
        sql += ` AND r.kashrut_level   = $${idx}`;
        params.push(kashrut);
        idx++;
      }
      if (q) {
        sql += ` AND r.name ILIKE $${idx}`;
        params.push(`%${q}%`);
        idx++;
      }

      sql += ' ORDER BY "distanceMeters" ASC';
      return this.restaurantsRepo.query(sql, params);
    }

    // Without distance: use find() with where object
    const where: any = { destination: { id: destinationId } };
    if (type) where.restaurantType = type;
    if (kashrut) where.kashrutLevel = kashrut;

    let results = await this.restaurantsRepo.find({
      where,
      select: {
        id: true,
        name: true,
        restaurantType: true,
        kashrutLevel: true,
        address: true,
        openingHours: true,
        createdAt: true,
      },
      order: { name: 'ASC' },
    });

    if (q) {
      const lq = q.toLowerCase();
      results = results.filter((r) => r.name.toLowerCase().includes(lq));
    }

    return results;
  }

  // כל המסעדות מכל ערי מדינה אחת, ממויינות לפי מרחק
  async findByParentDestination(parentId: number, filters: RestaurantFilters = {}): Promise<any[]> {
    const { type, kashrut, q, lat, lng } = filters;

    if (lat !== undefined && lng !== undefined) {
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
      if (type)    { sql += ` AND r.restaurant_type = $${idx}`; params.push(type);       idx++; }
      if (kashrut) { sql += ` AND r.kashrut_level   = $${idx}`; params.push(kashrut);    idx++; }
      if (q)       { sql += ` AND r.name ILIKE $${idx}`;        params.push(`%${q}%`);   idx++; }
      sql += ' ORDER BY "distanceMeters" ASC';
      return this.restaurantsRepo.query(sql, params);
    }

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
    if (type)    { sql += ` AND r.restaurant_type = $${idx}`; params.push(type);     idx++; }
    if (kashrut) { sql += ` AND r.kashrut_level   = $${idx}`; params.push(kashrut);  idx++; }
    if (q)       { sql += ` AND r.name ILIKE $${idx}`;        params.push(`%${q}%`); idx++; }
    sql += ' ORDER BY d.city ASC, r.name ASC';
    return this.restaurantsRepo.query(sql, params);
  }

  // req 4.4 — single restaurant details
  async findOne(id: number) {
    const restaurant = await this.restaurantsRepo
      .createQueryBuilder('r')
      .select([
        'r.id',
        'r.name',
        'r.restaurantType',
        'r.kashrutLevel',
        'r.address',
        'r.openingHours',
        'r.createdAt',
      ])
      .leftJoinAndSelect('r.destination', 'destination')
      .where('r.id = :id', { id })
      .getOne();

    if (!restaurant) throw new NotFoundException(`Restaurant #${id} not found`);
    return restaurant;
  }

  // Import kosher restaurants from Google Places API for all destinations
  async importKosherRestaurantsFromGoogle() {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    console.log('🔍 Starting restaurant import...');
    console.log('API Key present:', !!apiKey);

    if (!apiKey || apiKey === 'your_google_places_api_key') {
      throw new Error(
        '❌ GOOGLE_PLACES_API_KEY is not set or still has placeholder value in .env',
      );
    }

    const destinations = await this.destinationsRepo.find();
    console.log(
      `📍 Found ${destinations.length} destinations to process:\n`,
      destinations.map((d) => d.name).join(', '),
    );

    let totalImported = 0;
    let totalFound = 0;
    const destinationStats: { [key: string]: number } = {};

    for (const destination of destinations) {
      try {
        console.log(`\n⏳ Processing: ${destination.name}`);

        const query = `kosher restaurant in ${destination.name}`;
        console.log(`   Query: "${query}"`);

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
            console.log(`   ✓ Page ${pageNumber}: No more results`);
            break;
          }

          console.log(
            `   ✓ Page ${pageNumber}: Found ${places.length} results`,
          );
          foundOnThisDestination += places.length;
          totalFound += places.length;

          for (const place of places) {
            // Check if restaurant already exists by googlePlaceId
            const existing = await this.restaurantsRepo.findOne({
              where: { googlePlaceId: place.place_id },
            });

            // Get detailed place information for better classification
            const placeDetails = await this.getPlaceDetails(
              place.place_id,
              apiKey,
            );

            // Classify restaurant type based on available data
            const classification = this.classifyRestaurantType(
              place,
              placeDetails,
            );

            console.log(
              `      📊 Classification for "${place.name}": ${classification.type || 'unknown'} (confidence: ${classification.confidence.toFixed(2)}) | meat=[${classification.keywords.meat.join(', ')}] dairy=[${classification.keywords.dairy.join(', ')}] pareve=[${classification.keywords.pareve.join(', ')}]`,
            );

            if (existing) {
              // Update existing restaurant with new classification and data
              existing.restaurantType = classification.type ?? null;
              existing.restaurantTypeConfidence = classification.confidence;
              existing.rating = place.rating || existing.rating;
              existing.address = place.formatted_address;
              existing.name = place.name;
              existing.location = {
                type: 'Point',
                coordinates: [
                  place.geometry.location.lng,
                  place.geometry.location.lat,
                ],
              };
              existing.isKosher = true;

              await this.restaurantsRepo.save(existing);
              totalImported++;
              destinationStats[destination.name]++;

              console.log(
                `      🔄 Updated: "${place.name}" (rating: ${place.rating || 'N/A'}, type: ${classification.type || 'unknown'})`,
              );
            } else {
              // Create new restaurant with proper PostGIS location format
              const restaurant = this.restaurantsRepo.create({
                googlePlaceId: place.place_id,
                name: place.name,
                address: place.formatted_address,
                rating: place.rating || undefined,
                isKosher: true,
                restaurantType: classification.type ?? null,
                restaurantTypeConfidence: classification.confidence,
                kashrutLevel: 'unknown', // Will be updated manually later
                location: {
                  type: 'Point',
                  coordinates: [
                    place.geometry.location.lng,
                    place.geometry.location.lat,
                  ],
                },
                destination,
              });

              await this.restaurantsRepo.save(restaurant);
              totalImported++;
              destinationStats[destination.name]++;

              console.log(
                `      ✅ Imported: "${place.name}" (rating: ${place.rating || 'N/A'}, type: ${classification.type || 'unknown'})`,
              );
            }
          }

          // Check if there's a next page token
          if (!response.data.next_page_token) {
            console.log(`   ✓ No more pages available`);
            break;
          }

          pageToken = response.data.next_page_token;
          pageNumber++;

          // Google API requires a small delay between page requests
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        console.log(
          `   Summary for ${destination.name}: ${destinationStats[destination.name]} restaurants processed (${foundOnThisDestination} total found)`,
        );
      } catch (error) {
        console.error(
          `\n❌ Error importing for ${destination.name}:`,
          error.message,
        );
        if (error.response?.data) {
          console.error(`   API Error: ${JSON.stringify(error.response.data)}`);
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

    console.log('\n📊 Final Summary:', summary);
    return summary;
  }

  // Reclassify all existing restaurants in the database
  async reclassifyExistingRestaurants() {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const restaurants = await this.restaurantsRepo.find();
    let updatedCount = 0;

    console.log(
      `🔄 Starting reclassification for ${restaurants.length} existing restaurants...`,
    );

    for (const restaurant of restaurants) {
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

        console.log(
          `      🔄 Reclassified "${restaurant.name}": ${newType || 'unknown'} (confidence: ${newConfidence.toFixed(2)}) | meat=[${classification.keywords.meat.join(', ')}] dairy=[${classification.keywords.dairy.join(', ')}] pareve=[${classification.keywords.pareve.join(', ')}]`,
        );
      } catch (error) {
        console.error(
          `      ❌ Failed to reclassify "${restaurant.name}":`,
          error.message,
        );
      }
    }

    const summary = {
      message: `✅ Reclassification complete: ${updatedCount} restaurants updated out of ${restaurants.length}`,
      totalRestaurants: restaurants.length,
      updated: updatedCount,
    };

    console.log('\n📊 Reclassification Summary:', summary);
    return summary;
  }

  // Get detailed place information from Google Places Details API
  private async getPlaceDetails(placeId: string, apiKey: string) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,reviews,editorial_summary,types&key=${apiKey}`;
      const response = await axios.get(url);
      return response.data.result || {};
    } catch (error) {
      console.warn(
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

  // Batch import restaurants for specified destinations
  async importBatch(destinationIds: number[], limit: number) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    console.log('🔍 Starting batch restaurant import...');
    console.log('API Key present:', !!apiKey);

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

    console.log(
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
        console.log(
          `\n⏳ Processing: ${destination.name} (${destination.city})`,
        );

        const query = `kosher restaurant in ${destination.name}`;
        console.log(`   Query: "${query}"`);

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
            console.log(`   ✓ Page ${pageNumber}: No more results`);
            break;
          }

          console.log(
            `   ✓ Page ${pageNumber}: Found ${places.length} results`,
          );
          foundOnThisDestination += places.length;
          totalFound += places.length;

          for (const place of places) {
            // Check if restaurant already exists by googlePlaceId
            const existing = await this.restaurantsRepo.findOne({
              where: { googlePlaceId: place.place_id },
            });

            // Get detailed place information for better classification
            const placeDetails = await this.getPlaceDetails(
              place.place_id,
              apiKey,
            );

            // Classify restaurant type based on available data
            const classification = this.classifyRestaurantType(
              place,
              placeDetails,
            );

            console.log(
              `      📊 Classification for "${place.name}": ${classification.type || 'unknown'} (confidence: ${classification.confidence.toFixed(2)}) | meat=[${classification.keywords.meat.join(', ')}] dairy=[${classification.keywords.dairy.join(', ')}] pareve=[${classification.keywords.pareve.join(', ')}]`,
            );

            if (existing) {
              // Update existing restaurant with new classification and data
              existing.restaurantType = classification.type ?? null;
              existing.restaurantTypeConfidence = classification.confidence;
              existing.rating = place.rating || existing.rating;
              existing.address = place.formatted_address;
              existing.name = place.name;
              existing.location = {
                type: 'Point',
                coordinates: [
                  place.geometry.location.lng,
                  place.geometry.location.lat,
                ],
              };
              existing.isKosher = true;

              await this.restaurantsRepo.save(existing);
              totalImported++;
              importedOnThisDestination++;

              console.log(
                `      🔄 Updated: "${place.name}" (rating: ${place.rating || 'N/A'}, type: ${classification.type || 'unknown'})`,
              );
            } else {
              // Create new restaurant with proper PostGIS location format
              const restaurant = this.restaurantsRepo.create({
                googlePlaceId: place.place_id,
                name: place.name,
                address: place.formatted_address,
                rating: place.rating || undefined,
                isKosher: true,
                restaurantType: classification.type ?? null,
                restaurantTypeConfidence: classification.confidence,
                kashrutLevel: 'unknown', // Will be updated manually later
                location: {
                  type: 'Point',
                  coordinates: [
                    place.geometry.location.lng,
                    place.geometry.location.lat,
                  ],
                },
                destination,
              });

              await this.restaurantsRepo.save(restaurant);
              totalImported++;
              importedOnThisDestination++;

              console.log(
                `      ✅ Imported: "${place.name}" (rating: ${place.rating || 'N/A'}, type: ${classification.type || 'unknown'})`,
              );
            }
          }

          // Check if there's a next page token
          if (!response.data.next_page_token) {
            console.log(`   ✓ No more pages available`);
            break;
          }

          pageToken = response.data.next_page_token;
          pageNumber++;

          // Google API requires a small delay between page requests
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        console.log(
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
        console.error(
          `\n❌ Error importing for ${destination.name}:`,
          error.message,
        );
        if (error.response?.data) {
          console.error(`   API Error: ${JSON.stringify(error.response.data)}`);
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

    console.log('\n📊 Batch Import Summary:', summary);
    return summary;
  }
}
