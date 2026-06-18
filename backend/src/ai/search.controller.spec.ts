import { buildDestinationCandidates, detectCountryInText, SearchController } from './search.controller';
import { buildDestinationAliasIndex } from './destination-index.service';

describe('detectCountryInText', () => {
  it('does not treat Sephardi denomination words as Spain', () => {
    expect(detectCountryInText('בית כנסת ספרדי')).toBeNull();
    expect(detectCountryInText('קהילה ספרדית קרובה')).toBeNull();
    expect(detectCountryInText('נוסח ספרד')).toBeNull();
  });

  it('still detects Spain when Spain is an explicit destination', () => {
    expect(detectCountryInText('בית כנסת בספרד')).toBe('Spain');
    expect(detectCountryInText('מניין ספרדי בספרד')).toBe('Spain');
    expect(detectCountryInText('אני נוסע לספרד ומחפש אוכל כשר')).toBe('Spain');
  });
});

describe('buildDestinationCandidates', () => {
  it('normalizes common Hebrew location prefixes', () => {
    expect(buildDestinationCandidates('בית כנסת בלימסול')).toContain('לימסול');
    expect(buildDestinationCandidates('בית כנסת בפאפוס')).toContain('פאפוס');
    expect(buildDestinationCandidates('בית כנסת ברומא')).toContain('רומא');
  });

  it('does not turn intent words into fake destination candidates', () => {
    expect(buildDestinationCandidates('מסעדה כשרה קרובה אליי')).not.toContain('סעדה');
  });
});

describe('SearchController destination resolver', () => {
  const destinations = [
    { id: 1, name: 'Italy', city: 'Italy', country: 'Italy' },
    { id: 2, name: 'Rome', city: 'Rome', country: 'Italy' },
    { id: 3, name: 'Limassol', city: 'Limassol', country: 'Cyprus' },
    { id: 4, name: 'Paphos', city: 'Paphos', country: 'Cyprus' },
    { id: 5, name: 'Spain', city: 'Spain', country: 'Spain' },
    { id: 6, name: 'Miami', city: 'Miami', country: 'United States' },
    { id: 7, name: 'Afula', city: 'Afula', country: 'Israel' },
  ];

  function createController() {
    const aliasIndex = buildDestinationAliasIndex(destinations as any);
    const indexService = { getIndex: () => aliasIndex };
    const controller = new SearchController(
      {} as any,
      {} as any,
      indexService as any,
      {} as any,
      {} as any,
    );
    return controller as any;
  }

  it('resolves Hebrew aliases and prefixed aliases against DB destinations', () => {
    const controller = createController();

    expect(controller.resolveDestinationFromText('בית כנסת בלימסול')).toMatchObject({
      destination: expect.objectContaining({ city: 'Limassol' }),
      explicitMention: true,
    });
    expect(controller.resolveDestinationFromText('בית כנסת בפאפוס')).toMatchObject({
      destination: expect.objectContaining({ city: 'Paphos' }),
      explicitMention: true,
    });
    expect(controller.resolveDestinationFromText('בית כנסת ברומא')).toMatchObject({
      destination: expect.objectContaining({ city: 'Rome' }),
      explicitMention: true,
    });
  });

  it('does not resolve Sephardi/Sfarad denomination text as Spain', () => {
    const controller = createController();

    expect(controller.resolveDestinationFromText('בית כנסת ספרדי')).toMatchObject({
      destination: null,
      explicitMention: false,
    });
    expect(controller.resolveDestinationFromText('נוסח ספרד')).toMatchObject({
      destination: null,
    });
    expect(controller.resolveDestinationFromText('בית כנסת בספרד')).toMatchObject({
      destination: expect.objectContaining({ city: 'Spain' }),
      explicitMention: true,
    });
  });
});

describe('SearchController hosting intent', () => {
  const destinations = [
    { id: 6, name: 'Miami', city: 'Miami', country: 'United States' },
    { id: 7, name: 'Afula', city: 'Afula', country: 'Israel' },
  ];

  function createController(category: string) {
    const aliasIndex = buildDestinationAliasIndex(destinations as any);
    const controller = new SearchController(
      {
        classify: jest.fn().mockReturnValue({
          category,
          confidence: 0.9,
          emoji: category === 'minyan' ? '🤝' : '🍽️',
          allScores: {},
        }),
      } as any,
      { classify: jest.fn().mockReturnValue({ denomination: null }) } as any,
      { getIndex: () => aliasIndex, fuzzyMatch: jest.fn() } as any,
      {} as any,
      { create: (value: any) => value, save: jest.fn() } as any,
    );
    return controller;
  }

  it('routes להתארח במיאמי to hosting even if the model predicts restaurant', async () => {
    const controller = createController('restaurant');

    await expect(controller.search({ text: 'להתארח במיאמי' } as any)).resolves.toMatchObject({
      category: 'hosting',
      destinationId: 6,
      route: '/hosting/6',
    });
  });

  it('routes להתארח בעפולה to hosting even if the model predicts minyan', async () => {
    const controller = createController('minyan');

    await expect(controller.search({ text: 'להתארח בעפולה' } as any)).resolves.toMatchObject({
      category: 'hosting',
      destinationId: 7,
      route: '/hosting/7',
    });
  });

  it('handles the common typo להתארח בפעולה as Afula hosting', async () => {
    const controller = createController('minyan');

    await expect(controller.search({ text: 'להתארח בפעולה' } as any)).resolves.toMatchObject({
      category: 'hosting',
      destinationId: 7,
      route: '/hosting/7',
    });
  });
});

describe('SearchController routing regressions', () => {
  const destinations = [
    { id: 6, name: 'Miami', city: 'Miami', country: 'United States' },
    { id: 7, name: 'Afula', city: 'Afula', country: 'Israel' },
    { id: 8, name: 'London', city: 'London', country: 'United Kingdom' },
  ];

  function createController(category: string, nearestDestination: any = null) {
    const aliasIndex = buildDestinationAliasIndex(destinations as any);
    const destRepo = {
      query: jest.fn().mockResolvedValue(nearestDestination ? [{ id: nearestDestination.id }] : []),
      findOne: jest.fn().mockResolvedValue(nearestDestination),
    };
    const controller = new SearchController(
      {
        classify: jest.fn().mockReturnValue({
          category,
          confidence: 0.9,
          emoji: category === 'synagogue' ? '🕍' : '🍽️',
          allScores: {},
        }),
      } as any,
      { classify: jest.fn().mockReturnValue({ denomination: null }) } as any,
      { getIndex: () => aliasIndex, fuzzyMatch: jest.fn().mockReturnValue(null) } as any,
      destRepo as any,
      { create: (value: any) => value, save: jest.fn().mockResolvedValue({ id: 1 }) } as any,
    );
    return { controller, destRepo };
  }

  it('keeps explicit foreign restaurant destination even when user GPS is local', async () => {
    const { controller } = createController('synagogue');

    const result = await controller.search({ text: 'פיצה במיאמי', lat: 32.08, lng: 34.78 } as any);
    expect(result).toMatchObject({
      category: 'restaurant',
      destinationId: 6,
      gpsUsed: false,
      restaurantType: 'dairy',
    });
    const url = new URL(result.route, 'http://localhost');
    expect(url.pathname).toBe('/restaurants/6');
    expect(url.searchParams.get('type')).toBe('dairy');
    expect(url.searchParams.get('useUserGps')).toBe('true');
    expect(url.searchParams.get('q')).toBe('פיצה במיאמי');
  });

  it('routes food intent to restaurants even when synagogue words are present', async () => {
    const { controller } = createController('synagogue');

    const result = await controller.search({ text: 'אוכל כשר ליד בית כנסת חבד בלונדון' } as any);
    expect(result).toMatchObject({
      category: 'restaurant',
      destinationId: 8,
    });
    const url = new URL(result.route, 'http://localhost');
    expect(url.pathname).toBe('/restaurants/8');
    expect(url.searchParams.get('q')).toBe('אוכל כשר ליד בית כנסת חבד בלונדון');
  });

  it('does not fall back to current GPS when an explicit destination cannot be resolved', async () => {
    const { controller, destRepo } = createController('restaurant', destinations[1]);

    await expect(controller.search({ text: 'מסעדה באי ירח', lat: 32.08, lng: 34.78 } as any)).resolves.toMatchObject({
      category: 'restaurant',
      error: 'destination_not_found',
      route: null,
      gpsUsed: false,
    });
    expect(destRepo.query).not.toHaveBeenCalled();
  });
});
