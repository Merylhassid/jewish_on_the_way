import { buildDestinationCandidates, detectCountryInText, SearchController } from './search.controller';

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
  ];

  function createController() {
    const destRepo = {
      find: jest.fn().mockResolvedValue(destinations),
    };
    const controller = new SearchController(
      {} as any,
      {} as any,
      destRepo as any,
    );
    return controller as any;
  }

  it('resolves Hebrew aliases and prefixed aliases against DB destinations', async () => {
    const controller = createController();

    await expect(controller.resolveDestinationFromText('בית כנסת בלימסול')).resolves.toMatchObject({
      destination: expect.objectContaining({ city: 'Limassol' }),
      explicitMention: true,
    });
    await expect(controller.resolveDestinationFromText('בית כנסת בפאפוס')).resolves.toMatchObject({
      destination: expect.objectContaining({ city: 'Paphos' }),
      explicitMention: true,
    });
    await expect(controller.resolveDestinationFromText('בית כנסת ברומא')).resolves.toMatchObject({
      destination: expect.objectContaining({ city: 'Rome' }),
      explicitMention: true,
    });
  });

  it('does not resolve Sephardi/Sfarad denomination text as Spain', async () => {
    const controller = createController();

    await expect(controller.resolveDestinationFromText('בית כנסת ספרדי')).resolves.toMatchObject({
      destination: null,
      explicitMention: false,
    });
    await expect(controller.resolveDestinationFromText('נוסח ספרד')).resolves.toMatchObject({
      destination: null,
    });
    await expect(controller.resolveDestinationFromText('בית כנסת בספרד')).resolves.toMatchObject({
      destination: expect.objectContaining({ city: 'Spain' }),
      explicitMention: true,
    });
  });
});
