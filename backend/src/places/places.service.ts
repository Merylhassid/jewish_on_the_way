import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Destination } from '../destination.entity';
import { Restaurant } from '../restaurant.entity';
import { Synagogue } from '../synagogue.entity';

// ── Interfaces ────────────────────────────────────────────────────────────────

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
  types?: string[];
  geometry: { location: { lat: number; lng: number } };
  opening_hours?: { weekday_text?: string[] };
  rating?: number;
}

interface GooglePlaceDetails {
  name?: string;
  types?: string[];
  reviews?: Array<{ text: string }>;
  editorial_summary?: { overview: string };
  website?: string;
  formatted_phone_number?: string;
}

export interface KosherValidationResult {
  isKosher: boolean;
  evidence: string[];
  disqualifiers: string[];
}

export interface TypeClassificationResult {
  type: 'meat' | 'dairy' | 'pareve' | 'unknown';
  confidence: number;
  matchedKeywords: string[];
}

export interface AuditEntry {
  id: number;
  name: string;
  address?: string;
  kashrutLevel: string;
  restaurantType: string | null;
  kosherValidation: KosherValidationResult;
  typeClassification: TypeClassificationResult;
  decision: 'keep' | 'remove';
  reason: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const KOSHER_KEYWORDS = [
  'kosher', 'koscher', 'casher', 'kasher', 'כשר',
  'mehadrin', 'badatz', 'rabbinate', 'hechsher', 'hashgacha',
  'mashgiach', 'glatt', 'chalav yisrael', 'pas yisrael',
  'pareve', 'fleishig', 'milchig', 'cholov', 'bishul yisrael',
];

const NON_KOSHER_KEYWORDS = [
  'pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'lard',
  'shellfish', 'shrimp', 'lobster', 'crab', 'oyster', 'clam', 'mussel',
  'cheeseburger', 'treif', 'traif', 'non-kosher', 'not kosher',
  'char siu', 'pulled pork', 'ribs pork', 'pork belly',
];

const MEAT_KEYWORDS = [
  'steak', 'steakhouse', 'grill', 'grilled', 'bbq', 'barbecue',
  'burger', 'hamburger', 'shawarma', 'kebab', 'schnitzel',
  'smokehouse', 'chicken', 'meat', 'beef', 'lamb', 'veal',
];

const DAIRY_KEYWORDS = [
  'cafe', 'coffee', 'bakery', 'pizza', 'pasta', 'cheese',
  'dairy', 'milk', 'breakfast', 'brunch', 'ice cream', 'gelato',
  'creperie', 'patisserie', 'croissant', 'yogurt', 'milkshake',
];

const PAREVE_KEYWORDS = [
  'falafel', 'hummus', 'vegan', 'vegetarian', 'sushi',
  'fish', 'salad', 'poke', 'bowl', 'plant-based',
];

// ── Service ───────────────────────────────────────────────────────────────────

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

  // ── Public: sync one destination ─────────────────────────────────────────

  async syncDestination(destination: Destination): Promise<{
    restaurants: number;
    synagogues: number;
    chabad: number;
  }> {
    const { lat, lng } = this.extractCoords(destination.location);

    const synagogues = await this.syncSynagoguesFromOSM(destination, lat, lng);
    await this.sleep(3000);
    const chabad = await this.syncChabadFromOSM(destination, lat, lng);
    await this.sleep(2000);

    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    let restaurants = 0;
    if (apiKey && apiKey !== 'your_google_places_api_key') {
      restaurants = await this.syncRestaurantsFromGoogle(destination, lat, lng, apiKey);
    }

    return { restaurants, synagogues, chabad };
  }

  // ── Public: sync specific destinations by ID (req 7) ─────────────────────

  async syncSpecificDestinations(destinationIds: number[]): Promise<{
    totalRestaurants: number;
    totalSynagogues: number;
    results: Array<{ destinationId: number; city: string; restaurants: number; synagogues: number; error?: string }>;
  }> {
    const destinations = await this.restaurantsRepo.manager
      .getRepository(Destination)
      .find({ where: { id: In(destinationIds) } });

    const results: Array<{ destinationId: number; city: string; restaurants: number; synagogues: number; error?: string }> = [];
    let totalRestaurants = 0;
    let totalSynagogues = 0;

    for (const destination of destinations) {
      try {
        const result = await this.syncDestination(destination);
        results.push({
          destinationId: destination.id,
          city: destination.city,
          restaurants: result.restaurants,
          synagogues: result.synagogues + result.chabad,
        });
        totalRestaurants += result.restaurants;
        totalSynagogues += result.synagogues + result.chabad;
      } catch (err: any) {
        results.push({ destinationId: destination.id, city: destination.city, restaurants: 0, synagogues: 0, error: err.message });
      }
    }

    return { totalRestaurants, totalSynagogues, results };
  }

  // ── Public: get all destination IDs that currently have restaurants ─────────

  async getDestinationIdsWithRestaurants(): Promise<{
    destinationIds: number[];
    total: number;
    byDestination: Array<{ destinationId: number; city: string; country: string; count: number }>;
  }> {
    const rows = await this.restaurantsRepo
      .createQueryBuilder('r')
      .select('r.destinationId', 'destinationId')
      .addSelect('COUNT(r.id)', 'count')
      .groupBy('r.destinationId')
      .getRawMany<{ destinationId: number; count: string }>();

    if (rows.length === 0) return { destinationIds: [], total: 0, byDestination: [] };

    const ids = rows.map((row) => row.destinationId);
    const destinations = await this.restaurantsRepo.manager
      .getRepository(Destination)
      .find({ where: { id: In(ids) } });

    const destMap = new Map(destinations.map((d) => [d.id, d]));

    const byDestination = rows.map((row) => ({
      destinationId: row.destinationId,
      city: destMap.get(row.destinationId)?.city ?? `id:${row.destinationId}`,
      country: destMap.get(row.destinationId)?.country ?? '',
      count: parseInt(row.count, 10),
    }));

    return { destinationIds: ids, total: ids.length, byDestination };
  }

  // ── Public: audit specific destinations (req 1 + 2) ──────────────────────
  // Re-fetches Google Place Details per restaurant (reviews, types, editorial summary)
  // when googlePlaceId is available — zero writes.

  async auditDestinations(destinationIds: number[]): Promise<{
    totalScanned: number;
    totalKeep: number;
    totalRemove: number;
    byDestination: Array<{ destinationId: number; city: string; entries: AuditEntry[] }>;
  }> {
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY') ?? '';
    const destinations = await this.restaurantsRepo.manager
      .getRepository(Destination)
      .find({ where: { id: In(destinationIds) } });

    const byDestination: Array<{ destinationId: number; city: string; entries: AuditEntry[] }> = [];
    let totalScanned = 0;
    let totalKeep = 0;
    let totalRemove = 0;

    for (const destination of destinations) {
      const restaurants = await this.restaurantsRepo.find({
        where: { destination: { id: destination.id } },
      });

      const entries: AuditEntry[] = [];

      for (const r of restaurants) {
        // Re-fetch Google Place Details if we have a placeId — use all available evidence
        let reviews: string[] = [];
        let googleTypes: string[] = [];
        let editorialSummary = '';

        if (r.googlePlaceId && apiKey) {
          const details = await this.fetchPlaceDetails(r.googlePlaceId, apiKey);
          reviews = (details.reviews ?? []).map((rv) => rv.text);
          googleTypes = details.types ?? [];
          editorialSummary = details.editorial_summary?.overview ?? '';
        }

        const text = [r.name, r.address ?? '', editorialSummary].join(' ');
        const kosherValidation = this.validateKosher(text, reviews);
        const typeClassification = this.classifyType(text, googleTypes);

        let decision: 'keep' | 'remove' = 'keep';
        let reason = 'passes kosher validation';

        if (kosherValidation.disqualifiers.length > 0) {
          decision = 'remove';
          reason = `non-kosher indicators: ${kosherValidation.disqualifiers.join(', ')}`;
        } else if (!kosherValidation.isKosher) {
          decision = 'remove';
          reason = 'no positive kosher evidence found';
        }

        const entry: AuditEntry = {
          id: r.id,
          name: r.name,
          address: r.address,
          kashrutLevel: r.kashrutLevel,
          restaurantType: r.restaurantType,
          kosherValidation,
          typeClassification,
          decision,
          reason,
        };

        entries.push(entry);
        totalScanned++;
        if (decision === 'keep') totalKeep++;
        else totalRemove++;

        this.logger.log(
          `[AUDIT] "${r.name}" (id:${r.id}) dest:${destination.city} → ${decision.toUpperCase()} | ${reason} | type:${typeClassification.type}(${typeClassification.confidence.toFixed(2)}) | evidence:[${kosherValidation.evidence.join(',')}]`,
        );
      }

      byDestination.push({ destinationId: destination.id, city: destination.city, entries });
      this.logger.log(
        `[AUDIT SUMMARY] ${destination.city}: scanned=${restaurants.length} keep=${entries.filter((e) => e.decision === 'keep').length} remove=${entries.filter((e) => e.decision === 'remove').length}`,
      );
    }

    return { totalScanned, totalKeep, totalRemove, byDestination };
  }

  // ── Public: cleanup non-kosher restaurants (req 2, two-step) ─────────────

  async cleanupDestinations(
    destinationIds: number[],
    confirm: boolean,
  ): Promise<{
    mode: 'dry-run' | 'deleted';
    totalRemoved: number;
    removed: Array<{ id: number; name: string; destinationId: number; city: string; reason: string }>;
  }> {
    const audit = await this.auditDestinations(destinationIds);
    const toRemove: Array<{ id: number; name: string; destinationId: number; city: string; reason: string }> = [];

    for (const dest of audit.byDestination) {
      for (const entry of dest.entries) {
        if (entry.decision === 'remove') {
          toRemove.push({
            id: entry.id,
            name: entry.name,
            destinationId: dest.destinationId,
            city: dest.city,
            reason: entry.reason,
          });
        }
      }
    }

    if (confirm && toRemove.length > 0) {
      const ids = toRemove.map((r) => r.id);
      await this.restaurantsRepo.delete({ id: In(ids) });
      this.logger.log(`[CLEANUP] Deleted ${toRemove.length} non-kosher restaurants from destinations: ${destinationIds.join(', ')}`);
    } else if (confirm && toRemove.length === 0) {
      this.logger.log(`[CLEANUP] Nothing to delete — all restaurants passed kosher validation.`);
    } else {
      this.logger.log(`[CLEANUP DRY-RUN] Would delete ${toRemove.length} restaurants. Pass confirm:true to execute.`);
    }

    return {
      mode: confirm ? 'deleted' : 'dry-run',
      totalRemoved: toRemove.length,
      removed: toRemove,
    };
  }

  // ── Public: revalidate + reclassify existing restaurants (req 4) ──────────
  // For each restaurant: re-fetches Google Place Details (when googlePlaceId exists),
  // uses name + address + reviews + types + editorial summary for kosher check,
  // removes non-kosher, updates type classification + isKosher flag on survivors.

  async revalidateDestinations(destinationIds: number[]): Promise<{
    totalUpdated: number;
    totalRemoved: number;
    totalUnchanged: number;
    results: Array<{ id: number; name: string; city: string; action: string; newType?: string; newConfidence?: number; reason?: string }>;
  }> {
    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY') ?? '';
    const destinations = await this.restaurantsRepo.manager
      .getRepository(Destination)
      .find({ where: { id: In(destinationIds) } });

    const results: Array<{ id: number; name: string; city: string; action: string; newType?: string; newConfidence?: number; reason?: string }> = [];
    let totalUpdated = 0;
    let totalRemoved = 0;
    let totalUnchanged = 0;

    for (const destination of destinations) {
      const restaurants = await this.restaurantsRepo.find({
        where: { destination: { id: destination.id } },
      });

      let destRemoved = 0;
      let destUpdated = 0;

      for (const r of restaurants) {
        // Re-fetch full Google data when available
        let reviews: string[] = [];
        let googleTypes: string[] = [];
        let editorialSummary = '';

        if (r.googlePlaceId && apiKey) {
          const details = await this.fetchPlaceDetails(r.googlePlaceId, apiKey);
          reviews = (details.reviews ?? []).map((rv) => rv.text);
          googleTypes = details.types ?? [];
          editorialSummary = details.editorial_summary?.overview ?? '';
        }

        const text = [r.name, r.address ?? '', editorialSummary].join(' ');
        const kosherValidation = this.validateKosher(text, reviews);

        // Non-kosher → remove
        if (!kosherValidation.isKosher) {
          const reason = kosherValidation.disqualifiers.length > 0
            ? `non-kosher indicators: ${kosherValidation.disqualifiers.join(', ')}`
            : 'no positive kosher evidence';
          await this.restaurantsRepo.delete({ id: r.id });
          results.push({ id: r.id, name: r.name, city: destination.city, action: 'removed', reason });
          totalRemoved++;
          destRemoved++;
          this.logger.log(`[REVALIDATE] REMOVED "${r.name}" (id:${r.id}) dest:${destination.city} — ${reason}`);
          continue;
        }

        // Reclassify type using full evidence
        const classification = this.classifyType(text, googleTypes);

        const typeChanged = r.restaurantType !== classification.type;
        const confidenceChanged = Number(r.restaurantTypeConfidence) !== classification.confidence;
        const isKosherChanged = !r.isKosher;

        if (typeChanged || confidenceChanged || isKosherChanged) {
          r.restaurantType = classification.type;
          r.restaurantTypeConfidence = classification.confidence;
          r.isKosher = true;
          await this.restaurantsRepo.save(r);
          results.push({
            id: r.id,
            name: r.name,
            city: destination.city,
            action: 'updated',
            newType: classification.type,
            newConfidence: classification.confidence,
          });
          totalUpdated++;
          destUpdated++;
          this.logger.log(
            `[REVALIDATE] UPDATED "${r.name}" (id:${r.id}) dest:${destination.city} → type:${classification.type} conf:${classification.confidence.toFixed(2)} isKosher:true evidence:[${kosherValidation.evidence.join(',')}]`,
          );
        } else {
          results.push({ id: r.id, name: r.name, city: destination.city, action: 'unchanged' });
          totalUnchanged++;
        }
      }

      this.logger.log(
        `[REVALIDATE SUMMARY] ${destination.city}: scanned=${restaurants.length} removed=${destRemoved} updated=${destUpdated} unchanged=${restaurants.length - destRemoved - destUpdated}`,
      );
    }

    return { totalUpdated, totalRemoved, totalUnchanged, results };
  }

  // ── Kosher validation (req 3) ─────────────────────────────────────────────

  validateKosher(text: string, reviews: string[]): KosherValidationResult {
    const fullText = [text, ...reviews].join(' ').toLowerCase();
    const evidence: string[] = [];
    const disqualifiers: string[] = [];

    for (const kw of NON_KOSHER_KEYWORDS) {
      if (fullText.includes(kw)) {
        disqualifiers.push(kw);
      }
    }

    for (const kw of KOSHER_KEYWORDS) {
      if (fullText.includes(kw)) {
        evidence.push(kw);
      }
    }

    return {
      isKosher: evidence.length > 0 && disqualifiers.length === 0,
      evidence,
      disqualifiers,
    };
  }

  // ── Type classification (req 4) ───────────────────────────────────────────

  classifyType(text: string, types: string[]): TypeClassificationResult {
    const fullText = [text, ...types].join(' ').toLowerCase();

    const meatMatches = MEAT_KEYWORDS.filter((k) => fullText.includes(k));
    const dairyMatches = DAIRY_KEYWORDS.filter((k) => fullText.includes(k));
    const pareveMatches = PAREVE_KEYWORDS.filter((k) => fullText.includes(k));

    const meatScore = meatMatches.length;
    const dairyScore = dairyMatches.length;
    const pareveScore = pareveMatches.length;
    const total = meatScore + dairyScore + pareveScore;

    if (total === 0) return { type: 'unknown', confidence: 0, matchedKeywords: [] };

    if (meatScore > dairyScore && meatScore > pareveScore) {
      return { type: 'meat', confidence: parseFloat((meatScore / total).toFixed(2)), matchedKeywords: meatMatches };
    }
    if (dairyScore > meatScore && dairyScore > pareveScore) {
      return { type: 'dairy', confidence: parseFloat((dairyScore / total).toFixed(2)), matchedKeywords: dairyMatches };
    }
    // Pareve is NEVER default — only assigned with clear evidence and no meat/dairy conflict
    if (pareveScore > 0 && meatScore === 0 && dairyScore === 0) {
      return { type: 'pareve', confidence: parseFloat((pareveScore / total).toFixed(2)), matchedKeywords: pareveMatches };
    }

    return { type: 'unknown', confidence: 0, matchedKeywords: [] };
  }

  // ── Google Places sync (req 3 — strict kosher only) ──────────────────────

  private async syncRestaurantsFromGoogle(
    destination: Destination,
    lat: number,
    lng: number,
    apiKey: string,
  ): Promise<number> {
    const keywords = ['kosher', 'koscher', 'casher', 'kasher', 'כשר'];
    const allPlaces = new Map<string, GooglePlace>();

    for (const keyword of keywords) {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=15000&type=restaurant&keyword=${encodeURIComponent(keyword)}&key=${apiKey}`;
        const response = await fetch(url);
        const data = (await response.json()) as { status: string; results: GooglePlace[] };
        if (data.status === 'OK') {
          for (const place of data.results ?? []) {
            allPlaces.set(place.place_id, place);
          }
        }
        await this.sleep(300);
      } catch (err) {
        this.logger.error(`Google Places fetch error (${keyword}): ${err}`);
      }
    }

    let saved = 0;
    let skippedNonKosher = 0;

    for (const place of allPlaces.values()) {
      // Skip if already exists — update instead (req 5)
      const existing = await this.restaurantsRepo.findOne({
        where: { googlePlaceId: place.place_id },
      });

      // Get place details for reviews (strict kosher validation)
      const details = await this.fetchPlaceDetails(place.place_id, apiKey);
      const reviews = (details.reviews ?? []).map((r) => r.text);
      const text = [place.name, place.vicinity ?? '', ...(place.types ?? []), details.editorial_summary?.overview ?? ''].join(' ');

      // Strict kosher validation — only insert if strong kosher evidence (req 3)
      const kosherCheck = this.validateKosher(text, reviews);
      if (!kosherCheck.isKosher) {
        skippedNonKosher++;
        this.logger.log(`[SKIP] "${place.name}" — no strong kosher evidence. disqualifiers: [${kosherCheck.disqualifiers.join(', ')}]`);
        continue;
      }

      const allTypes = [...(place.types ?? []), ...(details.types ?? [])];
      const classification = this.classifyType(text, allTypes);

      if (existing) {
        // Update existing (req 5)
        existing.name = place.name;
        existing.address = place.vicinity;
        existing.rating = place.rating;
        existing.isKosher = true;
        existing.restaurantType = classification.type;
        existing.restaurantTypeConfidence = classification.confidence;
        if (place.geometry?.location) {
          existing.location = { type: 'Point', coordinates: [place.geometry.location.lng, place.geometry.location.lat] };
        }
        await this.restaurantsRepo.save(existing);
      } else {
        await this.restaurantsRepo.save(
          this.restaurantsRepo.create({
            googlePlaceId: place.place_id,
            name: place.name,
            address: place.vicinity,
            restaurantType: classification.type,
            restaurantTypeConfidence: classification.confidence,
            kashrutLevel: 'unknown',
            isKosher: true,
            openingHours: place.opening_hours?.weekday_text?.join(', '),
            rating: place.rating,
            location: {
              type: 'Point',
              coordinates: [place.geometry.location.lng, place.geometry.location.lat],
            },
            destination,
          }),
        );
        saved++;
      }

      await this.sleep(100);
    }

    this.logger.log(
      `[SYNC] ${destination.city}: saved=${saved} skipped(non-kosher)=${skippedNonKosher} total-found=${allPlaces.size}`,
    );
    return saved;
  }

  // ── Google Place Details (reviews + types for validation) ─────────────────

  private async fetchPlaceDetails(placeId: string, apiKey: string): Promise<GooglePlaceDetails> {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,types,reviews,editorial_summary&key=${apiKey}`;
      const response = await fetch(url);
      const data = (await response.json()) as { result?: GooglePlaceDetails };
      await this.sleep(100);
      return data.result ?? {};
    } catch {
      return {};
    }
  }

  // ── OpenStreetMap — synagogues ────────────────────────────────────────────

  private async syncSynagoguesFromOSM(destination: Destination, lat: number, lng: number): Promise<number> {
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
      const externalId = `osm:${el.type}:${el.id}`;
      const name = el.tags?.name || el.tags?.['name:en'] || 'Synagogue';
      if (name.toLowerCase().includes('chabad')) continue;
      if (await this.synagoguesRepo.findOne({ where: { externalId } })) continue;

      await this.synagoguesRepo.save(
        this.synagoguesRepo.create({
          externalId, name,
          type: this.detectSynagogueType(el.tags),
          address: this.buildOsmAddress(el.tags),
          openingHours: el.tags?.opening_hours,
          phoneNumber: el.tags?.phone || el.tags?.['contact:phone'],
          website: el.tags?.website || el.tags?.['contact:website'],
          location: { type: 'Point', coordinates: [elLng, elLat] },
          destination,
        }),
      );
      saved++;
    }

    this.logger.log(`Saved ${saved} new synagogues for ${destination.city}`);
    return saved;
  }

  private async syncChabadFromOSM(destination: Destination, lat: number, lng: number): Promise<number> {
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
      const externalId = `osm:${el.type}:${el.id}`;
      if (await this.synagoguesRepo.findOne({ where: { externalId } })) continue;

      await this.synagoguesRepo.save(
        this.synagoguesRepo.create({
          externalId,
          name: el.tags?.name || el.tags?.['name:en'] || 'Chabad House',
          type: 'chabad',
          address: this.buildOsmAddress(el.tags),
          openingHours: el.tags?.opening_hours,
          phoneNumber: el.tags?.phone || el.tags?.['contact:phone'],
          website: el.tags?.website || el.tags?.['contact:website'],
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
        method: 'POST', body: query,
        headers: { 'Content-Type': 'text/plain' },
      });
      const data = (await response.json()) as { elements: OsmElement[] };
      return data.elements ?? [];
    } catch (err) {
      this.logger.error(`Overpass API error: ${err}`);
      return [];
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private osmCoords(el: OsmElement): { elLat: number; elLng: number } {
    return { elLat: el.lat ?? el.center?.lat ?? 0, elLng: el.lon ?? el.center?.lon ?? 0 };
  }

  private buildOsmAddress(tags?: Record<string, string>): string | undefined {
    if (!tags) return undefined;
    const parts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']].filter(Boolean);
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

  extractCoords(location: any): { lat: number; lng: number } {
    if (location?.coordinates) return { lng: location.coordinates[0], lat: location.coordinates[1] };
    return { lat: 0, lng: 0 };
  }
}
