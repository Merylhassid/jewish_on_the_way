import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Destination } from '../destination.entity';
import { Restaurant } from '../restaurant.entity';
import { Synagogue } from '../synagogue.entity';
import { CandidateSynagogue } from '../candidate-synagogue.entity';
import { parseOsmElement } from './osm-parser';
import { WikidataService, WikidataEnrichment } from './wikidata.service';

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
    @InjectRepository(Restaurant)
    private restaurantsRepo: Repository<Restaurant>,
    @InjectRepository(Synagogue) private synagoguesRepo: Repository<Synagogue>,
    @InjectRepository(CandidateSynagogue)
    private candidateSynagoguesRepo: Repository<CandidateSynagogue>,
    private wikidataService: WikidataService,
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
      restaurants = await this.syncRestaurantsFromGoogle(
        destination,
        lat,
        lng,
        apiKey,
      );
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
    let created = 0;

    for (const el of elements) {
      // Parse OSM element into candidate
      const parsed = parseOsmElement(el);
      if (!parsed) {
        this.logger.debug(`Skipped invalid OSM element: ${el.type}/${el.id}`);
        continue;
      }

      // Skip if it looks like a Chabad house (already handled separately)
      if (parsed.name.toLowerCase().includes('chabad')) {
        continue;
      }

      // Enrich from Wikidata if we have a QID
      let enrichment: WikidataEnrichment | null = null;
      if (parsed.wikidata) {
        enrichment = await this.wikidataService.enrichFromWikidata(
          parsed.wikidata,
        );
      }

      // Merge enriched data into candidate
      const candidateData = {
        name: parsed.name,
        normalizedName: parsed.normalizedName,
        location: {
          type: 'Point' as const,
          coordinates: [parsed.coords.lon, parsed.coords.lat],
        },
        destination,
        website: enrichment?.website || parsed.website,
        phone: enrichment?.phone || parsed.phone,
        openingHours: parsed.openingHours,
        addrStreet: parsed.addrStreet,
        addrHousenumber: parsed.addrHousenumber,
        addrPostcode: parsed.addrPostcode,
        addrCity: parsed.addrCity,
        wikidata: parsed.wikidata,
        wikipedia: enrichment?.wikipedia || parsed.wikipedia,
        denomination: parsed.denomination,
        operator: parsed.operator,
        source: 'osm',
        sourceId: parsed.osmId,
        rawOsm: parsed.rawTags,
        sourceConfidence: parsed.sourceConfidence,
        validationReasons: parsed.validationReasons.join(','),
        status: 'pending' as const,
      };

      // Upsert candidate (update if same sourceId + destination, else create)
      try {
        const existing = await this.candidateSynagoguesRepo.findOne({
          where: {
            sourceId: parsed.osmId,
            destination: { id: destination.id },
          },
        });

        if (existing) {
          // Update existing candidate
          await this.candidateSynagoguesRepo.update(existing.id, candidateData);
          this.logger.debug(
            `Updated candidate ${parsed.osmId} for ${destination.city}`,
          );
        } else {
          // Create new candidate
          await this.candidateSynagoguesRepo.save(
            this.candidateSynagoguesRepo.create(candidateData),
          );
          created++;
          this.logger.debug(
            `Created candidate ${parsed.osmId} for ${destination.city}`,
          );
        }
      } catch (err) {
        this.logger.error(`Error saving candidate ${parsed.osmId}:`, err);
      }
    }

    this.logger.log(
      `Created/updated candidates for ${created} synagogues in ${destination.city}`,
    );
    return created;
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
    let created = 0;

    for (const el of elements) {
      // Parse OSM element into candidate
      const parsed = parseOsmElement(el);
      if (!parsed) {
        this.logger.debug(`Skipped invalid OSM element: ${el.type}/${el.id}`);
        continue;
      }

      // Ensure this is actually a Chabad house
      if (
        !parsed.name.toLowerCase().includes('chabad') &&
        !parsed.operator?.toLowerCase().includes('chabad')
      ) {
        continue;
      }

      // Enrich from Wikidata if we have a QID
      let enrichment: WikidataEnrichment | null = null;
      if (parsed.wikidata) {
        enrichment = await this.wikidataService.enrichFromWikidata(
          parsed.wikidata,
        );
      }

      // Merge enriched data into candidate
      const candidateData = {
        name: parsed.name,
        normalizedName: parsed.normalizedName,
        location: {
          type: 'Point' as const,
          coordinates: [parsed.coords.lon, parsed.coords.lat],
        },
        destination,
        website: enrichment?.website || parsed.website,
        phone: enrichment?.phone || parsed.phone,
        openingHours: parsed.openingHours,
        addrStreet: parsed.addrStreet,
        addrHousenumber: parsed.addrHousenumber,
        addrPostcode: parsed.addrPostcode,
        addrCity: parsed.addrCity,
        wikidata: parsed.wikidata,
        wikipedia: enrichment?.wikipedia || parsed.wikipedia,
        denomination: 'Chabad',
        operator: parsed.operator,
        source: 'osm',
        sourceId: parsed.osmId,
        rawOsm: parsed.rawTags,
        sourceConfidence: parsed.sourceConfidence,
        validationReasons: parsed.validationReasons.join(','),
        status: 'pending' as const,
      };

      // Upsert candidate (update if same sourceId + destination, else create)
      try {
        const existing = await this.candidateSynagoguesRepo.findOne({
          where: {
            sourceId: parsed.osmId,
            destination: { id: destination.id },
          },
        });

        if (existing) {
          // Update existing candidate
          await this.candidateSynagoguesRepo.update(existing.id, candidateData);
          this.logger.debug(
            `Updated Chabad candidate ${parsed.osmId} for ${destination.city}`,
          );
        } else {
          // Create new candidate
          await this.candidateSynagoguesRepo.save(
            this.candidateSynagoguesRepo.create(candidateData),
          );
          created++;
          this.logger.debug(
            `Created Chabad candidate ${parsed.osmId} for ${destination.city}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Error saving Chabad candidate ${parsed.osmId}:`,
          err,
        );
      }
    }

    this.logger.log(
      `Created/updated Chabad candidates for ${created} Chabad houses in ${destination.city}`,
    );
    return created;
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
    if (name.includes('chabad') || denomination.includes('chabad'))
      return 'chabad';
    if (denomination.includes('reform') || denomination.includes('liberal'))
      return 'reform';
    if (
      denomination.includes('conservative') ||
      denomination.includes('masorti')
    )
      return 'conservative';
    return 'synagogue';
  }

  private extractCoords(location: any): { lat: number; lng: number } {
    if (location?.coordinates) {
      return { lng: location.coordinates[0], lat: location.coordinates[1] };
    }
    return { lat: 0, lng: 0 };
  }
}
