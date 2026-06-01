import { ClassifierService } from './classifier.service';

describe('ClassifierService', () => {
  let service: ClassifierService;

  beforeEach(() => {
    service = new ClassifierService();
    service.onModuleInit();
  });

  it('uses phrase evidence to classify Sephardi synagogue searches', () => {
    const result = service.classify('אני מחפש בית כנסת ספרדי');

    expect(result.category).toBe('synagogue');
    expect(result.confidence).toBeGreaterThan(0.45);
  });

  it('uses kosher food phrase evidence for restaurant searches near a hotel', () => {
    const result = service.classify('אוכל כשר ליד המלון');

    expect(result.category).toBe('restaurant');
    expect(result.confidence).toBeGreaterThan(0.45);
  });

  it('uses family hosting phrase evidence for Shabbat meal searches', () => {
    const result = service.classify('איפה אפשר לאכול בשבת אצל משפחה');

    expect(result.category).toBe('hosting');
    expect(result.confidence).toBeGreaterThan(0.45);
  });
});
