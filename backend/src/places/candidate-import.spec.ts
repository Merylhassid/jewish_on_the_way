import { parseOsmElement, ParsedSynagogueCandidate } from './osm-parser';
import { normalizeNameForDedup } from './name-normalizer';

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
        ...overrides,
      },
    });

    it('should parse valid node with basic data', () => {
      const node = createMockNode();
      const result = parseOsmElement(node);

      expect(result).toBeDefined();
      expect(result?.name).toBe('Test Synagogue');
      expect(result?.coords).toEqual({ lat: 32.0853, lon: 34.7684 });
      expect(result?.osmId).toBe('n123456');
    });

    it('should reject nodes with missing name', () => {
      const node = createMockNode({ name: undefined });
      const result = parseOsmElement(node);
      expect(result).toBeNull();
    });

    it('should reject coordinates at 0,0', () => {
      const node = createMockNode();
      node.lat = 0;
      node.lon = 0;
      const result = parseOsmElement(node);
      expect(result).toBeNull();
    });

    it('should extract enriched fields', () => {
      const node = createMockNode({
        website: 'https://example.com',
        phone: '+972123456789',
        opening_hours: 'Mo-Fr 09:00-17:00',
        'addr:street': 'Herzl Street',
        'addr:housenumber': '42',
        'addr:postcode': '12345',
        'addr:city': 'Tel Aviv',
        wikidata: 'Q12345',
        wikipedia: 'en:Synagogue',
      });

      const result = parseOsmElement(node);

      expect(result?.website).toBe('https://example.com');
      expect(result?.phone).toBe('+972123456789');
      expect(result?.openingHours).toBe('Mo-Fr 09:00-17:00');
      expect(result?.addrStreet).toBe('Herzl Street');
      expect(result?.addrHousenumber).toBe('42');
      expect(result?.addrPostcode).toBe('12345');
      expect(result?.addrCity).toBe('Tel Aviv');
      expect(result?.wikidata).toBe('Q12345');
      expect(result?.wikipedia).toBe('en:Synagogue');
    });

    it('should calculate sourceConfidence correctly', () => {
      const minimal = createMockNode();
      const minimalResult = parseOsmElement(minimal);
      expect((minimalResult?.sourceConfidence ?? 0) > 0).toBe(true);

      const enriched = createMockNode({
        website: 'https://example.com',
        phone: '+972123456789',
        opening_hours: 'Mo-Fr 09:00-17:00',
        addr_street: 'Herzl Street',
        addr_city: 'Tel Aviv',
        wikidata: 'Q12345',
        operator: 'Jewish Community',
      });

      const enrichedResult = parseOsmElement(enriched);
      expect(
        (enrichedResult?.sourceConfidence ?? 0) >
          (minimalResult?.sourceConfidence ?? 0),
      ).toBe(true);
    });

    it('should collect validation reasons for missing data', () => {
      const minimal = createMockNode();
      const result = parseOsmElement(minimal);

      expect(result?.validationReasons).toBeDefined();
      expect(result?.validationReasons.length).toBeGreaterThan(0);
      expect(result?.validationReasons).toContain('missing_website');
      expect(result?.validationReasons).toContain('missing_phone');
    });

    it('should detect Orthodox denomination from name', () => {
      const orthodoxNode = createMockNode({
        name: 'Orthodox Synagogue Beth David',
      });
      const result = parseOsmElement(orthodoxNode);
      expect(result?.denomination).toBe('Orthodox');
    });

    it('should detect Reform denomination from name', () => {
      const reformNode = createMockNode({ name: 'Reform Temple Shalom' });
      const result = parseOsmElement(reformNode);
      expect(result?.denomination).toBe('Reform');
    });

    it('should preserve raw OSM tags', () => {
      const node = createMockNode({ custom_tag: 'custom_value' });
      const result = parseOsmElement(node);

      expect(result?.rawTags).toBeDefined();
      expect(result?.rawTags.custom_tag).toBe('custom_value');
    });
  });
});
