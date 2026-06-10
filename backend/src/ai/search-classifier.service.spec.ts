import { SearchClassifierService } from './search-classifier.service';

describe('SearchClassifierService rule-based extraction', () => {
  it('removes conversational stop words while preserving the food keyword', async () => {
    const service = new SearchClassifierService();
    const result = await service.classify('where can I eat pizza near the hotel');
    expect(result.type).toBe('dairy');
    expect(result.keyword).toBe('pizza');
  });

  it('removes Hebrew conversational stop words while preserving the food keyword', async () => {
    const service = new SearchClassifierService();
    const result = await service.classify('איפה אפשר לאכול פיצה ליד המלון');
    expect(result.type).toBe('dairy');
    expect(result.keyword).toBe('פיצה');
  });
});

// ── Tests for search.controller overrides ───────────────────────────────────
// These test the pure helper functions exported or usable in isolation.
// We import them from the module (they are not exported, so we test via
// the classifier service indirectly, or we test lookupFoodRelation directly).

import { lookupFoodRelation } from '../restaurants/food-relations';

describe('search.controller HEBREW_FOOD_TERMS coverage (via food-relations)', () => {
  const bakeryTerms = ['מאפייה', 'מאפיה', 'מאפיית'];
  for (const term of bakeryTerms) {
    it(`${term} resolves to bakery food relation`, () => {
      const rel = lookupFoodRelation(term);
      expect(rel).toBeDefined();
      expect(rel!.searchTags).toContain('bakery');
    });
  }

  it('קציצות resolves to meat food relation', () => {
    const rel = lookupFoodRelation('קציצות');
    expect(rel).toBeDefined();
    expect(rel!.fallbackType).toBe('meat');
  });

  it('פריקסה resolves to sandwich food relation', () => {
    const rel = lookupFoodRelation('פריקסה');
    expect(rel).toBeDefined();
    expect(rel!.searchTags).toContain('sandwich');
  });

  it('בגט resolves to sandwich/bakery food relation', () => {
    const rel = lookupFoodRelation('בגט');
    expect(rel).toBeDefined();
    expect(rel!.searchTags).toContain('sandwich');
  });

  it('יין resolves to a food relation (restaurant route)', () => {
    const rel = lookupFoodRelation('יין');
    expect(rel).toBeDefined();
  });

  it('bakery (English) resolves to bakery tags', () => {
    const rel = lookupFoodRelation('bakery');
    expect(rel).toBeDefined();
    expect(rel!.searchTags).toContain('bakery');
  });
});
