import { NAME_TO_TAG, lookupFoodRelation } from './food-relations';

function tagsFromName(name: string): string[] {
  return NAME_TO_TAG
    .filter(([regex]) => regex.test(name))
    .map(([, tag]) => tag);
}

describe('restaurant food relations', () => {
  it('maps common English food queries to searchable tags', () => {
    expect(lookupFoodRelation('breakfast')?.searchTags).toContain('breakfast');
    expect(lookupFoodRelation('bagel')?.searchTags).toContain('bagel');
    expect(lookupFoodRelation('thai')?.searchTags).toContain('asian');
  });

  it('maps common Hebrew food queries to searchable tags', () => {
    expect(lookupFoodRelation('ארוחת בוקר')?.searchTags).toContain('breakfast');
    expect(lookupFoodRelation('בייגל')?.searchTags).toContain('bagel');
    expect(lookupFoodRelation('נודלס')?.searchTags).toContain('noodles');
  });

  it('extracts tags from descriptive restaurant names', () => {
    expect(tagsFromName('District Bagel')).toContain('bagel');
    expect(tagsFromName('Deli 365')).toContain('deli');
    expect(tagsFromName('Thai Wok')).toContain('asian');
  });
});
