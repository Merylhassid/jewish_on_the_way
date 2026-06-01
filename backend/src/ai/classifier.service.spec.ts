import { ClassifierService } from './classifier.service';

describe('ClassifierService — Category Classifier', () => {
  let service: ClassifierService;

  beforeEach(() => {
    service = new ClassifierService();
    service.onModuleInit();
  });

  // ── Category classification ────────────────────────────────

  describe('restaurant', () => {
    it('classifies a direct Hebrew restaurant query', () => {
      const result = service.classify('מסעדה כשרה בתל אביב');
      expect(result.category).toBe('restaurant');
      expect(result.confidence).toBeGreaterThan(0.45);
    });

    it('classifies a meat restaurant query', () => {
      const result = service.classify('מסעדה בשרית כשרה');
      expect(result.category).toBe('restaurant');
      expect(result.confidence).toBeGreaterThan(0.45);
    });

    it('classifies an English restaurant query', () => {
      const result = service.classify('kosher restaurant in london');
      expect(result.category).toBe('restaurant');
      expect(result.confidence).toBeGreaterThan(0.45);
    });
  });

  describe('synagogue', () => {
    it('classifies a direct Hebrew synagogue query', () => {
      const result = service.classify('בית כנסת בירושלים');
      expect(result.category).toBe('synagogue');
      expect(result.confidence).toBeGreaterThan(0.45);
    });

    it('classifies a Sephardic synagogue query', () => {
      const result = service.classify('בית כנסת ספרדי');
      expect(result.category).toBe('synagogue');
      expect(result.confidence).toBeGreaterThan(0.45);
    });

    it('classifies an English synagogue query', () => {
      const result = service.classify('where is the synagogue');
      expect(result.category).toBe('synagogue');
      expect(result.confidence).toBeGreaterThan(0.45);
    });
  });

  describe('minyan', () => {
    it('classifies a Hebrew minyan query', () => {
      const result = service.classify('מניין לשחרית');
      expect(result.category).toBe('minyan');
      expect(result.confidence).toBeGreaterThan(0.45);
    });

    it('classifies a minyan quorum query', () => {
      const result = service.classify('צריך עשרה גברים למניין');
      expect(result.category).toBe('minyan');
      expect(result.confidence).toBeGreaterThan(0.45);
    });
  });

  describe('hosting', () => {
    it('classifies a Shabbat hosting query', () => {
      const result = service.classify('אירוח שבת');
      expect(result.category).toBe('hosting');
      expect(result.confidence).toBeGreaterThan(0.45);
    });

    it('classifies a family hosting query', () => {
      const result = service.classify('אירוח משפחות לשבת');
      expect(result.category).toBe('hosting');
      expect(result.confidence).toBeGreaterThan(0.45);
    });
  });

  // ── Confidence threshold ───────────────────────────────────

  describe('confidence threshold', () => {
    it('returns a valid confidence score between 0 and 1', () => {
      const result = service.classify('שלום');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('always returns all 4 categories in allScores', () => {
      const result = service.classify('מסעדה כשרה');
      expect(result.allScores).toHaveProperty('restaurant');
      expect(result.allScores).toHaveProperty('synagogue');
      expect(result.allScores).toHaveProperty('minyan');
      expect(result.allScores).toHaveProperty('hosting');
    });

    it('allScores sum is approximately 1 (softmax)', () => {
      const result = service.classify('בית כנסת');
      const total = Object.values(result.allScores).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 1);
    });
  });

  // ── Emoji ──────────────────────────────────────────────────

  describe('emoji', () => {
    it('returns the restaurant emoji for restaurant queries', () => {
      const result = service.classify('מסעדה כשרה');
      expect(result.emoji).toBe('🍽️');
    });

    it('returns the synagogue emoji for synagogue queries', () => {
      const result = service.classify('בית כנסת');
      expect(result.emoji).toBe('🕍');
    });
  });
});
