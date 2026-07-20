import {
  buildDestinationCandidates, detectCountryInText, SearchController,
  decideCategory, hasNearMeMarker, stripCurrentLocation, stripNearMe, isAmbiguousIntent, hasExplicitIntent,
} from './search.controller';

describe('SearchController rate limit', () => {
  it('limits expensive search requests to 30 per minute per client', () => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', SearchController.prototype.search)).toBe(30);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', SearchController.prototype.search)).toBe(60_000);
  });
});

// ── Destination-only guardrail: gating logic ────────────────────────────────
// A bare destination has NO explicit intent → guardrail fires → destination page.
// Any explicit intent keeps the intent (guardrail skipped).
describe('destination-only guardrail — hasExplicitIntent gating', () => {
  it('bare places have no explicit intent', () => {
    for (const q of ['מרקש', 'בני ברק', 'בית שמש', 'רמת גן', 'גן יבנה', 'באר שבע', 'תל אביב', 'בת ים', 'מרוקו', 'תאילנד', 'רומא']) {
      expect(hasExplicitIntent(q)).toBe(false);
    }
  });
  it('explicit intent is detected (guardrail will be skipped)', () => {
    expect(hasExplicitIntent('מניין במרקש')).toBe(true);
    expect(hasExplicitIntent('בית כנסת בבני ברק')).toBe(true);
    expect(hasExplicitIntent('מסעדה בבית שמש')).toBe(true);
    expect(hasExplicitIntent('אירוח במרקש')).toBe(true);
  });
  it('"נוסח ספרד" is not an intent AND must not be a destination (stays denomination path)', () => {
    expect(hasExplicitIntent('נוסח ספרד')).toBe(false); // handled by the resolver test below (no Spain)
  });

  it('destination-info phrasings have no intent, but real intent + a city still wins', () => {
    // filler-only around a place → destination (no intent)
    expect(hasExplicitIntent('יעד ניו יורק')).toBe(false);
    expect(hasExplicitIntent('מידע על טורונטו')).toBe(false);
    expect(hasExplicitIntent('מה יש לעשות בזנבה')).toBe(false);
    // explicit intent must NOT be weakened by the filler words
    expect(hasExplicitIntent('מה יש לאכול בטורונטו')).toBe(true);   // food
    expect(hasExplicitIntent('בית כנסת בניו יורק')).toBe(true);      // synagogue
    expect(hasExplicitIntent('מניין במיאמי')).toBe(true);           // minyan
    expect(hasExplicitIntent('אירוח לשבת בלונדון')).toBe(true);     // hosting
  });
});
import { buildDestinationAliasIndex } from './destination-index.service';

// ── Codex-blocker regressions ────────────────────────────────────────────────
describe('Codex blockers', () => {
  const ml = { category: 'ml', emoji: '', confidence: 0.5 };
  const cat = (t: string) => (decideCategory(t, ml) as any).category;

  it('#2 food lock — dishes classify as restaurant', () => {
    for (const d of ['בקלאווה','קלאווה','פנקייק','טוסט','גחנון','גלידה','סושי','לזניה','מלאווח']) {
      expect(cat(d)).toBe('restaurant');
    }
  });

  it('#4 hosting typos → hosting', () => {
    expect(cat('ארוחת שב')).toBe('hosting');
    expect(cat('ארוחת לי שבת')).toBe('hosting');
    expect(cat('ארוחת בשת')).toBe('hosting');
    expect(cat('להתאר בשבת')).toBe('hosting');
    expect(cat('לינה לשבת')).toBe('hosting');
  });

  it('English gaps: gelato → restaurant, pray/prayer → minyan', () => {
    expect(cat('gelato in milano')).toBe('restaurant');
    expect(cat('pray near me')).toBe('minyan');
    expect(cat('prayer times')).toBe('minyan');
  });

  it('#3 stripNearMe removes near-me markers so they cannot fuzzy-match a city', () => {
    expect(stripNearMe('בית כנסת כאן')).toBe('בית כנסת');
    expect(stripNearMe('פיצה לידי')).toBe('פיצה');
    const s = stripNearMe('מניין קרוב אליי');
    expect(s).toContain('מניין');
    expect(s).not.toContain('קרוב');
  });
});

// ── Intent-decision regressions (curated from the 1000-query audit) ──────────
describe('decideCategory — intent priority (audit regressions)', () => {
  const ml = { category: 'ml-fallback', emoji: '', confidence: 0.5 };
  const cat = (t: string) => (decideCategory(t, ml) as any).category;

  it('routes minyan queries to minyan (were misclassified as restaurant)', () => {
    expect(cat('מניין שחרית ברעננה')).toBe('minyan');
    expect(cat('מניין מנחה במרקש')).toBe('minyan');
    expect(cat('שחרית ותיקין קרוב אליי')).toBe('minyan');
    expect(cat('mincha minyan')).toBe('minyan');
  });

  it('"בית כנסת עם מניין" → synagogue, but "מניין ... בבית כנסת" → minyan', () => {
    expect(cat('בית כנסת עם מניין בפראג')).toBe('synagogue');
    expect(cat('מניין שחרית בבית כנסת')).toBe('minyan');
  });

  it('head word decides the food vs minyan conflict', () => {
    expect(cat('מסעדה ליד מניין')).toBe('restaurant');
    expect(cat('מניין ליד מסעדה')).toBe('minyan');
  });

  it('shabbat-hosting beats the food word "ארוחת", but explicit מסעדה still wins', () => {
    expect(cat('ארוחת שבת בחולון')).toBe('hosting');
    expect(cat('להתארח אצל משפחה')).toBe('hosting');
    expect(cat('מסעדה לארוחת שבת')).toBe('restaurant');
  });

  it('synagogue complex phrases (English / chabad / shul)', () => {
    expect(cat('find chabad synagogue near me')).toBe('synagogue');
    expect(cat('synagogue in Tel Aviv')).toBe('synagogue');
    expect(cat('בית חבד קרוב אלי')).toBe('synagogue');
  });

  it('previously-missing dishes/cuisines classify as restaurant', () => {
    expect(cat('לזניה קרוב אליי')).toBe('restaurant');
    expect(cat('מסעדה מקסיקני עם ילדים')).toBe('restaurant');
    expect(cat('אנטריקוט לא יקר')).toBe('restaurant');
  });
});

describe('hasNearMeMarker', () => {
  it('matches only exact near-me markers', () => {
    expect(hasNearMeMarker('פיצה קרוב אלי')).toBe(true);
    expect(hasNearMeMarker('מניין לידי')).toBe(true);
    expect(hasNearMeMarker('בית כנסת פה')).toBe(true);
    expect(hasNearMeMarker('find kosher pizza near me')).toBe(true);
    expect(hasNearMeMarker('פלאפל באזור שלי')).toBe(true);
  });
  it('does NOT treat "קרוב ל..." or "ליד ה..." as near-me', () => {
    expect(hasNearMeMarker('מסעדה קרוב למלון')).toBe(false);
    expect(hasNearMeMarker('בית חבד קרוב למלון במרקש')).toBe(false);
    expect(hasNearMeMarker('פיצה ליד המלון')).toBe(false);
  });
});

describe('stripCurrentLocation — explicit destination wins over current location', () => {
  it('drops "אני ב<city>" so the target city remains', () => {
    const t = stripCurrentLocation('אני בתל אביב אבל רוצה חומוס בבית שמש');
    expect(t).toContain('בית שמש');
    expect(t).not.toContain('תל אביב');
  });
});

describe('isAmbiguousIntent', () => {
  it('flags conflicting intents joined by או', () => {
    expect(isAmbiguousIntent('בית כנסת או מסעדה')).toBe(true);
    expect(isAmbiguousIntent('להתארח או לאכול')).toBe(true);
  });
  it('does not flag a normal single-intent query', () => {
    expect(isAmbiguousIntent('מסעדה בתל אביב')).toBe(false);
  });
});

describe('detectCountryInText', () => {
  it('does not treat Sephardi denomination words as Spain', () => {
    expect(detectCountryInText('בית כנסת ספרדי')).toBeNull();
    expect(detectCountryInText('קהילה ספרדית קרובה')).toBeNull();
    expect(detectCountryInText('נוסח ספרד')).toBeNull();
    // "נוסח" with a Hebrew prefix must also stay a denomination, not Spain
    expect(detectCountryInText('בית כנסת בנוסח ספרד')).toBeNull();
    expect(detectCountryInText('בית כנסת בנוסח ספרדי')).toBeNull();
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
    // "בנוסח ספרד/ספרדי" is the Sfarad nusach — must NOT resolve to Spain and must NOT fail closed
    expect(controller.resolveDestinationFromText('בית כנסת בנוסח ספרד')).toMatchObject({
      destination: null,
      explicitMention: false,
    });
    expect(controller.resolveDestinationFromText('בית כנסת בנוסח ספרדי')).toMatchObject({
      destination: null,
      explicitMention: false,
    });
  });

  it('does not treat other denominations (תימני/אשכנזי/חבד) as unresolvable destinations', () => {
    const controller = createController();

    const queries = [
      'בית כנסת תימני', 'בית כנסת תימן', 'בית כנסת אשכנזי', 'מניין חבד',
      'בית כנסת חסידי', 'בית כנסת עדות המזרח', 'בית כנסת שאמי',
    ];
    for (const q of queries) {
      expect(controller.resolveDestinationFromText(q)).toMatchObject({
        destination: null,
        explicitMention: false, // must be false so the search does NOT fail closed
      });
    }
  });

  it('destination-only guardrail: a bare city resolves (→ destination page), and intent still resolves the city', () => {
    const controller = createController(); 
    // bare place with no intent → resolvable → guardrail routes to /destination/:id
    expect(controller.resolveDestinationFromText('רומא')).toMatchObject({
      destination: expect.objectContaining({ city: 'Rome' }),
    });
    // with explicit intent the city still resolves (normal flow), guardrail is skipped upstream by hasExplicitIntent
    expect(controller.resolveDestinationFromText('מסעדה ברומא')).toMatchObject({
      destination: expect.objectContaining({ city: 'Rome' }),
    });
    // "נוסח ספרד" must NOT resolve to Spain even in the guardrail path
    expect(controller.resolveDestinationFromText('נוסח ספרד')).toMatchObject({ destination: null });
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

  it('routes fuzzy food typos through the restaurant path', async () => {
    const { controller } = createController('synagogue');

    const hummus = await controller.search({ text: 'חומו במיאמי' } as any);
    expect(hummus).toMatchObject({
      category: 'restaurant',
      destinationId: 6,
      restaurantType: 'parve',
    });
    expect(new URL(hummus.route, 'http://localhost').pathname).toBe('/restaurants/6');

    const shawarma = await controller.search({ text: 'שוארמה במיאמי' } as any);
    expect(shawarma).toMatchObject({
      category: 'restaurant',
      destinationId: 6,
      restaurantType: 'meat',
    });
    expect(new URL(shawarma.route, 'http://localhost').pathname).toBe('/restaurants/6');
  });

  it('routes a missing-letter synagogue phrase as synagogue', async () => {
    const { controller } = createController('restaurant');

    const result = await controller.search({ text: 'בית כנס במיאמי' } as any);
    expect(result).toMatchObject({
      category: 'synagogue',
      destinationId: 6,
    });
    expect(new URL(result.route, 'http://localhost').pathname).toBe('/synagogues/6');
  });

  it('uses GPS fallback for fuzzy food intent without an explicit destination', async () => {
    const { controller, destRepo } = createController('synagogue', destinations[0]);

    const result = await controller.search({ text: 'שוארמה', lat: 25.76, lng: -80.19 } as any);
    expect(result).toMatchObject({
      category: 'restaurant',
      destinationId: 6,
      gpsUsed: true,
      restaurantType: 'meat',
    });
    expect(destRepo.query).toHaveBeenCalled();
    const url = new URL(result.route, 'http://localhost');
    expect(url.pathname).toBe('/restaurants/6');
    expect(url.searchParams.get('type')).toBe('meat');
    expect(url.searchParams.get('useUserGps')).toBe('true');
  });

  it('uses GPS fallback for fuzzy synagogue intent without an explicit destination', async () => {
    const { controller, destRepo } = createController('restaurant', destinations[0]);

    const result = await controller.search({ text: 'בית כנס', lat: 25.76, lng: -80.19 } as any);
    expect(result).toMatchObject({
      category: 'synagogue',
      destinationId: 6,
      gpsUsed: true,
    });
    expect(destRepo.query).toHaveBeenCalled();
    expect(new URL(result.route, 'http://localhost').pathname).toBe('/synagogues/6');
  });

  it('treats common synagogue typos as synagogue intent', async () => {
    const { controller } = createController('restaurant');

    const result = await controller.search({ text: 'בית גנסת במיאמי' } as any);
    expect(result).toMatchObject({
      category: 'synagogue',
      destinationId: 6,
    });
    expect(new URL(result.route, 'http://localhost').pathname).toBe('/synagogues/6');
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
