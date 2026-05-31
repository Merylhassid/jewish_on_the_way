import { DenominationClassifierService } from './denomination-classifier.service';

describe('DenominationClassifierService', () => {
  let service: DenominationClassifierService;

  beforeEach(() => {
    service = new DenominationClassifierService();
    service.onModuleInit();
  });

  // --- classify ---

  describe('classify', () => {
    it('identifies Chabad from unambiguous Hebrew text', () => {
      const result = service.classify('חב"ד');

      expect(result.denomination).toBe('chabad');
      expect(result.confidence).toBeGreaterThan(0.45);
      expect(result.emoji).toBe('🕎');
    });

    it('identifies Sfarad from unambiguous Hebrew text', () => {
      const result = service.classify('ספרדי');

      expect(result.denomination).toBe('sfarad');
      expect(result.confidence).toBeGreaterThan(0.45);
    });

    it('identifies Teimanim from unambiguous Hebrew text', () => {
      const result = service.classify('תימני');

      expect(result.denomination).toBe('teimanim');
      expect(result.confidence).toBeGreaterThan(0.45);
    });

    it('returns denomination=null when input contains no recognisable denomination signals', () => {
      const result = service.classify('');

      expect(result.denomination).toBeNull();
      expect(result.confidence).toBeLessThan(0.45);
    });

    it('returns allScores with an entry for every trained class', () => {
      const result = service.classify('חב"ד');

      expect(result.allScores).toHaveProperty('chabad');
      expect(result.allScores).toHaveProperty('ashkenaz');
      expect(result.allScores).toHaveProperty('sfarad');
      expect(result.allScores).toHaveProperty('teimanim');
    });
  });

  // --- getDbValues ---

  describe('getDbValues', () => {
    it('returns the correct DB enum values for ashkenaz', () => {
      const values = service.getDbValues('ashkenaz');

      expect(values).toContain('אשכנז');
      expect(values).toContain('Ashkenazi');
      expect(values).toContain('Orthodox');
    });

    it('returns an empty array for an unknown denomination', () => {
      expect(service.getDbValues('unknown')).toEqual([]);
    });
  });

  // --- getHebrewLabel ---

  describe('getHebrewLabel', () => {
    it('returns the correct Hebrew display label for chabad', () => {
      expect(service.getHebrewLabel('chabad')).toBe('חב"ד');
    });

    it('returns the denomination string itself when no Hebrew label is defined', () => {
      expect(service.getHebrewLabel('unknown')).toBe('unknown');
    });
  });
});
