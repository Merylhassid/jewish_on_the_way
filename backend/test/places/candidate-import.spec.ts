import { Test, TestingModule } from '@nestjs/testing';
import {
  parseOsmElement,
  ParsedSynagogueCandidate,
} from '../../src/places/osm-parser';
import { normalizeNameForDedup } from '../../src/places/name-normalizer';

describe('OSM Parser & Candidate Import', () => {
  describe('normalizeNameForDedup', () => {
    it('should normalize basic names', () => {
      expect(normalizeNameForDedup('Beth David Synagogue')).toBe(
        'beth david synagogue',
      );
    });

    it('should remove diacritics', () => {
      expect(normalizeNameForDedup('Sébastien')).toBe('sebastien');
      expect(normalizeNameForDedup("Côte d'Or")).toBe('cote dor');
    });

    it('should remove punctuation', () => {
      expect(normalizeNameForDedup('Beth David - Synagogue')).toBe(
        'beth david synagogue',
      );
      expect(normalizeNameForDedup('Synagogue (Large)')).toBe(
        'synagogue large',
      );
    });

    it('should collapse spaces', () => {
      expect(normalizeNameForDedup('Beth   David    Synagogue')).toBe(
        'beth david synagogue',
      );
    });

    it('should handle Hebrew names with Unicode', () => {
      // Even with Hebrew, should normalize to lowercase and remove punctuation
      const hebrewName = normalizeNameForDedup('בית כנסת דוד');
      expect(hebrewName).toBeDefined();
      expect(typeof hebrewName).toBe('string');
    });

    it('should trim whitespace', () => {
      expect(normalizeNameForDedup('  Beth David  ')).toBe('beth david');
    });

    it('should return empty string for empty input', () => {
      expect(normalizeNameForDedup('')).toBe('');
      expect(normalizeNameForDedup(null as any)).toBe('');
    });
  });

  describe('parseOsmElement', () => {
    const createMockNode = (overrides: any = {}) => ({
      type: 'node' as const,
      id: 123456,
      lat: 32.0853,
      lon: 34.7684,
      tags: {
        name: 'Test Synagogue',
        amenity: 'place_of_worship',
        religion: 'jewish',
        ...overrides.tags,
      },
      ...overrides,
    });

    const createMockWay = (overrides: any = {}) => ({
      type: 'way' as const,
      id: 654321,
      center: { lat: 32.0853, lon: 34.7684 },
      tags: {
        name: 'Test Synagogue',
        amenity: 'place_of_worship',
        religion: 'jewish',
        ...overrides.tags,
      },
      ...overrides,
    });

    it('should parse a basic node element', () => {
      const element = createMockNode();
      const result = parseOsmElement(element);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Test Synagogue');
      expect(result!.normalizedName).toBe('test synagogue');
      expect(result!.coords).toEqual({ lat: 32.0853, lon: 34.7684 });
      expect(result!.osmId).toBe('n123456');
    });

    it('should parse a way element with center', () => {
      const element = createMockWay();
      const result = parseOsmElement(element);

      expect(result).not.toBeNull();
      expect(result!.osmId).toBe('w654321');
      expect(result!.coords).toEqual({ lat: 32.0853, lon: 34.7684 });
    });

    it('should extract enriched fields', () => {
      const element = createMockNode({
        tags: {
          name: 'Beth David',
          website: 'https://bethdavid.org',
          phone: '+1-555-1234',
          opening_hours: 'Mo-Fr 08:00-17:00',
          'addr:street': 'Main St',
          'addr:housenumber': '123',
          'addr:city': 'Tel Aviv',
          wikidata: 'Q12345',
          operator: 'Jewish Community',
        },
      });

      const result = parseOsmElement(element);

      expect(result).not.toBeNull();
      expect(result!.website).toBe('https://bethdavid.org');
      expect(result!.phone).toBe('+1-555-1234');
      expect(result!.openingHours).toBe('Mo-Fr 08:00-17:00');
      expect(result!.addrStreet).toBe('Main St');
      expect(result!.addrHousenumber).toBe('123');
      expect(result!.addrCity).toBe('Tel Aviv');
      expect(result!.wikidata).toBe('Q12345');
      expect(result!.operator).toBe('Jewish Community');
    });

    it('should compute sourceConfidence based on field completeness', () => {
      // Minimal element
      const minimal = createMockNode();
      const minResult = parseOsmElement(minimal);
      expect(minResult!.sourceConfidence).toBeLessThan(0.5);

      // Rich element
      const rich = createMockNode({
        tags: {
          name: 'Beth David',
          website: 'https://bethdavid.org',
          phone: '+1-555-1234',
          opening_hours: 'Mo-Fr 08:00-17:00',
          'addr:street': 'Main St',
          'addr:city': 'Tel Aviv',
          wikidata: 'Q12345',
          operator: 'Community',
        },
      });
      const richResult = parseOsmElement(rich);
      expect(richResult!.sourceConfidence).toBeGreaterThan(
        minResult!.sourceConfidence,
      );
    });

    it('should record validation reasons', () => {
      const element = createMockNode();
      const result = parseOsmElement(element);

      expect(result!.validationReasons).toContain('missing_website');
      expect(result!.validationReasons).toContain('missing_phone');
      expect(result!.validationReasons).toContain('incomplete_address');
      expect(result!.validationReasons).toContain('no_wikidata');
    });

    it('should detect denomination from tags', () => {
      const orthodox = createMockNode({
        tags: { name: 'Orthodox Synagogue' },
      });
      expect(parseOsmElement(orthodox)!.denomination).toBe('Orthodox');

      const reform = createMockNode({
        tags: { name: 'Reform Synagogue' },
      });
      expect(parseOsmElement(reform)!.denomination).toBe('Reform');

      const chabad = createMockNode({
        tags: { name: 'Chabad House' },
      });
      expect(parseOsmElement(chabad)!.denomination).toBe('Chabad');
    });

    it('should fallback to alternative name tags', () => {
      const element = createMockNode({
        tags: {
          name: undefined,
          'name:en': 'English Name',
        },
      });
      const result = parseOsmElement(element);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('English Name');
    });

    it('should return null for invalid coordinates (0,0)', () => {
      const element = createMockNode({
        lat: 0,
        lon: 0,
      });
      const result = parseOsmElement(element);
      expect(result).toBeNull();
    });

    it('should return null without name', () => {
      const element = createMockNode({
        tags: {},
      });
      const result = parseOsmElement(element);
      expect(result).toBeNull();
    });

    it('should return null without coordinates', () => {
      const element = {
        type: 'node' as const,
        id: 123,
        tags: { name: 'Test' },
      };
      const result = parseOsmElement(element);
      expect(result).toBeNull();
    });

    it('should preserve raw OSM tags', () => {
      const rawTags = {
        name: 'Test',
        custom_field: 'custom_value',
        'contact:website': 'https://example.com',
      };
      const element = createMockNode({
        tags: rawTags,
      });
      const result = parseOsmElement(element);

      expect(result!.rawTags).toEqual(expect.objectContaining(rawTags));
    });
  });
});
