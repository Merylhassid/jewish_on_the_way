import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Destination } from '../destination.entity';
import { Synagogue } from '../synagogue.entity';
import { normalizeNameForDedup } from '../places/name-normalizer';
import { ManualSynagogueBulkRowDto } from './dto/manual-synagogue-bulk-row.dto';

type ManualBulkAction = 'created' | 'updated' | 'skipped' | 'error';

export interface ManualSynagogueBulkRowResult {
  index: number;
  action: ManualBulkAction;
  destinationId: number;
  name: string;
  synagogueId?: number;
  locationResolved: boolean;
  needsLocationVerification: boolean;
  message: string;
  error?: string;
}

export interface ManualSynagogueBulkResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  results: ManualSynagogueBulkRowResult[];
}

interface PreparedManualSynagogueRow {
  index: number;
  row: ManualSynagogueBulkRowDto;
  destination: Destination;
  normalizedName: string;
  location: { type: 'Point'; coordinates: [number, number] } | null;
  locationResolved: boolean;
}

@Injectable()
export class ManualSynagogueImportService {
  private readonly logger = new Logger(ManualSynagogueImportService.name);
  private readonly geocodeCache = new Map<
    string,
    { location: { lat: number; lon: number } | null; timestamp: number }
  >();
  private lastNominatimRequestAt = 0;
  private readonly nominatimCacheTtlMs = 5 * 60 * 1000;
  private readonly nominatimMinIntervalMs = 1100;

  private readonly cityCenters: Record<string, { lat: number; lon: number }> = {
    'Vienna':      { lat: 48.2092, lon: 16.3728 },
    'גבעת שמואל': { lat: 32.0799, lon: 34.8432 },
    'גבעתיים':    { lat: 32.0693, lon: 34.8117 },
    'חדרה':       { lat: 32.4344, lon: 34.9197 },
    'חיפה':       { lat: 32.7940, lon: 34.9896 },
    'הוד השרון':  { lat: 32.1501, lon: 34.8885 },
    'ירושלים':    { lat: 31.7683, lon: 35.2137 },
    'קרית אתא':   { lat: 32.8134, lon: 35.1082 },
    'קרית ביאליק': { lat: 32.8344, lon: 35.0731 },
    'גדרה':       { lat: 31.8127, lon: 34.7757 },
    'גן יבנה':    { lat: 31.7894, lon: 34.7068 },
    'אילת':       { lat: 29.5581, lon: 34.3116 },
    'דימונה':     { lat: 31.0642, lon: 34.7583 },
    'קרית גת':     { lat: 31.6100, lon: 34.7642 },
    'קריית מוצקין': { lat: 32.8363, lon: 35.0759 },
    'קריית אונו':   { lat: 32.0602, lon: 34.8542 },
    'קרית שמונה':  { lat: 33.2075, lon: 35.5710 },
    'לוד':          { lat: 31.9516, lon: 34.8950 },
    'מעלה אדומים':  { lat: 31.7770, lon: 35.2964 },
    'מזכרת בתיה':   { lat: 31.8514, lon: 34.8412 },
    'מבשרת ציון':   { lat: 31.8057, lon: 35.1527 },
    'מגדל העמק':    { lat: 32.6766, lon: 35.2413 },
    'מודיעין':      { lat: 31.9086, lon: 35.0069 },
    'נהריה':        { lat: 33.0063, lon: 35.0946 },
    'נס ציונה':     { lat: 31.9296, lon: 34.7991 },
    'נתניה':        { lat: 32.3286, lon: 34.8566 },
    'נתיבות':       { lat: 31.4229, lon: 34.5888 },
    'אור יהודה':    { lat: 32.0330, lon: 34.8554 },
    'פרדס חנה כרכור': { lat: 32.4721, lon: 34.9688 },
    'פתח תקווה':      { lat: 32.0867, lon: 34.8858 },
    'רעננה':          { lat: 32.1842, lon: 34.8706 },
    'רמת גן':         { lat: 32.0680, lon: 34.8248 },
    'רמת השרון':      { lat: 32.1465, lon: 34.8393 },
    'רמלה':           { lat: 31.9267, lon: 34.8674 },
    'רחובות':         { lat: 31.8939, lon: 34.8113 },
    'ראשון לציון':    { lat: 31.9730, lon: 34.7897 },
    'ראש העין':       { lat: 32.0956, lon: 34.9558 },
    'ראש פינה':       { lat: 32.9613, lon: 35.5707 },
    'סביון':          { lat: 32.0256, lon: 34.8636 },
    'שדרות':          { lat: 31.5240, lon: 34.5986 },
    'שוהם':           { lat: 31.9897, lon: 34.9406 },
    'טבריה':          { lat: 32.7922, lon: 35.5312 },
    'יבנה':           { lat: 31.8739, lon: 34.7408 },
    'יהוד':           { lat: 32.0334, lon: 34.8883 },
    'יקנעם':          { lat: 32.6592, lon: 35.1050 },
    'זכרון יעקב':     { lat: 32.5689, lon: 34.9517 },
    'קיסריה':         { lat: 32.5000, lon: 34.9060 },
    'עפולה':          { lat: 32.6092, lon: 35.2886 },
    'אשקלון':         { lat: 31.6688, lon: 34.5742 },
  };

  constructor(
    @InjectRepository(Destination)
    private readonly destinationsRepo: Repository<Destination>,
    @InjectRepository(Synagogue)
    private readonly synagoguesRepo: Repository<Synagogue>,
  ) {}

  async bulkImport(
    rows: ManualSynagogueBulkRowDto[],
  ): Promise<ManualSynagogueBulkResult> {
    const results: ManualSynagogueBulkRowResult[] = [];
    const preparedRows: PreparedManualSynagogueRow[] = [];
    const seenInputs = new Set<string>();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const [index, row] of rows.entries()) {
      const normalizedName = normalizeNameForDedup(row.name);
      const inputSignature = this.buildInputSignature(row, normalizedName);

      if (seenInputs.has(inputSignature)) {
        skipped++;
        results.push({
          index,
          action: 'skipped',
          destinationId: row.destinationId,
          name: row.name,
          locationResolved: false,
          needsLocationVerification: true,
          message: 'Duplicate row in request payload',
        });
        continue;
      }

      seenInputs.add(inputSignature);

      try {
        const destination = await this.destinationsRepo.findOne({
          where: { id: row.destinationId },
        });

        if (!destination) {
          errors++;
          results.push({
            index,
            action: 'error',
            destinationId: row.destinationId,
            name: row.name,
            locationResolved: false,
            needsLocationVerification: true,
            message: `Destination #${row.destinationId} not found`,
            error: `Destination #${row.destinationId} not found`,
          });
          continue;
        }

        const explicitLocation = this.toLocation(row.latitude, row.longitude);
        const resolvedLocation =
          explicitLocation ??
          (await this.geocodeAddress(row.address ?? '', destination.countryCode));

        preparedRows.push({
          index,
          row,
          destination,
          normalizedName,
          location: resolvedLocation,
          locationResolved: Boolean(resolvedLocation),
        });
      } catch (error) {
        errors++;
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          index,
          action: 'error',
          destinationId: row.destinationId,
          name: row.name,
          locationResolved: false,
          needsLocationVerification: true,
          message,
          error: message,
        });
      }
    }

    if (preparedRows.length > 0) {
      // Save each row in its own transaction. This prevents a single bad row
      // (e.g., value too long) from aborting the whole batch.
      for (const item of preparedRows) {
        try {
          await this.synagoguesRepo.manager.transaction(async (manager) => {
            const synagoguesRepo = manager.getRepository(Synagogue);

            const existing = await this.findExistingSynagogue(
              synagoguesRepo,
              item,
            );

            if (existing) {
              const merged = this.applyManualSynagogueUpdate(existing, item);
              // Truncate fields to DB-safe lengths before saving
              this.enforceFieldLengths(merged);
              const saved = await synagoguesRepo.save(merged);
              updated++;
              results.push({
                index: item.index,
                action: 'updated',
                destinationId: item.row.destinationId,
                name: item.row.name,
                synagogueId: saved.id,
                locationResolved: item.locationResolved,
                needsLocationVerification: saved.needsLocationVerification,
                message: `Updated synagogue #${saved.id}`,
              });
              return;
            }

            const createdSynagogue = this.buildManualSynagogue(item);
            this.enforceFieldLengths(createdSynagogue);
            const saved = await synagoguesRepo.save(createdSynagogue);
            created++;
            results.push({
              index: item.index,
              action: 'created',
              destinationId: item.row.destinationId,
              name: item.row.name,
              synagogueId: saved.id,
              locationResolved: item.locationResolved,
              needsLocationVerification: saved.needsLocationVerification,
              message: `Created synagogue #${saved.id}`,
            });
          });
        } catch (error) {
          errors++;
          const message = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            index: item.index,
            action: 'error',
            destinationId: item.row.destinationId,
            name: item.row.name,
            locationResolved: item.locationResolved,
            needsLocationVerification: true,
            message,
            error: message,
          });
        }
      }
    }

    return { created, updated, skipped, errors, results };
  }

  private buildManualSynagogue(item: PreparedManualSynagogueRow): Synagogue {
    const synagogue = new Synagogue();
    synagogue.name = item.row.name.trim();
    synagogue.normalizedName = item.normalizedName;
    synagogue.address = this.cleanText(item.row.address);
    synagogue.description = this.cleanText(item.row.description);
    synagogue.location = item.location;
    synagogue.destination = item.destination;
    synagogue.phone = this.cleanText(item.row.phone);
    synagogue.website = this.cleanText(item.row.website);
    synagogue.denomination = this.cleanText(item.row.denomination);
    synagogue.source = 'manual';
    synagogue.sourceConfidence = null;
    synagogue.rawOsm = null;
    synagogue.manuallyVerified = true;
    synagogue.needsLocationVerification = !item.locationResolved;
    synagogue.verificationSource = 'manual-import';
    synagogue.verificationNotes = this.cleanText(item.row.notes);
    return synagogue;
  }

  private applyManualSynagogueUpdate(
    existing: Synagogue,
    item: PreparedManualSynagogueRow,
  ): Synagogue {
    existing.name = item.row.name.trim();
    existing.normalizedName = item.normalizedName;
    existing.address = this.cleanText(item.row.address);

    if (item.locationResolved && item.location) {
      existing.location = item.location;
    } else if (!existing.location) {
      existing.location = null;
    }

    existing.destination = item.destination;
    existing.phone = this.cleanText(item.row.phone) ?? existing.phone;
    existing.website = this.cleanText(item.row.website) ?? existing.website;
    const description = this.cleanText(item.row.description);
    if (description) {
      existing.description = description;
    }
    existing.denomination =
      this.cleanText(item.row.denomination) ?? existing.denomination;
    existing.source = 'manual';
    existing.sourceConfidence = null;
    existing.manuallyVerified = true;
    existing.needsLocationVerification = !item.locationResolved;
    existing.verificationSource = 'manual-import';

    const notes = this.cleanText(item.row.notes);
    if (notes) {
      existing.verificationNotes = notes;
    }

    return existing;
  }

  private async findExistingSynagogue(
    synagoguesRepo: Repository<Synagogue>,
    item: PreparedManualSynagogueRow,
  ): Promise<Synagogue | null> {
    if (!item.locationResolved) {
      return null;
    }

    // Strict matching: require both normalized name AND normalized address to match.
    //  - Same name + same address -> update
    //  - Same name + different/empty address -> do NOT merge
    //  - Different name + same address -> do NOT merge
    // Also allow update when both name and exact coordinates match.

    const cleanedIncomingAddress = this.cleanText(item.row.address)?.toLowerCase();

    // 1) Exact normalized-name matches — only accept if addresses also match
    if (item.normalizedName) {
      const exactCandidates = await synagoguesRepo.find({
        where: { destination: { id: item.destination.id }, normalizedName: item.normalizedName },
      });

      for (const candidate of exactCandidates) {
        const candidateAddress = this.cleanText(candidate.address)?.toLowerCase();
        if (candidateAddress && cleanedIncomingAddress && candidateAddress === cleanedIncomingAddress) {
          return candidate;
        }
      }
    }

    // 2) Exact coordinate match — only accept if normalized name also matches
    const exactLocationMatch = item.location
      ? await synagoguesRepo
          .createQueryBuilder('s')
          .where('s.destinationId = :destinationId', {
            destinationId: item.destination.id,
          })
          .andWhere(
            `ST_DWithin(s.location, ST_GeographyFromText('SRID=4326;POINT(${item.location.coordinates[0]} ${item.location.coordinates[1]})'), 0)`,
          )
          .orderBy('s.created_at', 'DESC')
          .getOne()
      : null;

    if (exactLocationMatch) {
      if (item.normalizedName && exactLocationMatch.normalizedName === item.normalizedName) {
        return exactLocationMatch;
      }
      return null;
    }

    // 3) Do not perform fuzzy name matching anymore — be conservative and create new record
    return null;
  }

  private async findSimilarNamedSynagogue(
    synagoguesRepo: Repository<Synagogue>,
    item: PreparedManualSynagogueRow,
  ): Promise<Synagogue | null> {
    if (!item.normalizedName) {
      return null;
    }

    const candidates = await synagoguesRepo.find({
      where: { destination: { id: item.destination.id } },
    });

    let bestMatch: Synagogue | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      if (!candidate.normalizedName) {
        continue;
      }

      const score = this.getNormalizedNameSimilarity(
        item.normalizedName,
        candidate.normalizedName,
      );

      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    return bestScore >= 0.75 ? bestMatch : null;
  }

  private toLocation(
    latitude?: number,
    longitude?: number,
  ): { type: 'Point'; coordinates: [number, number] } | null {
    if (
      typeof latitude !== 'number' ||
      Number.isNaN(latitude) ||
      typeof longitude !== 'number' ||
      Number.isNaN(longitude)
    ) {
      return null;
    }

    return {
      type: 'Point',
      coordinates: [longitude, latitude],
    };
  }

  private async geocodeAddress(
    address: string,
    countryCode?: string,
  ): Promise<{ type: 'Point'; coordinates: [number, number] } | null> {
    const cleanedAddress = this.cleanText(address);
    if (!cleanedAddress) {
      return null;
    }

    const cacheKey = `${countryCode ?? ''}|${cleanedAddress.toLowerCase()}`;
    const cached = this.geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.nominatimCacheTtlMs) {
      return cached.location
        ? {
            type: 'Point',
            coordinates: [cached.location.lon, cached.location.lat],
          }
        : null;
    }

    // Extract city name from address (last part after last comma)
    const cityName = this.extractCityName(cleanedAddress);
    const cityCenter = cityName ? this.cityCenters[cityName] : null;

    // Try structured geocoding first
    let result: { lat: number; lon: number; resultCity?: string } | null = null;
    const commaIdx = cleanedAddress.lastIndexOf(', ');
    if (commaIdx !== -1) {
      const street = cleanedAddress.slice(0, commaIdx).trim();
      const city = cleanedAddress.slice(commaIdx + 2).trim();
      result = await this.nominatimFetch({ street, city }, countryCode);
      if (result && this.isWithinIsrael(result) && this.isValidForCity(result, cityName, cityCenter)) {
        this.geocodeCache.set(cacheKey, { location: result, timestamp: Date.now() });
        return { type: 'Point', coordinates: [result.lon, result.lat] };
      }
      // If street has no house number, try appending "1" to anchor to start of street
      if (!/\d/.test(street)) {
        result = await this.nominatimFetch({ street: `${street} 1`, city }, countryCode);
        if (result && this.isWithinIsrael(result) && this.isValidForCity(result, cityName, cityCenter)) {
          this.geocodeCache.set(cacheKey, { location: result, timestamp: Date.now() });
          return { type: 'Point', coordinates: [result.lon, result.lat] };
        }
      }
    }

    // Try free-text query
    result = await this.nominatimFetch({ q: cleanedAddress }, countryCode);
    if (result && this.isWithinIsrael(result) && this.isValidForCity(result, cityName, cityCenter)) {
      this.geocodeCache.set(cacheKey, { location: result, timestamp: Date.now() });
      return { type: 'Point', coordinates: [result.lon, result.lat] };
    }

    // Fallback: use city center
    if (cityCenter) {
      this.logger.warn(`Geocoding failed for "${cleanedAddress}", using city center: ${cityName}`);
      this.geocodeCache.set(cacheKey, { location: cityCenter, timestamp: Date.now() });
      return { type: 'Point', coordinates: [cityCenter.lon, cityCenter.lat] };
    }

    this.logger.warn(`Geocoding failed and no city center found for: ${cleanedAddress}`);
    this.geocodeCache.set(cacheKey, { location: null, timestamp: Date.now() });
    return null;
  }

  private extractCityName(address: string): string | null {
    const commaIdx = address.lastIndexOf(', ');
    if (commaIdx === -1) return null;
    return address.slice(commaIdx + 2).trim();
  }

  private isValidForCity(
    result: { lat: number; lon: number; resultCity?: string },
    expectedCityName: string | null,
    cityCenter: { lat: number; lon: number } | null,
  ): boolean {
    // If Nominatim told us the city name and we know the expected city,
    // reject results from the wrong city (handles cities < 5km apart like Mazkeret Batya / Yavne)
    if (expectedCityName && result.resultCity) {
      // Normalize: collapse hyphens to spaces so "פרדס חנה-כרכור" matches "פרדס חנה כרכור"
      const normalize = (s: string) => s.trim().replace(/-/g, ' ');
      const expected = normalize(expectedCityName);
      const returned = normalize(result.resultCity);
      if (returned !== expected && !returned.includes(expected) && !expected.includes(returned)) {
        return false;
      }
      return true;
    }
    return this.isNearCity(result, cityCenter);
  }

  private isNearCity(coord: { lat: number; lon: number }, cityCenter: { lat: number; lon: number } | null): boolean {
    if (!cityCenter) return true;
    // Within ~5km of city center (0.05 degrees ≈ 5.5km — tight enough to reject neighbouring cities)
    const latDiff = Math.abs(coord.lat - cityCenter.lat);
    const lonDiff = Math.abs(coord.lon - cityCenter.lon);
    return latDiff < 0.05 && lonDiff < 0.05;
  }

  private async nominatimFetch(
    params: { q: string } | { street: string; city: string },
    countryCode?: string,
  ): Promise<{ lat: number; lon: number; resultCity?: string } | null> {
    const timeSinceLastRequest = Date.now() - this.lastNominatimRequestAt;
    if (timeSinceLastRequest < this.nominatimMinIntervalMs) {
      await this.sleep(this.nominatimMinIntervalMs - timeSinceLastRequest);
    }
    this.lastNominatimRequestAt = Date.now();

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');
    if ('q' in params) {
      url.searchParams.set('q', params.q);
    } else {
      url.searchParams.set('street', params.street);
      url.searchParams.set('city', params.city);
    }
    if (countryCode) {
      url.searchParams.set('countrycodes', countryCode.toLowerCase());
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'he,en',
          'User-Agent': 'JewishOnTheWay/1.0 (manual synagogue import)',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Nominatim ${response.status} for: ${JSON.stringify(params)}`);
        return null;
      }

      const data = (await response.json()) as Array<{
        lat: string;
        lon: string;
        address?: { city?: string; town?: string; village?: string; municipality?: string };
      }>;
      const first = data?.[0];
      if (!first) return null;

      const lat = Number(first.lat);
      const lon = Number(first.lon);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

      const resultCity =
        first.address?.city ??
        first.address?.town ??
        first.address?.village ??
        first.address?.municipality;

      return { lat, lon, resultCity };
    } catch {
      this.logger.warn(`Nominatim failed for: ${JSON.stringify(params)}`);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async regeocodeDestination(destinationId: number): Promise<{ updated: number; failed: number; cityCenter: number }> {
    const synagogues = await this.synagoguesRepo.find({
      where: { destination: { id: destinationId } },
      relations: ['destination'],
    });

    let updated = 0;
    let failed = 0;
    let cityCenter = 0;

    for (const s of synagogues) {
      if (!s.address) { failed++; continue; }

      const countryCode = s.destination?.countryCode;
      const newLocation = await this.geocodeAddress(s.address, countryCode);

      if (!newLocation) { failed++; continue; }

      const cityName = this.extractCityName(s.address);
      const center = cityName ? this.cityCenters[cityName] : null;
      const isFallback = !!(center &&
        Math.abs(newLocation.coordinates[1] - center.lat) < 0.0001 &&
        Math.abs(newLocation.coordinates[0] - center.lon) < 0.0001);

      if (isFallback) {
        cityCenter++;
        // If geocoding only produced a city-center fallback, never overwrite
        // real GPS coordinates that were already stored for this synagogue.
        if (s.location) {
          const existing = (s.location as any).coordinates as [number, number] | undefined;
          const existingIsCityCenter = existing && center &&
            Math.abs(existing[1] - center.lat) < 0.0001 &&
            Math.abs(existing[0] - center.lon) < 0.0001;
          if (!existingIsCityCenter) {
            continue; // keep the real GPS coordinates untouched
          }
        }
      }

      s.location = newLocation;
      s.needsLocationVerification = isFallback;
      await this.synagoguesRepo.save(s);
      updated++;
    }

    return { updated, failed, cityCenter };
  }

  private buildInputSignature(
    row: ManualSynagogueBulkRowDto,
    normalizedName: string,
  ): string {
    return [
      row.destinationId,
      normalizedName,
      this.cleanText(row.address) ?? '',
      row.latitude ?? '',
      row.longitude ?? '',
      this.cleanText(row.phone) ?? '',
      this.cleanText(row.website) ?? '',
      this.cleanText(row.description) ?? '',
      this.cleanText(row.denomination) ?? '',
    ].join('|');
  }

  private isWithinIsrael(coord: { lat: number; lon: number }): boolean {
    return coord.lat >= 29 && coord.lat <= 34 && coord.lon >= 34 && coord.lon <= 36;
  }

  private cleanText(value?: string | null): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private enforceFieldLengths(s: Synagogue) {
    // Truncate fields to DB column maximums to prevent save errors.
    const trunc = (v: string | undefined, n: number) =>
      typeof v === 'string' ? (v.length > n ? v.slice(0, n) : v) : v;
    // Do NOT truncate `phone` — phone numbers (and multiple numbers) are important.
    // We increased the DB column to varchar(255) via migration.
    s.addrHousenumber = trunc(s.addrHousenumber as string | undefined, 50) as any;
    s.addrPostcode = trunc(s.addrPostcode as string | undefined, 50) as any;
    s.denomination = trunc(s.denomination as string | undefined, 100) as any;
    s.website = trunc(s.website as string | undefined, 500) as any;
    s.wikipedia = trunc(s.wikipedia as string | undefined, 500) as any;
    s.operator = trunc(s.operator as string | undefined, 200) as any;
    s.addrStreet = trunc(s.addrStreet as string | undefined, 200) as any;
    s.addrCity = trunc(s.addrCity as string | undefined, 200) as any;
  }

  private getNormalizedNameSimilarity(left: string, right: string): number {
    if (!left || !right) {
      return 0;
    }

    if (left === right) {
      return 1;
    }

    if (left.includes(right) || right.includes(left)) {
      return 0.95;
    }

    const leftTokens = this.getMeaningfulTokens(left);
    const rightTokens = this.getMeaningfulTokens(right);

    if (leftTokens.length === 0 || rightTokens.length === 0) {
      return 0;
    }

    const tokenIntersection = new Set(
      leftTokens.filter((token) => rightTokens.includes(token)),
    );
    const tokenUnion = new Set([...leftTokens, ...rightTokens]);
    const tokenOverlap =
      tokenUnion.size > 0 ? tokenIntersection.size / tokenUnion.size : 0;

    const compactLeft = left.replace(/\s+/g, '');
    const compactRight = right.replace(/\s+/g, '');
    const levenshteinSimilarity = this.getLevenshteinSimilarity(
      compactLeft,
      compactRight,
    );

    return Math.max(tokenOverlap, levenshteinSimilarity);
  }

  private getLevenshteinSimilarity(left: string, right: string): number {
    if (!left || !right) {
      return 0;
    }

    const leftLength = left.length;
    const rightLength = right.length;

    if (leftLength === 0 || rightLength === 0) {
      return 0;
    }

    const matrix: number[][] = Array.from({ length: leftLength + 1 }, () =>
      Array(rightLength + 1).fill(0),
    );

    for (let i = 0; i <= leftLength; i++) {
      matrix[i][0] = i;
    }

    for (let j = 0; j <= rightLength; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= leftLength; i++) {
      for (let j = 1; j <= rightLength; j++) {
        const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + substitutionCost,
        );
      }
    }

    const distance = matrix[leftLength][rightLength];
    return 1 - distance / Math.max(leftLength, rightLength);
  }

  private getMeaningfulTokens(value: string): string[] {
    const stopwords = new Set([
      'beth',
      'beis',
      'beit',
      'beit',
      'synagogue',
      'synagogues',
      'shul',
      'temple',
      'museum',
      'musem',
      'museums',
      'muzium',
      'muzeum',
      'museo',
      'בית',
      'הכנסת',
      'בית הכנסת',
      'מוזיאון',
      'מוזיאונים',
      'מוזיאוני',
      'museum',
      'synagoga',
      'synagogae',
    ]);

    return value
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !stopwords.has(token));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}