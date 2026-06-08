import { SearchClassifierService } from './search-classifier.service';

describe('SearchClassifierService rule fallback', () => {
  const oldAnthropicKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterAll(() => {
    process.env.ANTHROPIC_API_KEY = oldAnthropicKey;
  });

  it('removes conversational stop words while preserving the food keyword', async () => {
    const service = new SearchClassifierService({} as any);

    const result = await service.classify('where can I eat pizza near the hotel');

    expect(result.type).toBe('dairy');
    expect(result.keyword).toBe('pizza');
  });

  it('removes Hebrew conversational stop words while preserving the food keyword', async () => {
    const service = new SearchClassifierService({} as any);

    const result = await service.classify('איפה אפשר לאכול פיצה ליד המלון');

    expect(result.type).toBe('dairy');
    expect(result.keyword).toBe('פיצה');
  });
});
