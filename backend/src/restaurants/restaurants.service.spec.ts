import { RestaurantsService } from './restaurants.service';
import { lookupFoodRelation } from './food-relations';

describe('RestaurantsService smartSearch keyword cleanup', () => {
  const makeService = () => {
    const restaurantsRepo = {
      query: jest.fn().mockResolvedValue([{ count: '0' }]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const destinationsRepo = {
      findOne: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
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

  it('fills sparse pizza searches with local tags and nearby results up to the smart-search cap', async () => {
    const { service, restaurantsRepo, destinationsRepo } = makeService();
    destinationsRepo.findOne.mockResolvedValue({
      id: 101, name: 'Beit Shemesh', city: 'Beit Shemesh', country: 'Israel',
    });
    destinationsRepo.query.mockResolvedValue([{ lat: 31.75, lng: 34.99 }]);

    const localName = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      name: `פיצה ${i + 1}`,
      distanceMeters: 100 + i,
    }));
    const localTags = [
      { id: 10, name: 'Italian Place', distanceMeters: 300 },
      { id: 11, name: 'Cafe With Pizza', distanceMeters: 350 },
    ];
    const nearbyName = [
      { id: 20, name: 'פיצה ממש קרובה', destinationCity: 'Nearby City', distanceMeters: 8000 },
      { id: 22, name: 'פיצה רחוקה יותר', destinationCity: 'Jerusalem', distanceMeters: 12000 },
    ];
    const nearbyTags = [
      { id: 21, name: 'Italian Nearby', destinationCity: 'Nearby City', distanceMeters: 9000 },
      { id: 23, name: 'Italian Farther', destinationCity: 'Jerusalem', distanceMeters: 15000 },
    ];
    const localType = [
      { id: 30, name: 'Local Dairy Cafe', distanceMeters: 500 },
    ];
    const nearbyType = [
      { id: 31, name: 'Nearby Dairy Cafe', destinationCity: 'Nearby City', distanceMeters: 9500 },
      { id: 32, name: 'Farther Dairy Cafe', destinationCity: 'Jerusalem', distanceMeters: 18000 },
    ];

    restaurantsRepo.query
      .mockResolvedValueOnce([{ count: '6' }])
      .mockResolvedValueOnce(localName)
      .mockResolvedValueOnce(nearbyName)
      .mockResolvedValueOnce(nearbyTags)
      .mockResolvedValueOnce(nearbyType)
      .mockResolvedValueOnce([{ count: '2' }])
      .mockResolvedValueOnce(localTags)
      .mockResolvedValueOnce([{ count: '1' }])
      .mockResolvedValueOnce(localType);

    const result = await service.smartSearch('פיצה', 'dairy', undefined, 101, 31.75, 34.99, 'פיצה');

    expect(result.data.map(r => r.id)).toEqual([1, 2, 3, 4, 5, 6, 20, 10, 11, 30, 21, 31, 22, 23, 32]);
    expect(result.total).toBe(15);
    expect(result.matchTier).toBe(1);
    expect(result.message).toBe('מציג גם תוצאות מערים קרובות');
  });

  it('does not use user GPS for global restaurant fallback when destination origin is missing', async () => {
    const { service, restaurantsRepo, destinationsRepo } = makeService();
    destinationsRepo.findOne.mockResolvedValue({
      id: 501, name: 'Miami', city: 'Miami', country: 'United States',
    });
    destinationsRepo.query.mockResolvedValue([]);

    restaurantsRepo.query
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([{ count: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: '1' }])
      .mockResolvedValueOnce([{ id: 99, name: 'Miami Kosher Place', distanceMeters: 12000000 }]);

    const result = await service.smartSearch('פיצה', 'dairy', undefined, 501, 32.08, 34.78, 'פיצה במיאמי');

    expect(result.data.map(r => r.id)).toEqual([99]);
    expect(result.matchedVia).toEqual([]);
    expect(result.message).toBe('לא נמצאה התאמה מדויקת ל"פיצה" — מציג מסעדות באזור');
    expect(restaurantsRepo.query).toHaveBeenCalledTimes(7);
  });

  it('filters explicit food-type mismatches across smart-search layers', async () => {
    const { service, restaurantsRepo, destinationsRepo } = makeService();
    destinationsRepo.findOne.mockResolvedValue({
      id: 101, name: 'Miami', city: 'Miami', country: 'United States',
    });
    destinationsRepo.query.mockResolvedValue([]);

    restaurantsRepo.findAndCount.mockResolvedValueOnce([[
      { id: 1, name: 'Burger Dairy Cafe', restaurantType: 'dairy' },
      { id: 2, name: 'Burger Grill', restaurantType: 'meat' },
      { id: 3, name: 'Burger Unknown', restaurantType: null },
    ], 3]);
    restaurantsRepo.query
      .mockResolvedValueOnce([{ count: '2' }])
      .mockResolvedValueOnce([
        { id: 4, name: 'Tagged Dairy Burger', restaurantType: 'dairy' },
        { id: 5, name: 'Tagged Meat Burger', restaurantType: 'meat' },
      ]);

    const result = await service.smartSearch('המבורגר', undefined, undefined, 101, undefined, undefined, 'המבורגר במיאמי');

    expect(result.data.map(r => r.id)).toEqual([2, 3, 5]);
    expect(result.data).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ restaurantType: 'dairy' }),
    ]));
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
