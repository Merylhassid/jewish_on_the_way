import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Destination } from '../destination.entity';
import { Restaurant } from '../restaurant.entity';
import { Synagogue } from '../synagogue.entity';

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface GooglePlace {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: { location: { lat: number; lng: number } };
  opening_hours?: { weekday_text?: string[] };
}

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    private config: ConfigService,
    @InjectRepository(Restaurant) private restaurantsRepo: Repository<Restaurant>,
    @InjectRepository(Synagogue) private synagoguesRepo: Repository<Synagogue>,
  ) {}

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Main sync — OpenStreetMap for synagogues/Chabad (free), Google for restaurants (optional)
  async syncDestination(destination: Destination): Promise<{
    restaurants: number;
    synagogues: number;
    chabad: number;
  }> {
    const { lat, lng } = this.extractCoords(destination.location);

    // Run sequentially with delay to respect Overpass API rate limits
    const synagogues = await this.syncSynagoguesFromOSM(destination, lat, lng);
    await this.sleep(3000);
    const chabad = await this.syncChabadFromOSM(destination, lat, lng);
    await this.sleep(2000);

    // Google restaurants — only runs if API key is configured
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    let restaurants = 0;
    if (apiKey && apiKey !== 'your_google_places_api_key') {
      restaurants = await this.syncRestaurantsFromGoogle(destination, lat, lng, apiKey);
    }

    return { restaurants, synagogues, chabad };
  }

  // ── OpenStreetMap (Overpass API) — FREE ──────────────────────

  private async syncSynagoguesFromOSM(
    destination: Destination,
    lat: number,
    lng: number,
  ): Promise<number> {
    const query = `
      [out:json][timeout:30];
      (
        node["amenity"="place_of_worship"]["religion"="jewish"](around:15000,${lat},${lng});
        way["amenity"="place_of_worship"]["religion"="jewish"](around:15000,${lat},${lng});
      );
      out center;
    `;

    const elements = await this.overpassQuery(query);
    let saved = 0;

    for (const el of elements) {
      const { elLat, elLng } = this.osmCoords(el);
      if (!elLat || !elLng) continue;

      const name = el.tags?.name || el.tags?.['name:en'] || 'Synagogue';

      // Skip if it looks like a Chabad house
      const isChabad = name.toLowerCase().includes('chabad') ||
        (el.tags?.operator ?? '').toLowerCase().includes('chabad');
      if (isChabad) continue;

      const exists = await this.synagoguesRepo.findOne({ where: { name, destination: { id: destination.id } } });
      if (exists) continue;

      await this.synagoguesRepo.save(
        this.synagoguesRepo.create({
          name,
          location: { type: 'Point', coordinates: [elLng, elLat] },
          destination,
        }),
      );
      saved++;
    }

    this.logger.log(`Saved ${saved} new synagogues for ${destination.city}`);
    return saved;
  }

  private async syncChabadFromOSM(
    destination: Destination,
    lat: number,
    lng: number,
  ): Promise<number> {
    const query = `
      [out:json][timeout:30];
      (
        node["name"~"[Cc]habad"](around:15000,${lat},${lng});
        node["operator"~"[Cc]habad"](around:15000,${lat},${lng});
        way["name"~"[Cc]habad"](around:15000,${lat},${lng});
      );
      out center;
    `;

    const elements = await this.overpassQuery(query);
    let saved = 0;

    for (const el of elements) {
      const { elLat, elLng } = this.osmCoords(el);
      if (!elLat || !elLng) continue;

      const name = el.tags?.name || el.tags?.['name:en'] || 'Chabad House';

      const exists = await this.synagoguesRepo.findOne({ where: { name, destination: { id: destination.id } } });
      if (exists) continue;

      await this.synagoguesRepo.save(
        this.synagoguesRepo.create({
          name,
          location: { type: 'Point', coordinates: [elLng, elLat] },
          destination,
        }),
      );
      saved++;
    }

    this.logger.log(`Saved ${saved} new Chabad houses for ${destination.city}`);
    return saved;
  }

  private async overpassQuery(query: string): Promise<OsmElement[]> {
    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain' },
      });

      const data = (await response.json()) as { elements: OsmElement[] };
      return data.elements ?? [];
    } catch (err) {
      this.logger.error(`Overpass API error: ${err}`);
      return [];
    }
  }

  // ── Google Places — only used if API key is set ───────────────

  private async syncRestaurantsFromGoogle(
    destination: Destination,
    lat: number,
    lng: number,
    apiKey: string,
  ): Promise<number> {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=10000&type=restaurant&keyword=kosher&key=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = (await response.json()) as {
        status: string;
        results: GooglePlace[];
      };

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        this.logger.error(`Google Places error: ${data.status}`);
        return 0;
      }

      let saved = 0;
      for (const place of data.results ?? []) {
        const exists = await this.restaurantsRepo.findOne({
          where: { googlePlaceId: place.place_id },
        });
        if (exists) continue;

        await this.restaurantsRepo.save(
          this.restaurantsRepo.create({
            googlePlaceId: place.place_id,
            name: place.name,
            address: place.vicinity,
            restaurantType: 'unknown',
            kashrutLevel: 'unknown',
            openingHours: place.opening_hours?.weekday_text?.join(', '),
            location: {
              type: 'Point',
              coordinates: [
                place.geometry.location.lng,
                place.geometry.location.lat,
              ],
            },
            destination,
          }),
        );
        saved++;
      }

      this.logger.log(`Saved ${saved} new restaurants for ${destination.city}`);
      return saved;
    } catch (err) {
      this.logger.error(`Google Places fetch error: ${err}`);
      return 0;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  private osmCoords(el: OsmElement): { elLat: number; elLng: number } {
    const elLat = el.lat ?? el.center?.lat ?? 0;
    const elLng = el.lon ?? el.center?.lon ?? 0;
    return { elLat, elLng };
  }

  private buildOsmAddress(tags?: Record<string, string>): string | undefined {
    if (!tags) return undefined;
    const parts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:city'],
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : tags['addr:full'];
  }

  private detectSynagogueType(tags?: Record<string, string>): string {
    const name = (tags?.name ?? '').toLowerCase();
    const denomination = (tags?.denomination ?? '').toLowerCase();
    if (name.includes('chabad') || denomination.includes('chabad')) return 'chabad';
    if (denomination.includes('reform') || denomination.includes('liberal')) return 'reform';
    if (denomination.includes('conservative') || denomination.includes('masorti')) return 'conservative';
    return 'synagogue';
  }

  private extractCoords(location: any): { lat: number; lng: number } {
    if (location?.coordinates) {
      return { lng: location.coordinates[0], lat: location.coordinates[1] };
    }
    return { lat: 0, lng: 0 };
  }
}
