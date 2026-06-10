export interface FoodRelation {
  searchTags: string[];
  fallbackType?: 'meat' | 'dairy' | 'pareve';
}

/**
 * Maps a user's food query term to the tags we should search for in the DB,
 * plus a fallback kashrut type for Tier-3 broad search.
 * Keys are lowercase. Both Hebrew and English covered.
 */
export const FOOD_RELATIONS: Record<string, FoodRelation> = {
  // ── Hebrew ──────────────────────────────────────────────────────────────
  'חזה עוף':   { searchTags: ['chicken', 'grill', 'shawarma'], fallbackType: 'meat' },
  'עוף':        { searchTags: ['chicken', 'grill', 'shawarma'], fallbackType: 'meat' },
  'המבורגר':   { searchTags: ['burger', 'grill'],               fallbackType: 'meat' },
  'המברגר':    { searchTags: ['burger', 'grill'],               fallbackType: 'meat' },
  'בורגר':     { searchTags: ['burger', 'grill'],               fallbackType: 'meat' },
  'שניצל':     { searchTags: ['chicken', 'fast-food'],           fallbackType: 'meat' },
  'שינצל':     { searchTags: ['chicken', 'fast-food'],           fallbackType: 'meat' },
  'שניצלון':   { searchTags: ['chicken', 'fast-food'],           fallbackType: 'meat' },
  'בשר':        { searchTags: ['grill', 'burger', 'shawarma', 'steak'], fallbackType: 'meat' },
  'בשרי':      { searchTags: ['grill', 'burger', 'shawarma', 'steak'], fallbackType: 'meat' },
  'בשרית':     { searchTags: ['grill', 'burger', 'shawarma', 'steak'], fallbackType: 'meat' },
  'סטייק':     { searchTags: ['steak', 'grill'],                 fallbackType: 'meat' },
  'סטייקהאוס': { searchTags: ['steak', 'grill'],                 fallbackType: 'meat' },
  'שווארמה':   { searchTags: ['shawarma', 'grill'],              fallbackType: 'meat' },
  'שוארמה':    { searchTags: ['shawarma', 'grill'],              fallbackType: 'meat' },
  'קבב':        { searchTags: ['grill', 'shawarma'],              fallbackType: 'meat' },
  'אסאדו':     { searchTags: ['grill', 'steak'],                 fallbackType: 'meat' },
  'מנגל':      { searchTags: ['grill', 'steak', 'burger'],       fallbackType: 'meat' },
  'פסטה':      { searchTags: ['pasta', 'italian'],               fallbackType: 'dairy' },
  'פיצה':      { searchTags: ['pizza', 'italian'],               fallbackType: 'dairy' },
  'פיצריה':    { searchTags: ['pizza', 'italian'],               fallbackType: 'dairy' },
  'לאזניה':    { searchTags: ['pasta', 'italian'],               fallbackType: 'dairy' },
  'קפה':        { searchTags: ['cafe', 'coffee'],                 fallbackType: 'dairy' },
  'עוגה':      { searchTags: ['bakery', 'cafe'],                  fallbackType: 'dairy' },
  'גלידה':     { searchTags: ['ice-cream', 'cafe'],               fallbackType: 'dairy' },
  'וופל':      { searchTags: ['cafe', 'bakery'],                  fallbackType: 'dairy' },
  'בורקס':     { searchTags: ['bakery', 'cafe'],                  fallbackType: 'dairy' },
  'ארוחת בוקר': { searchTags: ['breakfast', 'cafe', 'bakery'],    fallbackType: 'dairy' },
  'בוקר':      { searchTags: ['breakfast', 'cafe', 'bakery'],     fallbackType: 'dairy' },
  'בראנץ':     { searchTags: ['breakfast', 'cafe', 'bakery'],     fallbackType: 'dairy' },
  'בייגל':     { searchTags: ['bagel', 'bakery', 'cafe'],         fallbackType: 'dairy' },
  'בייגלס':    { searchTags: ['bagel', 'bakery', 'cafe'],         fallbackType: 'dairy' },
  'כריך':      { searchTags: ['sandwich', 'deli', 'cafe'] },
  'כריכים':    { searchTags: ['sandwich', 'deli', 'cafe'] },
  'סנדוויץ':   { searchTags: ['sandwich', 'deli', 'cafe'] },
  'סנדוויצים': { searchTags: ['sandwich', 'deli', 'cafe'] },
  'מעדניה':    { searchTags: ['deli', 'sandwich'] },
  'קינוח':     { searchTags: ['dessert', 'bakery', 'cafe'],       fallbackType: 'dairy' },
  'קינוחים':   { searchTags: ['dessert', 'bakery', 'cafe'],       fallbackType: 'dairy' },
  'מתוקים':    { searchTags: ['dessert', 'bakery', 'cafe'],       fallbackType: 'dairy' },
  'פטיסרי':    { searchTags: ['dessert', 'bakery', 'cafe'],       fallbackType: 'dairy' },
  'חלבי':      { searchTags: ['pizza', 'pasta', 'cafe'],          fallbackType: 'dairy' },
  'חלבית':     { searchTags: ['pizza', 'pasta', 'cafe'],          fallbackType: 'dairy' },
  'סושי':      { searchTags: ['sushi', 'fish', 'asian'],          fallbackType: 'pareve' },
  'דגים':      { searchTags: ['fish', 'sushi'],                   fallbackType: 'pareve' },
  'סלמון':     { searchTags: ['fish', 'sushi'],                   fallbackType: 'pareve' },
  'טונה':      { searchTags: ['fish', 'sushi'],                   fallbackType: 'pareve' },
  'פלאפל':     { searchTags: ['falafel', 'street-food'],          fallbackType: 'pareve' },
  'פלאפלים':   { searchTags: ['falafel', 'street-food'],          fallbackType: 'pareve' },
  'חומוס':     { searchTags: ['hummus', 'falafel'],               fallbackType: 'pareve' },
  'סלט':        { searchTags: ['salad', 'healthy'],               fallbackType: 'pareve' },
  'טבעוני':    { searchTags: ['vegan', 'salad', 'healthy'],       fallbackType: 'pareve' },
  'טבעונית':   { searchTags: ['vegan', 'salad', 'healthy'],       fallbackType: 'pareve' },
  'צמחוני':    { searchTags: ['vegan', 'salad', 'healthy'],       fallbackType: 'pareve' },
  'צמחונית':   { searchTags: ['vegan', 'salad', 'healthy'],       fallbackType: 'pareve' },
  // Cuisine types
  'יפני':      { searchTags: ['sushi', 'asian'],                  fallbackType: 'pareve' },
  'אסייתי':   { searchTags: ['asian', 'sushi'],                   fallbackType: 'pareve' },
  'אסיאתי':   { searchTags: ['asian', 'sushi'],                   fallbackType: 'pareve' },
  'איטלקי':   { searchTags: ['pasta', 'italian', 'pizza'],        fallbackType: 'dairy' },
  'ים תיכוני': { searchTags: ['hummus', 'falafel', 'salad'],       fallbackType: 'pareve' },
  'ים תיכונית':{ searchTags: ['hummus', 'falafel', 'salad'],       fallbackType: 'pareve' },
  'מזרחי':    { searchTags: ['hummus', 'falafel', 'shawarma'],    fallbackType: 'meat' },
  'אמריקאי':  { searchTags: ['burger', 'grill'],                  fallbackType: 'meat' },
  'סיני':      { searchTags: ['asian', 'noodles', 'sushi'],        fallbackType: 'pareve' },
  'תאילנדי':  { searchTags: ['asian', 'noodles'],                 fallbackType: 'pareve' },
  'נודלס':    { searchTags: ['noodles', 'asian'],                 fallbackType: 'pareve' },
  'ראמן':     { searchTags: ['noodles', 'asian'],                 fallbackType: 'pareve' },
  'מוקפץ':    { searchTags: ['noodles', 'asian'],                 fallbackType: 'pareve' },
  'מרק':      { searchTags: ['soup', 'deli'] },
  'מקסיקני':  { searchTags: ['mexican', 'grill'],                 fallbackType: 'meat' },
  'טאקו':     { searchTags: ['mexican', 'grill'],                 fallbackType: 'meat' },
  'מזון מהיר': { searchTags: ['fast-food', 'burger', 'falafel'] },
  'אוכל רחוב': { searchTags: ['street-food', 'falafel', 'shawarma'] },
  'טייק אווי': { searchTags: ['takeaway', 'deli'] },
  'לקחת':     { searchTags: ['takeaway', 'deli'] },

  // ── English ──────────────────────────────────────────────────────────────
  'chicken':        { searchTags: ['chicken', 'grill', 'shawarma'],     fallbackType: 'meat' },
  'chicken breast': { searchTags: ['chicken', 'grill', 'shawarma'],     fallbackType: 'meat' },
  'hamburger':      { searchTags: ['burger', 'grill'],                   fallbackType: 'meat' },
  'burger':         { searchTags: ['burger', 'grill'],                   fallbackType: 'meat' },
  'burgers':        { searchTags: ['burger', 'grill'],                   fallbackType: 'meat' },
  'cheeseburger':   { searchTags: ['burger', 'grill'],                   fallbackType: 'meat' },
  'steak':          { searchTags: ['steak', 'grill'],                    fallbackType: 'meat' },
  'schnitzel':      { searchTags: ['chicken', 'fast-food'],              fallbackType: 'meat' },
  'kebab':          { searchTags: ['grill', 'shawarma'],                 fallbackType: 'meat' },
  'shawarma':       { searchTags: ['shawarma', 'grill'],                 fallbackType: 'meat' },
  'grill':          { searchTags: ['grill', 'steak', 'burger'],          fallbackType: 'meat' },
  'bbq':            { searchTags: ['grill', 'steak'],                    fallbackType: 'meat' },
  'meat':           { searchTags: ['grill', 'burger', 'shawarma', 'steak'], fallbackType: 'meat' },
  'pizza':          { searchTags: ['pizza', 'italian'],                  fallbackType: 'dairy' },
  'pasta':          { searchTags: ['pasta', 'italian'],                  fallbackType: 'dairy' },
  'lasagna':        { searchTags: ['pasta', 'italian'],                  fallbackType: 'dairy' },
  'cafe':           { searchTags: ['cafe', 'coffee'],                    fallbackType: 'dairy' },
  'coffee':         { searchTags: ['cafe', 'coffee'],                    fallbackType: 'dairy' },
  'cake':           { searchTags: ['bakery', 'cafe'],                    fallbackType: 'dairy' },
  'bakery':         { searchTags: ['bakery', 'cafe'],                    fallbackType: 'dairy' },
  'bagel':          { searchTags: ['bagel', 'bakery', 'cafe'],           fallbackType: 'dairy' },
  'bagels':         { searchTags: ['bagel', 'bakery', 'cafe'],           fallbackType: 'dairy' },
  'breakfast':      { searchTags: ['breakfast', 'cafe', 'bakery'],       fallbackType: 'dairy' },
  'brunch':         { searchTags: ['breakfast', 'cafe', 'bakery'],       fallbackType: 'dairy' },
  'sandwich':       { searchTags: ['sandwich', 'deli', 'cafe'] },
  'sandwiches':     { searchTags: ['sandwich', 'deli', 'cafe'] },
  'deli':           { searchTags: ['deli', 'sandwich'] },
  'dessert':        { searchTags: ['dessert', 'bakery', 'cafe'],         fallbackType: 'dairy' },
  'desserts':       { searchTags: ['dessert', 'bakery', 'cafe'],         fallbackType: 'dairy' },
  'sweets':         { searchTags: ['dessert', 'bakery', 'cafe'],         fallbackType: 'dairy' },
  'pastry':         { searchTags: ['dessert', 'bakery', 'cafe'],         fallbackType: 'dairy' },
  'pastries':       { searchTags: ['dessert', 'bakery', 'cafe'],         fallbackType: 'dairy' },
  'patisserie':     { searchTags: ['dessert', 'bakery', 'cafe'],         fallbackType: 'dairy' },
  'ice cream':      { searchTags: ['ice-cream', 'cafe'],                 fallbackType: 'dairy' },
  'sushi':          { searchTags: ['sushi', 'fish', 'asian'],            fallbackType: 'pareve' },
  'fish':           { searchTags: ['fish', 'sushi'],                     fallbackType: 'pareve' },
  'seafood':        { searchTags: ['fish', 'sushi'],                     fallbackType: 'pareve' },
  'salmon':         { searchTags: ['fish', 'sushi'],                     fallbackType: 'pareve' },
  'tuna':           { searchTags: ['fish', 'sushi'],                     fallbackType: 'pareve' },
  'falafel':        { searchTags: ['falafel', 'street-food'],            fallbackType: 'pareve' },
  'hummus':         { searchTags: ['hummus', 'falafel'],                 fallbackType: 'pareve' },
  'salad':          { searchTags: ['salad', 'healthy'],                  fallbackType: 'pareve' },
  'vegan':          { searchTags: ['vegan', 'salad', 'healthy'],         fallbackType: 'pareve' },
  'vegetarian':     { searchTags: ['vegan', 'salad', 'healthy'],         fallbackType: 'pareve' },
  'waffle':         { searchTags: ['cafe', 'bakery'],                    fallbackType: 'dairy' },
  'ice':            { searchTags: ['ice-cream', 'cafe'],                 fallbackType: 'dairy' },
  'dairy':          { searchTags: ['pizza', 'pasta', 'cafe'],            fallbackType: 'dairy' },
  'chinese':        { searchTags: ['asian', 'noodles', 'sushi'],          fallbackType: 'pareve' },
  'thai':           { searchTags: ['asian', 'noodles'],                   fallbackType: 'pareve' },
  'noodles':        { searchTags: ['noodles', 'asian'],                   fallbackType: 'pareve' },
  'noodle':         { searchTags: ['noodles', 'asian'],                   fallbackType: 'pareve' },
  'ramen':          { searchTags: ['noodles', 'asian'],                   fallbackType: 'pareve' },
  'soup':           { searchTags: ['soup', 'deli'] },
  'mexican':        { searchTags: ['mexican', 'grill'],                   fallbackType: 'meat' },
  'taco':           { searchTags: ['mexican', 'grill'],                   fallbackType: 'meat' },
  'burrito':        { searchTags: ['mexican', 'grill'],                   fallbackType: 'meat' },
  'fast food':      { searchTags: ['fast-food', 'burger', 'falafel'] },
  'street food':    { searchTags: ['street-food', 'falafel', 'shawarma'] },
  'takeaway':       { searchTags: ['takeaway', 'deli'] },
  'take away':      { searchTags: ['takeaway', 'deli'] },
  'takeout':        { searchTags: ['takeaway', 'deli'] },

  // ── Bakery Hebrew (query terms, not just name patterns) ───────────────────
  'מאפייה':    { searchTags: ['bakery', 'cafe'],                  fallbackType: 'dairy' },
  'מאפיה':     { searchTags: ['bakery', 'cafe'],                  fallbackType: 'dairy' },
  'מאפיית':    { searchTags: ['bakery', 'cafe'],                  fallbackType: 'dairy' },

  // ── Missing food terms ────────────────────────────────────────────────────
  'קציצות':    { searchTags: ['grill', 'burger', 'fast-food'],    fallbackType: 'meat' },
  'קציצה':     { searchTags: ['grill', 'burger', 'fast-food'],    fallbackType: 'meat' },
  'פריקסה':    { searchTags: ['sandwich', 'street-food'],         fallbackType: 'pareve' },
  'בגט':       { searchTags: ['sandwich', 'bakery', 'cafe'],      fallbackType: 'dairy' },
  'יין':       { searchTags: ['deli', 'italian', 'cafe'],         fallbackType: 'dairy' },
  'wine':      { searchTags: ['deli', 'italian', 'cafe'],         fallbackType: 'dairy' },
};

/**
 * Regex rules for one-time tag seeding from restaurant name + category.
 * Each entry: [pattern, tag].
 */
export const NAME_TO_TAG: [RegExp, string][] = [
  [/burger|hamburger|המבורגר|המברגר|בורגר/i, 'burger'],
  [/pizza|פיצה|pizzeria/i,                   'pizza'],
  [/sushi|סושי/i,                             'sushi'],
  [/shawarma|שווארמה|שוארמה/i,               'shawarma'],
  [/\bgrill\b|steakhouse|מנגל/i,             'grill'],
  [/\bsteak\b|סטייק/i,                       'steak'],
  [/\bcaf[eé]\b|coffee|קפה/i,                'cafe'],
  [/bakery|bakehouse|מאפה|מאפייה|מאפיה/i,    'bakery'],
  [/bagel|בייגל|בייגלס/i,                    'bagel'],
  [/breakfast|brunch|ארוחת בוקר|בראנץ/i,     'breakfast'],
  [/deli|delicatessen|מעדניה/i,              'deli'],
  [/sandwich|כריך|כריכים|סנדוויץ|סנדוויצ/i,  'sandwich'],
  [/dessert|sweets?|pastr(?:y|ies)|patisserie|קינוח|קינוחים|מתוקים|פטיסרי/i, 'dessert'],
  [/\bpasta\b|italian|פסטה|איטלקי/i,         'pasta'],
  [/falafel|פלאפל/i,                          'falafel'],
  [/hummus|חומוס/i,                           'hummus'],
  [/\bchicken\b|schnitzel|שניצל/i,            'chicken'],
  [/\bfish\b|seafood|salmon|tuna|דגים|סלמון|טונה/i, 'fish'],
  [/asian|chinese|thai|japanese|יפני|סיני|תאילנדי/i, 'asian'],
  [/noodle|noodles|ramen|נודלס|ראמן|מוקפץ/i, 'noodles'],
  [/mexican|taco|burrito|מקסיקני|טאקו/i,     'mexican'],
  [/\bsoup\b|(^|[\s"'״׳,.-])מרק($|[\s"'״׳,.-])/i, 'soup'],
  [/\bbbq\b|barbecue/i,                       'grill'],
  [/\bkebab\b|קבב/i,                          'grill'],
  [/vegan|טבעוני/i,                           'vegan'],
  [/salad|סלט/i,                              'salad'],
  [/ice.?cream|gelato|גלידה/i,                'ice-cream'],
  [/fast.?food/i,                             'fast-food'],
  [/street.?food|מזון רחוב/i,                 'street-food'],
  [/take.?away|takeout|טייק אווי|משלוחים/i,   'takeaway'],
  [/healthy|בריא/i,                           'healthy'],
  // ── Bakery / confectionery ────────────────────────────────────────────────
  [/קונדיטורי|מגדני|patisserie|confiser/i,    'bakery'],
  [/קונדיטורי|מגדני|דונא|donut|doughnut|סופגני/i, 'dessert'],
  [/donut|doughnut|דונא|סופגני|בורקס/i,       'bakery'],
  [/עוג(?:ה|ות|יו)|cake|cupcake|cheesecake/i, 'bakery'],
  [/עוג(?:ה|ות|יו)|cake|cupcake|מקרון|macaron|אקלר|פרלינ|שוקולד|chocolate/i, 'dessert'],
  [/לחם|לחמי|boulangerie|bread/i,             'bakery'],
  // ── Cafe / coffee ─────────────────────────────────────────────────────────
  [/espresso|cappuccino|אספרסו|קפואינו|בית קפה/i, 'cafe'],
  [/espresso|cappuccino|אספרסו|coffee/i,      'coffee'],
  // ── Ice cream / sweet treats ──────────────────────────────────────────────
  [/gelateria|גלידרי|frozen.?yogurt|יוגורט/i, 'ice-cream'],
  [/waffle|וופל|crepe|קרפ|פנקייק|pancake/i,   'dessert'],
  // ── Breakfast ─────────────────────────────────────────────────────────────
  [/shakshuka|שקשוק|פנקייק|pancake/i,         'breakfast'],
  // ── Grill / meat ──────────────────────────────────────────────────────────
  [/על האש|פרגי|שיפוד|asado|אסאדו|כבב|skewers?/i, 'grill'],
  [/asado|אסאדו/i,                             'steak'],
  [/פרגי|chicken|schnitzel|שניצל|חזה עוף/i,    'chicken'],
  [/נקני|hot.?dog|sausage|נקניקי/i,           'fast-food'],
  // ── Fast food / street ────────────────────────────────────────────────────
  [/chips|fries|צ.?יפס/i,                      'fast-food'],
  // ── Asian ─────────────────────────────────────────────────────────────────
  [/\bwok\b|ווק|dim.?sum|דים.?סם|dumpling|korean|קוריאני|pad.?thai/i, 'asian'],
  [/\bwok\b|ווק|\bpho\b|פאד.?תאי|pad.?thai/i, 'noodles'],
  // ── Mexican ───────────────────────────────────────────────────────────────
  [/tortilla|טורטיה|burrito|בוריטו|quesadilla|nachos|נאצ.?וס/i, 'mexican'],
  // ── Healthy / juice ───────────────────────────────────────────────────────
  [/juice|smoothie|מיץ|שייק|ג.?וס|organic|אורגני/i, 'healthy'],
];

/**
 * Look up a food relation for a user keyword.
 * Tries exact match first, then partial containment.
 */
export function lookupFoodRelation(keyword: string): FoodRelation | undefined {
  const kw = keyword.toLowerCase().trim();
  if (FOOD_RELATIONS[kw]) return FOOD_RELATIONS[kw];
  // partial: any dict key contained in keyword, or keyword contained in key
  for (const [key, rel] of Object.entries(FOOD_RELATIONS)) {
    const k = key.toLowerCase();
    if (kw.includes(k) || k.includes(kw)) return rel;
  }
  return undefined;
}
