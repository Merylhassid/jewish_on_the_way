import { RestaurantsService } from './restaurants.service';
import { lookupFoodRelation } from './food-relations';

describe('RestaurantsService smartSearch keyword cleanup', () => {
  const makeService = () => {
    const restaurantsRepo = {
      query: jest.fn(),
      findAndCount: jest.fn(),
    };
    const destinationsRepo = {
      findOne: jest.fn(),
    };
    const service = new RestaurantsService(
      restaurantsRepo as any,
      destinationsRepo as any,
      {} as any,
    );
    return { service, restaurantsRepo, destinationsRepo };
  };

  it('removes an English destination from restaurant keyword search', async () => {
    const { service, restaurantsRepo, destinationsRepo } = makeService();
    destinationsRepo.findOne.mockResolvedValue({
      id: 348, name: 'Tel Aviv', city: 'Tel Aviv', country: 'Israel',
    });
    restaurantsRepo.query.mockResolvedValue([{ count: '0' }]);
    restaurantsRepo.findAndCount.mockResolvedValueOnce([[{ id: 1, name: 'Pizza Roma' }], 1]);

    const result = await service.smartSearch('pizza tel aviv', 'dairy', undefined, 348, undefined, undefined, 'pizza in Tel Aviv');

    const firstFindOptions = restaurantsRepo.findAndCount.mock.calls[0][0];
    expect((firstFindOptions.where.name as any)._value).toBe('%pizza%');
    expect(result.matchTier).toBe(1);
    expect(result.matchedVia).toEqual(['pizza']);
  });

  it('removes a Hebrew destination alias with location prefix from restaurant keyword search', async () => {
    const { service, restaurantsRepo, destinationsRepo } = makeService();
    destinationsRepo.findOne.mockResolvedValue({
      id: 348, name: 'Tel Aviv', city: 'Tel Aviv', country: 'Israel',
    });
    restaurantsRepo.query.mockResolvedValue([{ count: '0' }]);
    restaurantsRepo.findAndCount.mockResolvedValueOnce([[{ id: 1, name: 'Pizza Roma' }], 1]);

    const result = await service.smartSearch('פיצה בתל אביב', 'dairy', undefined, 348, undefined, undefined, 'פיצה בתל אביב');

    const firstFindOptions = restaurantsRepo.findAndCount.mock.calls[0][0];
    expect((firstFindOptions.where.name as any)._value).toBe('%פיצה%');
    expect(result.matchTier).toBe(1);
    expect(result.matchedVia).toEqual(['פיצה']);
  });
});

describe('food-relations lookupFoodRelation — new terms', () => {
  it('מאפייה → bakery tags', () => {
    const rel = lookupFoodRelation('מאפייה');
    expect(rel).toBeDefined();
    expect(rel!.searchTags).toContain('bakery');
  });

  it('מאפיה → bakery tags (alternate spelling)', () => {
    const rel = lookupFoodRelation('מאפיה');
    expect(rel).toBeDefined();
    expect(rel!.searchTags).toContain('bakery');
  });

  it('מאפייה מהדרין → partial match finds bakery (kashrut word does not block)', () => {
    const rel = lookupFoodRelation('מאפייה מהדרין');
    expect(rel).toBeDefined();
    expect(rel!.searchTags).toContain('bakery');
  });

  it('בגט → sandwich/bakery tags', () => {
    const rel = lookupFoodRelation('בגט');
    expect(rel).toBeDefined();
    expect(rel!.searchTags).toContain('sandwich');
  });

  it('קציצות → grill/meat tags', () => {
    const rel = lookupFoodRelation('קציצות');
    expect(rel).toBeDefined();
    expect(rel!.searchTags).toContain('grill');
    expect(rel!.fallbackType).toBe('meat');
  });

  it('פריקסה → sandwich/street-food tags', () => {
    const rel = lookupFoodRelation('פריקסה');
    expect(rel).toBeDefined();
    expect(rel!.searchTags).toContain('sandwich');
  });

  it('בורקס גבינה → partial match preserves בורקס (bakery)', () => {
    const rel = lookupFoodRelation('בורקס גבינה');
    expect(rel).toBeDefined();
    expect(rel!.searchTags).toContain('bakery');
  });

  it('בורקס תפוח אדמה → partial match preserves בורקס', () => {
    const rel = lookupFoodRelation('בורקס תפוח אדמה');
    expect(rel).toBeDefined();
    expect(rel!.searchTags).toContain('bakery');
  });

  it('bakery → bakery tags (English)', () => {
    const rel = lookupFoodRelation('bakery');
    expect(rel).toBeDefined();
    expect(rel!.searchTags).toContain('bakery');
  });
});
