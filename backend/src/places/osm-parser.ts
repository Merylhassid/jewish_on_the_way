import { normalizeNameForDedup } from './name-normalizer';

/**
 * Represents a parsed OSM element as a candidate synagogue.
 */
export interface ParsedSynagogueCandidate {
  name: string;
  normalizedName: string;
  coords: { lat: number; lon: number };
  website?: string;
  phone?: string;
  openingHours?: string;
  addrStreet?: string;
  addrHousenumber?: string;
  addrPostcode?: string;
  addrCity?: string;
  wikidata?: string;
  wikipedia?: string;
  denomination?: string;
  operator?: string;
  osmId: string;
  rawTags: Record<string, any>;
  sourceConfidence: number;
  validationReasons: string[];
}

/**
 * Extract a synagogue candidate from an OSM element (node or way).
 *
 * OSM element shape (typical):
 * {
 *   type: "node" | "way",
 *   id: number,
 *   lat?: number, // for nodes
 *   lon?: number, // for nodes
 *   center?: { lat, lon }, // for ways
 *   tags: { [key: string]: string }
 * }
 *
 * Extracts name, coordinates, and enriched fields from tags.
 * Computes sourceConfidence based on field completeness.
 */
export function parseOsmElement(element: any): ParsedSynagogueCandidate | null {
  if (!element || !element.tags) {
    return null;
  }

  const tags = element.tags;

  // Extract name (required)
  const name =
    tags.name || tags['name:en'] || tags['name:he'] || tags.operator || null;
  if (!name) {
    return null; // Cannot create candidate without a name
  }

  // Normalize name for deduplication
  const normalizedName = normalizeNameForDedup(name);

  // Extract coordinates
  let lat: number;
  let lon: number;

  if (element.lat !== undefined && element.lon !== undefined) {
    lat = element.lat;
    lon = element.lon;
  } else if (element.center) {
    lat = element.center.lat;
    lon = element.center.lon;
  } else {
    return null; // Cannot proceed without coordinates
  }

  // Ensure valid coordinates
  if (lat === null || lon === null || (lat === 0 && lon === 0)) {
    return null; // Reject invalid/fallback coordinates
  }

  // Extract enriched fields from tags
  const website =
    tags.website || tags['contact:website'] || tags.url || undefined;
  const phone = tags.phone || tags['contact:phone'] || undefined;
  const openingHours = tags.opening_hours || undefined;

  // Extract address components
  const addrStreet = tags['addr:street'] || undefined;
  const addrHousenumber = tags['addr:housenumber'] || undefined;
  const addrPostcode = tags['addr:postcode'] || undefined;
  const addrCity = tags['addr:city'] || tags['addr:town'] || undefined;

  // Extract semantic tags
  const wikidata = tags.wikidata || undefined;
  const wikipedia = tags.wikipedia || undefined;
  const operator = tags.operator || undefined;

  // Attempt to detect denomination from tags
  // (e.g., synagogue:type or denomination tags)
  let denomination =
    tags['building:synagogue:type'] || tags.denomination || undefined;

  // Try to infer from name if no explicit tag
  if (!denomination && name) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('reform') || lowerName.includes('progressive')) {
      denomination = 'Reform';
    } else if (lowerName.includes('conservative')) {
      denomination = 'Conservative';
    } else if (lowerName.includes('orthodox')) {
      denomination = 'Orthodox';
    } else if (
      lowerName.includes('chabad') ||
      lowerName.includes('lubavitch')
    ) {
      denomination = 'Chabad';
    }
  }

  // Compute sourceConfidence based on data completeness
  const confidenceFactors = {
    hasWebsite: website ? 0.15 : 0,
    hasPhone: phone ? 0.15 : 0,
    hasOpeningHours: openingHours ? 0.1 : 0,
    hasCompleteAddress: addrStreet && addrCity ? 0.2 : addrCity ? 0.1 : 0,
    hasWikidata: wikidata ? 0.15 : 0,
    hasOperator: operator ? 0.15 : 0,
  };

  const sourceConfidence = Math.min(
    1.0,
    Object.values(confidenceFactors).reduce((a, b) => a + b, 0.1),
  );

  // Collect validation reasons (why confidence is low)
  const validationReasons: string[] = [];
  if (!website) validationReasons.push('missing_website');
  if (!phone) validationReasons.push('missing_phone');
  if (!openingHours) validationReasons.push('missing_opening_hours');
  if (!addrStreet || !addrCity) validationReasons.push('incomplete_address');
  if (!wikidata) validationReasons.push('no_wikidata');

  return {
    name,
    normalizedName,
    coords: { lat, lon },
    website,
    phone,
    openingHours,
    addrStreet,
    addrHousenumber,
    addrPostcode,
    addrCity,
    wikidata,
    wikipedia,
    denomination,
    operator,
    osmId: `${element.type === 'way' ? 'w' : 'n'}${element.id}`,
    rawTags: tags,
    sourceConfidence,
    validationReasons,
  };
}
