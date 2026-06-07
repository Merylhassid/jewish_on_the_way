import { Platform } from 'react-native';

// ── Luxury design tokens ──────────────────────────────────────────────────────

export const C = {
  // ── Brand ───────────────────────────────────────────────────────────────────
  navy:          '#0B1736',
  navyDeep:      '#060E24',
  navyLight:     '#1A2D5A',

  gold:          '#D4AF37',
  goldBright:    '#E8C84A',
  goldMuted:     '#A8882A',
  goldFaint:     'rgba(212,175,55,0.10)',
  goldBorder:    'rgba(212,175,55,0.25)',

  // ── Backgrounds ─────────────────────────────────────────────────────────────
  bg:            '#FAF8F3',
  cream:         '#FAF8F3',
  card:          '#FFFFFF',
  surface:       '#F7F5F0',

  // ── Text ────────────────────────────────────────────────────────────────────
  textPrimary:   '#111827',
  textSecondary: '#6B7280',
  textMuted:     '#9CA3AF',
  textLight:     '#D1D5DB',
  onDark:        '#FFFFFF',
  onDarkMuted:   'rgba(255,255,255,0.60)',
  onDarkSub:     'rgba(255,255,255,0.35)',

  // ── Semantic ─────────────────────────────────────────────────────────────────
  success:       '#22C55E',
  error:         '#EF4444',
  warning:       '#F59E0B',

  // ── Aliases (backwards compat) ───────────────────────────────────────────────
  midnight:      '#060E24',
  navyDeepAlias: '#060E24',
  creamDark:     '#EEE9E0',
  cardShadow:    '#0B1736',
};

// ── Local country images (user-supplied, highest priority) ───────────────────
// Add a require() here + drop the file in assets/images/countries/
// Each entry must be a static require — React Native bundler resolves at build time.
const LOCAL_COUNTRY_IMAGES: Record<string, any> = {
  IL: require('../assets/images/countries/israel.webp'),
  FR: require('../assets/images/countries/france.jpg'),
  DE: require('../assets/images/countries/allemagne.jpg'),
  AR: require('../assets/images/countries/argentine.jpg'),
  AT: require('../assets/images/countries/autriche.webp'),
  CA: require('../assets/images/countries/canada.jpg'),
  CY: require('../assets/images/countries/chypre.jpg'),
  US: require('../assets/images/countries/etats unis.jpg'),
  HU: require('../assets/images/countries/hongrie.jpg'),
  NL: require('../assets/images/countries/pays bas.avif'),
};

// Hero carousel — cycles through these images on the home screen
export const HERO_IMAGES: any[] = [
  require('../assets/images/countries/israel.webp'),
  require('../assets/images/countries/france.jpg'),
  require('../assets/images/countries/chypre.jpg'),
  require('../assets/images/countries/hongrie.jpg'),
  require('../assets/images/countries/pays bas.avif'),
  require('../assets/images/countries/canada.jpg'),
  require('../assets/images/countries/allemagne.jpg'),
  require('../assets/images/countries/argentine.jpg'),
  require('../assets/images/countries/autriche.webp'),
  require('../assets/images/countries/etats unis.jpg'),
];

// ── Destination landmark images ───────────────────────────────────────────────
// Curated by city name (lowercase). Unsplash CDN — free, no API key needed.
// Fallback: picsum.photos with city seed (always resolves, random beautiful photo).

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;

// Deterministic picsum — always resolves, consistent per seed
const P = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/900/500`;

// Specific landmark overrides — indexed by `city.toLowerCase()`
const LANDMARK: Record<string, string> = {
  // ── France ──────────────────────────────────────────────────────────────────
  paris:          U('1499856845926-5d5b0ddd4c46'), // Eiffel Tower at night
  nice:           U('1471922694854-ff1b63b20054'), // Nice Promenade des Anglais
  cannes:         U('1533929736458-ca588d08c8be'), // Cannes Croisette
  lyon:           U('1627308595229-7830a5c91f9f'), // Lyon old town
  marseille:      U('1549924231-f129b911e442'), // Marseille Old Port
  strasbourg:     U('1513635269975-59663e0ac1ad'), // cathedral / old town
  france:         U('1499856845926-5d5b0ddd4c46'), // Eiffel Tower

  // ── UAE ─────────────────────────────────────────────────────────────────────
  dubai:          U('1512453979798-5ea266f8880c'), // Dubai / Burj Khalifa skyline at night
  uae:            U('1512453979798-5ea266f8880c'), // Dubai / Burj Khalifa

  // ── Israel — key cities ──────────────────────────────────────────────────────
  jerusalem:      U('1544967082-d9d25d867d66'), // Dome of the Rock / Old City
  'tel aviv':     U('1549887534-1541e9326642'), // Tel Aviv beach skyline
  haifa:          U('1589241062272-c0a000072dfa'), // Haifa Bahai Gardens
  eilat:          U('1559494007-9d5ef95e8d07'), // Red Sea turquoise water
  tiberias:       U('1527437571-4b5c7c276bd1'), // Sea of Galilee
  safed:          U('1544967082-d9d25d867d66'), // mystical old city
  netanya:        U('1549887534-1541e9326642'), // Mediterranean coast
  'be\'er sheva': U('1509316785289-025f5b846b35'), // Negev desert
  caesarea:       U('1553152531-b98a2756f35c'), // Roman amphitheater ruins
  'rosh hanikra': U('1559494007-9d5ef95e8d07'), // white cliffs + sea
  israel:         U('1544967082-d9d25d867d66'), // Jerusalem Old City

  // ── United Kingdom ───────────────────────────────────────────────────────────
  london:         U('1513635269975-59663e0ac1ad'), // Big Ben / Westminster Bridge
  'united kingdom': U('1513635269975-59663e0ac1ad'),

  // ── Italy ────────────────────────────────────────────────────────────────────
  rome:           U('1552832230-c0197dd311b5'), // Colosseum
  italy:          U('1552832230-c0197dd311b5'),

  // ── Spain ────────────────────────────────────────────────────────────────────
  barcelona:      U('1539037116277-4db20889f2d4'), // Sagrada Familia
  spain:          U('1539037116277-4db20889f2d4'),

  // ── Morocco ──────────────────────────────────────────────────────────────────
  marrakech:      U('1553603227-2358aabe821e'), // Marrakech medina
  morocco:        U('1553603227-2358aabe821e'),

  // ── Portugal ─────────────────────────────────────────────────────────────────
  porto:          U('1555881400-74d7acaacd8b'), // Porto colorful buildings
  portugal:       U('1555881400-74d7acaacd8b'),

  // ── Czech Republic ───────────────────────────────────────────────────────────
  prague:         U('1541849546-216549ae216d'), // Prague Castle at night
  'czech republic': U('1541849546-216549ae216d'),

  // ── Ireland ──────────────────────────────────────────────────────────────────
  dublin:         U('1564959130747-897fb406b9af'), // Dublin city
  ireland:        U('1564959130747-897fb406b9af'),

  // ── Cyprus ───────────────────────────────────────────────────────────────────
  larnaca:        U('1516189994732-8f85f1e72b11'), // Cyprus coast
  limassol:       U('1516189994732-8f85f1e72b11'),
  paphos:         U('1516189994732-8f85f1e72b11'),
  cyprus:         U('1516189994732-8f85f1e72b11'),

  // ── United States ────────────────────────────────────────────────────────────
  'united states':  U('1485739240762-91b0b37e2fd2'), // NYC skyline
  'new york':       U('1485739240762-91b0b37e2fd2'), // Manhattan at night
  miami:            U('1533587851066-d7a86a4b5cdb'), // Miami South Beach
  'los angeles':    U('1534430480872-3498386e7856'), // LA skyline at sunset
  chicago:          U('1477959858617-c2b8d9f7a744'), // Chicago skyline / river
  dallas:           U('1570794524105-4c91e3543eb1'), // Dallas skyline
  'las vegas':      U('1605833556294-3efe3cf4ea71'), // Las Vegas Strip at night

  // ── Thailand ─────────────────────────────────────────────────────────────────
  thailand:         U('1528360983277-13d401cdc186'), // Thai temple / golden stupa
  bangkok:          U('1508009603885-50922f88e43e'), // Grand Palace / Wat Arun
  phuket:           U('1537956965962-9e6e6ef79d44'), // Phuket emerald bay
  'ko samui':       U('1506905925346-21bda4d32df4'),
  'koh samui':      U('1506905925346-21bda4d32df4'),
  'chiang mai':     U('1528181304800-259b08848526'),
  pattaya:          U('1559592413-7cbb3606b9af'),

  // ── Germany ──────────────────────────────────────────────────────────────────
  germany:          U('1467269204165-b72e8f6b2da8'), // Brandenburg Gate
  berlin:           U('1467269204165-b72e8f6b2da8'),
  munich:           U('1573806439049-beae7e2f5e64'), // Marienplatz

  // ── Austria ──────────────────────────────────────────────────────────────────
  austria:          U('1516550405-6b6d9e57b4e0'), // Vienna Schoenbrunn
  vienna:           U('1516550405-6b6d9e57b4e0'),

  // ── Hungary ──────────────────────────────────────────────────────────────────
  hungary:          U('1504503428808-1cf2e8e82dd0'), // Budapest Parliament at night
  budapest:         U('1504503428808-1cf2e8e82dd0'),

  // ── Netherlands ──────────────────────────────────────────────────────────────
  netherlands:      U('1576924542622-772281b13ea0'), // Amsterdam canal houses
  amsterdam:        U('1576924542622-772281b13ea0'),

  // ── Argentina ────────────────────────────────────────────────────────────────
  argentina:        U('1589909736878-1a13a47adb58'), // Buenos Aires
  'buenos aires':   U('1589909736878-1a13a47adb58'),

  // ── Belgium ──────────────────────────────────────────────────────────────────
  belgium:          U('1491557345352-5929e343eb89'), // Brussels Grand Place
  brussels:         U('1491557345352-5929e343eb89'),
  antwerp:          U('1491557345352-5929e343eb89'),

  // ── Switzerland ──────────────────────────────────────────────────────────────
  switzerland:      U('1534438327922-59b73c56eede'), // Swiss Alps / Matterhorn
  zurich:           U('1534438327922-59b73c56eede'),
  geneva:           U('1534438327922-59b73c56eede'),

  // ── Poland ───────────────────────────────────────────────────────────────────
  poland:           U('1540959733332-eab4deabeeaf'), // Krakow old town
  krakow:           U('1540959733332-eab4deabeeaf'),
  warsaw:           U('1540959733332-eab4deabeeaf'),

  // ── Greece ───────────────────────────────────────────────────────────────────
  greece:           U('1555993539-1732b0258a23'), // Athens Acropolis
  athens:           U('1555993539-1732b0258a23'),
  santorini:        U('1533105079-9f4c7d7d6cf6'), // Santorini blue domes
  mykonos:          U('1533105079-9f4c7d7d6cf6'),

  // ── Turkey ───────────────────────────────────────────────────────────────────
  turkey:           U('1524231757912-21f4fe3a7200'), // Istanbul Blue Mosque
  istanbul:         U('1524231757912-21f4fe3a7200'),

  // ── Australia ────────────────────────────────────────────────────────────────
  australia:        U('1506973035872-a4ec16b8e8d9'), // Sydney Opera House
  sydney:           U('1506973035872-a4ec16b8e8d9'),
  melbourne:        U('1523482580672-768d00e0ab4c'), // Melbourne skyline

  // ── Canada ───────────────────────────────────────────────────────────────────
  canada:           U('1517935706615-2717e1765a03'), // Banff / Canadian Rockies
  toronto:          U('1517935706615-2717e1765a03'),
  montreal:         U('1517935706615-2717e1765a03'),

  // ── Singapore ────────────────────────────────────────────────────────────────
  singapore:        U('1518638150340-f706e86654de'), // Marina Bay Sands

  // ── South Africa ─────────────────────────────────────────────────────────────
  'south africa':   U('1580060839134-75a5edca2e99'), // Table Mountain
  'cape town':      U('1580060839134-75a5edca2e99'),
  johannesburg:     U('1580060839134-75a5edca2e99'),

  // ── Brazil ───────────────────────────────────────────────────────────────────
  brazil:           U('1483729600819-4de4a80c5249'), // Christ the Redeemer
  'rio de janeiro': U('1483729600819-4de4a80c5249'),
  'sao paulo':      U('1483729600819-4de4a80c5249'),

  // ── Mexico ───────────────────────────────────────────────────────────────────
  mexico:           U('1518638150340-f706e86654de'), // Chichen Itza
  'mexico city':    U('1518638150340-f706e86654de'),

  // ── Japan ────────────────────────────────────────────────────────────────────
  japan:            U('1542051841857-5f90071e7989'), // Mount Fuji
  tokyo:            U('1542051841857-5f90071e7989'),
  kyoto:            U('1528360983277-13d401cdc186'),

  // ── Russia ───────────────────────────────────────────────────────────────────
  russia:           P('moscow-red-square'),
  moscow:           P('moscow-red-square'),
  'st. petersburg': P('saint-petersburg-russia'),

  // ── Sweden ───────────────────────────────────────────────────────────────────
  sweden:           P('stockholm-sweden'),
  stockholm:        P('stockholm-sweden'),

  // ── Norway ───────────────────────────────────────────────────────────────────
  norway:           P('norway-fjord'),
  oslo:             P('oslo-norway'),

  // ── Denmark ──────────────────────────────────────────────────────────────────
  denmark:          P('copenhagen-denmark'),
  copenhagen:       P('copenhagen-denmark'),

  // ── Finland ──────────────────────────────────────────────────────────────────
  finland:          P('helsinki-finland'),
  helsinki:         P('helsinki-finland'),

  // ── Croatia ──────────────────────────────────────────────────────────────────
  croatia:          P('dubrovnik-croatia'),
  dubrovnik:        P('dubrovnik-croatia'),
  zagreb:           P('zagreb-croatia'),
  split:            P('split-croatia'),

  // ── Serbia ───────────────────────────────────────────────────────────────────
  serbia:           P('belgrade-serbia'),
  belgrade:         P('belgrade-serbia'),

  // ── Romania ──────────────────────────────────────────────────────────────────
  romania:          P('bucharest-romania'),
  bucharest:        P('bucharest-romania'),

  // ── Ukraine ──────────────────────────────────────────────────────────────────
  ukraine:          P('kyiv-ukraine'),
  kyiv:             P('kyiv-ukraine'),
  odessa:           P('kyiv-ukraine'),

  // ── Slovakia ─────────────────────────────────────────────────────────────────
  slovakia:         P('bratislava-slovakia'),
  bratislava:       P('bratislava-slovakia'),

  // ── Bulgaria ─────────────────────────────────────────────────────────────────
  bulgaria:         P('sofia-bulgaria'),
  sofia:            P('sofia-bulgaria'),

  // ── Lithuania ────────────────────────────────────────────────────────────────
  lithuania:        P('vilnius-lithuania'),
  vilnius:          P('vilnius-lithuania'),

  // ── Latvia ───────────────────────────────────────────────────────────────────
  latvia:           P('riga-latvia'),
  riga:             P('riga-latvia'),

  // ── Estonia ──────────────────────────────────────────────────────────────────
  estonia:          P('tallinn-estonia'),
  tallinn:          P('tallinn-estonia'),

  // ── Georgia ──────────────────────────────────────────────────────────────────
  georgia:          P('tbilisi-georgia'),
  tbilisi:          P('tbilisi-georgia'),

  // ── Armenia ──────────────────────────────────────────────────────────────────
  armenia:          P('yerevan-armenia'),
  yerevan:          P('yerevan-armenia'),

  // ── India ────────────────────────────────────────────────────────────────────
  india:            P('taj-mahal-india'),
  mumbai:           P('mumbai-india'),
  delhi:            P('taj-mahal-india'),
  'new delhi':      P('taj-mahal-india'),

  // ── China ────────────────────────────────────────────────────────────────────
  china:            P('great-wall-china'),
  beijing:          P('great-wall-china'),
  shanghai:         P('shanghai-china'),

  // ── South Korea ──────────────────────────────────────────────────────────────
  'south korea':    P('seoul-korea'),
  seoul:            P('seoul-korea'),

  // ── Malaysia ─────────────────────────────────────────────────────────────────
  malaysia:         P('kuala-lumpur-malaysia'),
  'kuala lumpur':   P('kuala-lumpur-malaysia'),

  // ── Indonesia ────────────────────────────────────────────────────────────────
  indonesia:        P('bali-indonesia'),
  bali:             P('bali-indonesia'),

  // ── Philippines ──────────────────────────────────────────────────────────────
  philippines:      P('philippines-island'),
  manila:           P('philippines-island'),

  // ── New Zealand ──────────────────────────────────────────────────────────────
  'new zealand':    P('new-zealand-landscape'),
  auckland:         P('new-zealand-landscape'),

  // ── Colombia ─────────────────────────────────────────────────────────────────
  colombia:         P('cartagena-colombia'),
  cartagena:        P('cartagena-colombia'),
  medellin:         P('medellin-colombia'),

  // ── Chile ────────────────────────────────────────────────────────────────────
  chile:            P('patagonia-chile'),
  santiago:         P('santiago-chile'),

  // ── Peru ─────────────────────────────────────────────────────────────────────
  peru:             P('machu-picchu-peru'),
  lima:             P('lima-peru'),

  // ── Uruguay ──────────────────────────────────────────────────────────────────
  uruguay:          P('montevideo-uruguay'),
  montevideo:       P('montevideo-uruguay'),

  // ── Panama ───────────────────────────────────────────────────────────────────
  panama:           P('panama-city'),
  'panama city':    P('panama-city'),

  // ── Costa Rica ───────────────────────────────────────────────────────────────
  'costa rica':     P('costa-rica-landscape'),
  'san jose':       P('costa-rica-landscape'),

  // ── Ecuador ──────────────────────────────────────────────────────────────────
  ecuador:          P('quito-ecuador'),
  quito:            P('quito-ecuador'),

  // ── Bolivia ──────────────────────────────────────────────────────────────────
  bolivia:          P('la-paz-bolivia'),
  'la paz':         P('la-paz-bolivia'),

  // ── Venezuela ────────────────────────────────────────────────────────────────
  venezuela:        P('caracas-venezuela'),
  caracas:          P('caracas-venezuela'),

  // ── Mexico (fix: was sharing Singapore's photo) ───────────────────────────────
  mexico:           P('mexico-city-landmark'),
  'mexico city':    P('mexico-city-landmark'),
  cancun:           P('cancun-mexico'),

};

// Generic country fallback by country_code
const COUNTRY_FALLBACK: Record<string, string> = {
  IL: P('jerusalem-old-city'),
  FR: P('paris-eiffel-tower'),
  AE: P('dubai-burj-khalifa'),
  GB: P('london-big-ben'),
  IT: P('rome-colosseum'),
  ES: P('barcelona-sagrada-familia'),
  MA: P('marrakech-medina'),
  PT: P('porto-portugal'),
  CZ: P('prague-castle'),
  IE: P('dublin-ireland'),
  CY: P('limassol-cyprus'),
  US: P('new-york-skyline'),
  TH: P('bangkok-temple'),
  DE: P('berlin-brandenburg'),
  AT: P('vienna-schoenbrunn'),
  HU: P('budapest-parliament'),
  NL: P('amsterdam-canals'),
  AR: P('buenos-aires-argentina'),
  BE: P('brussels-grand-place'),
  CH: P('swiss-alps-matterhorn'),
  PL: P('krakow-poland'),
  GR: P('athens-acropolis'),
  TR: P('istanbul-blue-mosque'),
  AU: P('sydney-opera-house'),
  CA: P('banff-canada-rockies'),
  SG: P('singapore-marina-bay'),
  ZA: P('cape-town-table-mountain'),
  BR: P('rio-cristo-redentor'),
  MX: P('mexico-city-landmark'),
  JP: P('mount-fuji-japan'),
  RO: P('bucharest-romania'),
  UA: P('kyiv-ukraine'),

  // ── Europe (additional) ───────────────────────────────────────────────────────
  RU: P('moscow-red-square'),
  SE: P('stockholm-sweden'),
  NO: P('norway-fjord'),
  DK: P('copenhagen-denmark'),
  FI: P('helsinki-finland'),
  HR: P('dubrovnik-croatia'),
  RS: P('belgrade-serbia'),
  SK: P('bratislava-slovakia'),
  BG: P('sofia-bulgaria'),
  LT: P('vilnius-lithuania'),
  LV: P('riga-latvia'),
  EE: P('tallinn-estonia'),
  GE: P('tbilisi-georgia'),
  AM: P('yerevan-armenia'),
  AZ: P('baku-azerbaijan'),
  MD: P('chisinau-moldova'),
  BA: P('sarajevo-bosnia'),
  MK: P('skopje-macedonia'),
  AL: P('tirana-albania'),
  ME: P('budva-montenegro'),
  SI: P('ljubljana-slovenia'),
  LU: P('luxembourg-city'),
  MT: P('valletta-malta'),

  // ── Asia ─────────────────────────────────────────────────────────────────────
  IN: P('taj-mahal-india'),
  CN: P('great-wall-china'),
  KR: P('seoul-korea'),
  MY: P('kuala-lumpur-malaysia'),
  ID: P('bali-indonesia'),
  PH: P('philippines-island'),
  VN: P('halong-bay-vietnam'),
  NP: P('kathmandu-nepal'),

  // ── Oceania ───────────────────────────────────────────────────────────────────
  NZ: P('new-zealand-landscape'),

  // ── Americas ──────────────────────────────────────────────────────────────────
  MX: P('mexico-city-landmark'),
  CO: P('cartagena-colombia'),
  CL: P('patagonia-chile'),
  PE: P('machu-picchu-peru'),
  UY: P('montevideo-uruguay'),
  PA: P('panama-city'),
  CR: P('costa-rica-landscape'),
  EC: P('quito-ecuador'),
  BO: P('la-paz-bolivia'),
  VE: P('caracas-venezuela'),
  PY: P('asuncion-paraguay'),
  GT: P('antigua-guatemala'),
  DO: P('punta-cana-dr'),
  CU: P('havana-cuba'),

  // ── Africa ───────────────────────────────────────────────────────────────────
  EG: P('pyramids-egypt'),
  TN: P('tunis-tunisia'),
  KE: P('nairobi-kenya'),
  ET: P('addis-ababa-ethiopia'),
  GH: P('accra-ghana'),
  NG: P('lagos-nigeria'),
  SN: P('dakar-senegal'),
};

// Returns an expo-image compatible source:
// - local require() → number (for LOCAL_COUNTRY_IMAGES)
// - remote URL      → { uri: string }
export function getDestinationImageUrl(city: string, countryCode: string): any {
  const cc = (countryCode ?? '').toUpperCase();
  // 1. User-supplied local photo (highest priority) — require() returns a number
  if (cc && LOCAL_COUNTRY_IMAGES[cc]) return LOCAL_COUNTRY_IMAGES[cc];
  // 2. City-level landmark (URL string)
  const key = (city ?? '').toLowerCase().trim();
  if (key && LANDMARK[key]) return { uri: LANDMARK[key] };
  // 3. Country-level fallback (URL string)
  if (cc && COUNTRY_FALLBACK[cc]) return { uri: COUNTRY_FALLBACK[cc] };
  // 4. Seeded picsum — always resolves
  return { uri: `https://picsum.photos/seed/${encodeURIComponent(key || 'city')}/900/500` };
}

// ── Legacy Colors ─────────────────────────────────────────────────────────────

export const Colors = {
  light: {
    text:            C.textPrimary,
    background:      C.cream,
    tint:            C.gold,
    icon:            C.textMuted,
    tabIconDefault:  C.textMuted,
    tabIconSelected: C.gold,
  },
  dark: {
    text:            C.onDark,
    background:      C.midnight,
    tint:            C.gold,
    icon:            'rgba(255,255,255,0.45)',
    tabIconDefault:  'rgba(255,255,255,0.35)',
    tabIconSelected: C.gold,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans:    'system-ui',
    serif:   'ui-serif',
    rounded: 'ui-rounded',
    mono:    'ui-monospace',
  },
  default: {
    sans:    'normal',
    serif:   'serif',
    rounded: 'normal',
    mono:    'monospace',
  },
  web: {
    sans:    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif:   "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', sans-serif",
    mono:    'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
});
