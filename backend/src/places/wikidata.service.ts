import { Injectable, Logger } from '@nestjs/common';

/**
 * Represents enriched data fetched from Wikidata.
 */
export interface WikidataEnrichment {
  label?: string;
  website?: string;
  phone?: string;
  coords?: { lat: number; lon: number };
  wikipedia?: string;
}

/**
 * Wikidata Service: fetch and enrich synagogue data from Wikidata.
 *
 * IMPORTANT: Only call this when an OSM element has a `wikidata` tag.
 * Rate-limited and cached to be respectful to Wikidata API.
 */
@Injectable()
export class WikidataService {
  private readonly logger = new Logger(WikidataService.name);

  // Simple in-memory cache with TTL (5 minutes per entry)
  private cache = new Map<
    string,
    { data: WikidataEnrichment; timestamp: number }
  >();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  // Rate limiting: ensure requests are spaced out
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL_MS = 300; // 300ms between requests

  /**
   * Fetch and enrich data from Wikidata for a given QID.
   * Returns null if the QID is invalid or Wikidata returns no data.
   *
   * @param qid Wikidata QID (e.g., "Q12345")
   * @returns Enriched data or null
   */
  async enrichFromWikidata(qid: string): Promise<WikidataEnrichment | null> {
    if (!qid || typeof qid !== 'string') {
      return null;
    }

    // Normalize QID
    const normalizedQid = qid.toUpperCase().startsWith('Q') ? qid : `Q${qid}`;

    // Check cache
    const cached = this.cache.get(normalizedQid);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      this.logger.debug(`Cache hit for ${normalizedQid}`);
      return cached.data;
    }

    // Rate limit: wait before making request
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL_MS) {
      await this.sleep(this.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();

    try {
      // Fetch from Wikidata REST API using native fetch
      const url = `https://www.wikidata.org/wiki/Special:EntityData/${normalizedQid}.json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          this.logger.warn(
            `Wikidata returned status ${response.status} for ${normalizedQid}`,
          );
          return null;
        }

        const data = (await response.json()) as Record<string, any>;
        const entity = data?.entities?.[normalizedQid];
        if (!entity) {
          this.logger.warn(`Wikidata returned no entity for ${normalizedQid}`);
          return null;
        }

        // Extract useful properties
        const enrichment = this.extractProperties(entity);

        // Cache result
        this.cache.set(normalizedQid, {
          data: enrichment,
          timestamp: Date.now(),
        });

        this.logger.debug(`Enriched ${normalizedQid} from Wikidata`);
        return enrichment;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      this.logger.error(
        `Failed to enrich from Wikidata for ${normalizedQid}`,
        error,
      );
      return null;
    }
  }

  /**
   * Extract relevant properties from Wikidata entity.
   */
  private extractProperties(entity: Record<string, any>): WikidataEnrichment {
    const enrichment: WikidataEnrichment = {};

    // P1476: Title (for disambiguation)
    if (entity.labels?.en?.value) {
      enrichment.label = entity.labels.en.value;
    } else if (entity.labels?.he?.value) {
      enrichment.label = entity.labels.he.value;
    }

    // P856: Official website
    if (entity.claims?.P856?.[0]?.mainsnak?.datavalue?.value) {
      enrichment.website = entity.claims.P856[0].mainsnak.datavalue.value;
    }

    // P1329: Phone number
    if (entity.claims?.P1329?.[0]?.mainsnak?.datavalue?.value) {
      enrichment.phone = entity.claims.P1329[0].mainsnak.datavalue.value;
    }

    // P625: Coordinate location
    if (entity.claims?.P625?.[0]?.mainsnak?.datavalue?.value) {
      const coords = entity.claims.P625[0].mainsnak.datavalue.value;
      if (coords.latitude && coords.longitude) {
        enrichment.coords = {
          lat: coords.latitude,
          lon: coords.longitude,
        };
      }
    }

    // P143: Stated in (source), or we could track Wikipedia link
    // For now, store sitelinks (inter-wiki links)
    if (entity.sitelinks?.enwiki?.title) {
      enrichment.wikipedia = `https://en.wikipedia.org/wiki/${encodeURIComponent(
        entity.sitelinks.enwiki.title,
      )}`;
    }

    return enrichment;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear the cache (useful for testing or manual reset).
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Wikidata cache cleared');
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; ttlMs: number } {
    return {
      size: this.cache.size,
      ttlMs: this.CACHE_TTL_MS,
    };
  }
}
