import { QueryParserService } from './query-parser.service';
import { ClassifierService } from './classifier.service';
import { SearchClassifierService } from './search-classifier.service';
import { DenominationClassifierService } from './denomination-classifier.service';
import { buildDestinationAliasIndex, levenshtein } from './destination-index.service';

describe('QueryParserService', () => {
  const destinations = [
    { id: 1, name: 'Miami', nameHe: 'מיאמי', city: 'Miami', country: 'United States' },
    { id: 2, name: 'Afula', nameHe: 'עפולה', city: 'Afula', country: 'Israel' },
    { id: 3, name: 'Jerusalem', nameHe: 'ירושלים', city: 'Jerusalem', country: 'Israel' },
  ];

  function createService() {
    const classifier = new ClassifierService();
    classifier.onModuleInit();
    const denomination = new DenominationClassifierService();
    denomination.onModuleInit();
    const aliasIndex = buildDestinationAliasIndex(destinations as any);
    const destinationIndex = {
      getIndex: () => aliasIndex,
      fuzzyMatch: (candidates: string[]) => {
        for (const candidate of candidates) {
          for (const [alias, destination] of Array.from(aliasIndex.entries())) {
            if (levenshtein(candidate, alias) <= 2) return destination;
          }
        }
        return null;
      },
    };

    return new QueryParserService(
      classifier,
      new SearchClassifierService(),
      denomination,
      { get: () => undefined } as any,
      destinationIndex as any,
    );
  }

  it('parses an explicit restaurant destination without using the LLM', async () => {
    const service = createService();

    await expect(service.parse('פיצה במיאמי', { allowLlm: false })).resolves.toMatchObject({
      source: 'fast',
      parsed: {
        category: 'restaurant',
        destinationText: 'מיאמי',
        explicitDestination: true,
        restaurant: {
          dish: 'pizza',
          type: 'dairy',
        },
      },
    });
  });

  it('keeps hosting intent stronger than the local category model', async () => {
    const service = createService();

    await expect(service.parse('להתארח בפעולה', { allowLlm: false })).resolves.toMatchObject({
      parsed: {
        category: 'hosting',
        destinationText: 'עפולה',
        explicitDestination: true,
        hosting: {
          mealOrStay: 'either',
        },
      },
    });
  });

  it('marks near-me searches as current-location searches', async () => {
    const service = createService();

    await expect(service.parse('sushi near me', { allowLlm: false })).resolves.toMatchObject({
      parsed: {
        category: 'restaurant',
        destinationText: null,
        explicitDestination: false,
        useCurrentLocation: true,
        restaurant: {
          dish: 'sushi',
          type: 'pareve',
        },
      },
    });
  });

  it('parses local prayer intent as a minyan near the current location', async () => {
    const service = createService();

    await expect(service.parse('איפה מתפללים עכשיו', { allowLlm: false })).resolves.toMatchObject({
      parsed: {
        category: 'minyan',
        destinationText: null,
        explicitDestination: false,
        useCurrentLocation: true,
      },
    });
  });

  it('treats a synagogue that has a minyan as a synagogue place search', async () => {
    const service = createService();

    await expect(service.parse('בית כנסת שיש בו מניין בירושלים', { allowLlm: false })).resolves.toMatchObject({
      parsed: {
        category: 'synagogue',
        destinationText: 'ירושלים',
        explicitDestination: true,
      },
    });
  });

  it('serves repeated normalized queries from cache', async () => {
    const service = createService();

    await service.parse('פיצה במיאמי', { allowLlm: false });
    const second = await service.parse('  פיצה   במיאמי  ', { allowLlm: false });

    expect(second.source).toBe('cache');
  });
});
