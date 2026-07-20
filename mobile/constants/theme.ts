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

  // ── Restaurant / dish type — muted modern palette (new design) ───────────────
  typeMeat:    '#B4544A',  typeMeatBg:  '#F7EEEC',
  typeDairy:   '#5B7C99',  typeDairyBg: '#EEF2F6',
  typeParve:   '#6B8E6B',  typeParveBg: '#EEF3EE',

  // ── Kashrut accents (new design) ─────────────────────────────────────────────
  kashrutNeutral:   '#6B7280',  kashrutNeutralBg: '#F4F4F5',
  kashrutGold:      '#9A7B22',  kashrutGoldBg:    '#FBF6E9',

  // ── Eyebrow / muted gold for light headers ───────────────────────────────────
  goldEyebrow:   '#A8882A',

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
  GR: require('../assets/images/countries/greece.jpg'),
  RO: require('../assets/images/countries/romania.jpg'),
  GE: require('../assets/images/countries/georgia.jpg'),
};

// ── Local city images (user-supplied, highest priority for specific cities) ──
const LOCAL_CITY_IMAGES: Record<string, any> = {
  miami: require('../assets/images/destinations/miami.jpg'),
  greece: require('../assets/images/countries/greece.jpg'),
  athens: require('../assets/images/destinations/athens.jpg'),
  romania: require('../assets/images/countries/romania.jpg'),
  bucharest: require('../assets/images/destinations/bucharest.jpg'),
  georgia: require('../assets/images/countries/georgia.jpg'),
  tbilisi: require('../assets/images/destinations/tbilisi.jpg'),
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

// ── Per-city images (Wikipedia/Wikimedia, curated 2026-07) ───────────────────
// Indexed by `city.toLowerCase()`. Country destinations keep their country
// photo (their `city` field equals the country name, so no key here matches).
const CITY_IMAGES: Record<string, string> = {
  // ── Israel ──
  "afula": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Afula_IMG_0889.JPG/1280px-Afula_IMG_0889.JPG',
  "akko": 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Acre_-_Akko_6_-_the_fishing_port_%286658890981%29.jpg/1280px-Acre_-_Akko_6_-_the_fishing_port_%286658890981%29.jpg',
  "ariel": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Ariel085.jpg/1280px-Ariel085.jpg',
  "ashdod": 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/%D7%A4%D7%90%D7%A8%D7%A7_%D7%95%D7%90%D7%92%D7%9D_%D7%94%D7%9E%D7%A8%D7%99%D7%A0%D7%94_%D7%9C%D7%A7%D7%A8%D7%90%D7%AA_%D7%A1%D7%95%D7%A3_%D7%A2%D7%91%D7%95%D7%93%D7%95%D7%AA_%D7%94%D7%91%D7%A0%D7%99%D7%99%D7%94%2C_%D7%9E%D7%A8%D7%A5_2024.jpg_03.jpg/1280px-%D7%A4%D7%90%D7%A8%D7%A7_%D7%95%D7%90%D7%92%D7%9D_%D7%94%D7%9E%D7%A8%D7%99%D7%A0%D7%94_%D7%9C%D7%A7%D7%A8%D7%90%D7%AA_%D7%A1%D7%95%D7%A3_%D7%A2%D7%91%D7%95%D7%93%D7%95%D7%AA_%D7%94%D7%91%D7%A0%D7%99%D7%99%D7%94%2C_%D7%9E%D7%A8%D7%A5_2024.jpg_03.jpg',
  "ashkelon": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/93439_marina_ashkelon_PikiWiki_Israel.jpg/1280px-93439_marina_ashkelon_PikiWiki_Israel.jpg',
  "bat yam": 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/City_Park_Bat_Yam_05.jpg/1280px-City_Park_Bat_Yam_05.jpg',
  "be'er sheva": 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Beersheba_City_Hall_6.jpg/1280px-Beersheba_City_Hall_6.jpg',
  "be'er yaakov": 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/PikiWiki_Israel_9327_square_in_beer_yaakov.jpg/1280px-PikiWiki_Israel_9327_square_in_beer_yaakov.jpg',
  "beit she'an": 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Beit_shean.jpg/1280px-Beit_shean.jpg',
  "beit shemesh": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/%D7%92%D7%91%D7%A2%D7%AA_%D7%94%D7%AA%D7%95%D7%A8%D7%9E%D7%95%D7%A1%D7%99%D7%9D_03.jpg/1280px-%D7%92%D7%91%D7%A2%D7%AA_%D7%94%D7%AA%D7%95%D7%A8%D7%9E%D7%95%D7%A1%D7%99%D7%9D_03.jpg',
  "binyamina": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Israel_Railway_Benyamina_23-06-2017b.jpg/1280px-Israel_Railway_Benyamina_23-06-2017b.jpg',
  "bnei brak": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/BBC_and_Nahalat_Ganim_01.jpg/1280px-BBC_and_Nahalat_Ganim_01.jpg',
  "caesarea": 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/%D7%A7%D7%99%D7%A1%D7%A8%D7%99%D7%94_%D7%94%D7%A2%D7%AA%D7%99%D7%A7%D7%94.jpg/1280px-%D7%A7%D7%99%D7%A1%D7%A8%D7%99%D7%94_%D7%94%D7%A2%D7%AA%D7%99%D7%A7%D7%94.jpg',
  "dimona": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Dimona_Aerial_View.jpg/1280px-Dimona_Aerial_View.jpg',
  "eilat": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Eilat_night_hotels_2016.jpg/1280px-Eilat_night_hotels_2016.jpg',
  "gan yavne": 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Gan-yavne_local_council_3.jpg',
  "gedera": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/View_of_Gedera_from_Tel_Qatra.jpg/1280px-View_of_Gedera_from_Tel_Qatra.jpg',
  "givat shmuel": 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/PikiWiki_Israel_8994_Cities_in_Israel.jpg/1280px-PikiWiki_Israel_8994_Cities_in_Israel.jpg',
  "givatayim": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Givatayim_City_02.jpg/1280px-Givatayim_City_02.jpg',
  "hadera": 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/WikiAir_IL-13-10_A031.jpg/1280px-WikiAir_IL-13-10_A031.jpg',
  "haifa": 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/The_Hanging_Gardens_of_Haifa%2C_Israel_%2850099173503%29_%28cropped%29.jpg/1280px-The_Hanging_Gardens_of_Haifa%2C_Israel_%2850099173503%29_%28cropped%29.jpg',
  "herzliya": 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/%D7%A6%D7%99%D7%9C%D7%95%D7%9D_%D7%9E%D7%94%D7%90%D7%95%D7%99%D7%A8_%D7%A9%D7%9C_%D7%94%D7%A8%D7%A6%D7%9C%D7%99%D7%94_23.jpg/1280px-%D7%A6%D7%99%D7%9C%D7%95%D7%9D_%D7%9E%D7%94%D7%90%D7%95%D7%99%D7%A8_%D7%A9%D7%9C_%D7%94%D7%A8%D7%A6%D7%9C%D7%99%D7%94_23.jpg',
  "hod hasharon": 'https://upload.wikimedia.org/wikipedia/commons/8/85/4seasonspark.JPG',
  "holon": 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/94765_holon_from_the_drone_PikiWiki_Israel.jpg/1280px-94765_holon_from_the_drone_PikiWiki_Israel.jpg',
  "jerusalem": 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Dome_of_the_Rock_seen_from_the_Mount_of_Olives_%2812395649153%29_%28cropped%29.jpg/1280px-Dome_of_the_Rock_seen_from_the_Mount_of_Olives_%2812395649153%29_%28cropped%29.jpg',
  "karmiel": 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Karmiel_-_Israel_2008.jpg/1280px-Karmiel_-_Israel_2008.jpg',
  "katzrin": 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Katzrinlibrary.jpg/1280px-Katzrinlibrary.jpg',
  "kfar saba": 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/PikiWiki_Israel_61144_kfar_saba_at_night.jpg/1280px-PikiWiki_Israel_61144_kfar_saba_at_night.jpg',
  "kiryat ata": 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Kiryat_ata.jpg/1280px-Kiryat_ata.jpg',
  "kiryat bialik": 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/PikiWiki_Israel_13470_Dutch_Jewry_Savers_Square_Kiryat_Bialik.jpg/1280px-PikiWiki_Israel_13470_Dutch_Jewry_Savers_Square_Kiryat_Bialik.jpg',
  "kiryat gat": 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/PikiWiki_Israel_16194_kiryat_gat.jpg/1280px-PikiWiki_Israel_16194_kiryat_gat.jpg',
  "kiryat motzkin": 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/PikiWiki_Israel_13473_Mozart_Junction_in_Kiryat_Motzkin.jpg/1280px-PikiWiki_Israel_13473_Mozart_Junction_in_Kiryat_Motzkin.jpg',
  "kiryat ono": 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/PikiWiki_Israel_42549_Kiryat_Ono_municipality.JPG/1280px-PikiWiki_Israel_42549_Kiryat_Ono_municipality.JPG',
  "kiryat shmona": 'https://upload.wikimedia.org/wikipedia/commons/4/46/Qiryat_Shemona_2007.JPG',
  "lod": 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/LodJune132022_01.jpg/1280px-LodJune132022_01.jpg',
  "ma'ale adumim": 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Maaleadumim_009.jpg/1280px-Maaleadumim_009.jpg',
  "mazkeret batya": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/%D7%91%D7%99%D7%AA_%D7%9E%D7%A9%D7%A7_%D7%94%D7%91%D7%A8%D7%95%D7%9F_%D7%9E%D7%96%D7%9B%D7%A8%D7%AA_%D7%91%D7%AA%D7%99%D7%94.jpg/1280px-%D7%91%D7%99%D7%AA_%D7%9E%D7%A9%D7%A7_%D7%94%D7%91%D7%A8%D7%95%D7%9F_%D7%9E%D7%96%D7%9B%D7%A8%D7%AA_%D7%91%D7%AA%D7%99%D7%94.jpg',
  "migdal haemek": 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/PikiWiki_Israel_35108_Entrance_circle_to_Migdal_Haemek.JPG/1280px-PikiWiki_Israel_35108_Entrance_circle_to_Migdal_Haemek.JPG',
  "modiin": 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/93658_central_modi%27in_PikiWiki_Israel.jpg/1280px-93658_central_modi%27in_PikiWiki_Israel.jpg',
  "nahariya": 'https://upload.wikimedia.org/wikipedia/commons/d/db/Nahariya_-_Port.jpg',
  "nesher": 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Nesher%2C_Givat_Nesher%2C_Tel_Hanan_009.JPG/1280px-Nesher%2C_Givat_Nesher%2C_Tel_Hanan_009.JPG',
  "ness ziona": 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Ness_Ziona_Aerial_View.jpg/1280px-Ness_Ziona_Aerial_View.jpg',
  "netanya": 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/20201130_153836_%D7%9E%D7%91%D7%98_%D7%9E%D7%9C%D7%9E%D7%A2%D7%9C%D7%94_%D7%A2%D7%9C_%D7%A9%D7%9C%D7%95%D7%9C%D7%99%D7%AA_%D7%94%D7%97%D7%95%D7%A8%D7%A3_%D7%91%D7%A0%D7%AA%D7%A0%D7%99%D7%94.jpg/1280px-20201130_153836_%D7%9E%D7%91%D7%98_%D7%9E%D7%9C%D7%9E%D7%A2%D7%9C%D7%94_%D7%A2%D7%9C_%D7%A9%D7%9C%D7%95%D7%9C%D7%99%D7%AA_%D7%94%D7%97%D7%95%D7%A8%D7%A3_%D7%91%D7%A0%D7%AA%D7%A0%D7%99%D7%94.jpg',
  "netivot": 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/PikiWiki_Israel_44401_Aerial_photo_of_Netivot.jpg/1280px-PikiWiki_Israel_44401_Aerial_photo_of_Netivot.jpg',
  "ofakim": 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Ofaqim_4.jpg/1280px-Ofaqim_4.jpg',
  "or yehuda": 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/IsraelOrYehuda_FromAir.JPG/1280px-IsraelOrYehuda_FromAir.JPG',
  "pardes hanna": 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/WikiAir_Flight_IL-13-09_070.jpg/1280px-WikiAir_Flight_IL-13-09_070.jpg',
  "petah tikva": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Jabotinsky_Skyline_Petah_Tikva_01.jpg/1280px-Jabotinsky_Skyline_Petah_Tikva_01.jpg',
  "ra'anana": 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Raanana_city.JPG/1280px-Raanana_city.JPG',
  "ramat gan": 'https://upload.wikimedia.org/wikipedia/commons/d/de/Ramat_Gan_City_Images.png',
  "ramat hasharon": 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Canada_Stadium_Israel_2008_4.jpg/1280px-Canada_Stadium_Israel_2008_4.jpg',
  "ramla": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/%D7%9B%D7%A0%D7%A1%D7%99%D7%99%D7%AA_%D7%98%D7%A8%D7%94_%D7%A1%D7%A0%D7%98%D7%94_%D7%91%D7%9E%D7%91%D7%98_%D7%9E%D7%94%D7%9E%D7%92%D7%93%D7%9C_%D7%94%D7%9C%D7%91%D7%9F_-_%D7%9E%D7%A9%D7%9E%D7%90%D7%9C_%D7%A7%D7%A8%D7%99%D7%99%D7%AA_%D7%94%D7%9E%D7%9E%D7%A9%D7%9C%D7%94%2C_%D7%9E%D7%99%D7%9E%D7%99%D7%9F_%D7%94%D7%9E%D7%A1%D7%92%D7%93_%D7%94%D7%9C%D7%91%D7%9F_%D7%95%D7%91%D7%A8%D7%A7%D7%A2_%D7%94%D7%A2%D7%99%D7%A8_%D7%9E%D7%95%D7%93%D7%99%D7%A2%D7%99%D7%9F.JPG/1280px-thumbnail.jpg',
  "rehovot": 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Rehovot_Aerial_View.jpg/1280px-Rehovot_Aerial_View.jpg',
  "rishon lezion": 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Rishon-LeZion-Gan-Moshava-0002.jpg/1280px-Rishon-LeZion-Gan-Moshava-0002.jpg',
  "rosh haayin": 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/RoshHaAyinDec052022_08.jpg/1280px-RoshHaAyinDec052022_08.jpg',
  "rosh pina": 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/PikiWiki_Israel_17512_Cities_in_Israel.JPG/1280px-PikiWiki_Israel_17512_Cities_in_Israel.JPG',
  "savion": 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Entrance_to_Savyon.JPG/1280px-Entrance_to_Savyon.JPG',
  "sderot": 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/PikiWiki_Israel_40924_Yanchik_Hill_near_kibbutz_Nir_Am.JPG/1280px-PikiWiki_Israel_40924_Yanchik_Hill_near_kibbutz_Nir_Am.JPG',
  "shoham": 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/IsraelShoham_FromAir.JPG/1280px-IsraelShoham_FromAir.JPG',
  "tel aviv": 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Sarona_CBD_01_%28cropped%29.jpg/1280px-Sarona_CBD_01_%28cropped%29.jpg',
  "tel mond": 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Tel_Mond_enterance.jpg/1280px-Tel_Mond_enterance.jpg',
  "tiberias": 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/92250_tiberias_PikiWiki_Israel.jpg/1280px-92250_tiberias_PikiWiki_Israel.jpg',
  "tzfat": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Safed1.jpg/1280px-Safed1.jpg',
  "yavne": 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Yavne_panoramic_view2.JPG/1280px-Yavne_panoramic_view2.JPG',
  "yehud": 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Entrance_sign_to_Yehud%2C_January_2024_03.jpg/1280px-Entrance_sign_to_Yehud%2C_January_2024_03.jpg',
  "yokneam": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Elias-Pano2.jpg/1280px-Elias-Pano2.jpg',
  "zichron yaakov": 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/PikiWiki_Israel_73640_glider_photo_of_zichron_yaacov.jpg/1280px-PikiWiki_Israel_73640_glider_photo_of_zichron_yaacov.jpg',
  // ── Thailand ──
  "bangkok": 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/4Y1A1159_Bangkok_%2833536795515%29.jpg/1280px-4Y1A1159_Bangkok_%2833536795515%29.jpg',
  "chiang mai": 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/0020-%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B8%9E%E0%B8%A3%E0%B8%B0%E0%B8%AA%E0%B8%B4%E0%B8%87%E0%B8%AB%E0%B9%8C%E0%B8%A7%E0%B8%A3%E0%B8%A1%E0%B8%AB%E0%B8%B2%E0%B8%A7%E0%B8%B4%E0%B8%AB%E0%B8%B2%E0%B8%A3.jpg/1280px-0020-%E0%B8%A7%E0%B8%B1%E0%B8%94%E0%B8%9E%E0%B8%A3%E0%B8%B0%E0%B8%AA%E0%B8%B4%E0%B8%87%E0%B8%AB%E0%B9%8C%E0%B8%A7%E0%B8%A3%E0%B8%A1%E0%B8%AB%E0%B8%B2%E0%B8%A7%E0%B8%B4%E0%B8%AB%E0%B8%B2%E0%B8%A3.jpg',
  "ko samui": 'https://upload.wikimedia.org/wikipedia/commons/8/80/Koh_Samui_Lipa_Noi2.jpg',
  "koh phangan": 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Koh_Phangan01.jpg',
  "pai": 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/View_of_Pai_3.jpg/1280px-View_of_Pai_3.jpg',
  "phuket": 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Phuket_City.jpg/1280px-Phuket_City.jpg',
  // ── United States ──
  "chicago": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Chicago_River_ferry_b.jpg/1280px-Chicago_River_ferry_b.jpg',
  "dallas": 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/View_of_Dallas_from_Reunion_Tower_August_2015_05.jpg/1280px-View_of_Dallas_from_Reunion_Tower_August_2015_05.jpg',
  "las vegas": 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Las_Vegas_from_above_%2840064746644%29.jpg/1280px-Las_Vegas_from_above_%2840064746644%29.jpg',
  "los angeles": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Hollywood_Sign_%28Zuschnitt%29.jpg/1280px-Hollywood_Sign_%28Zuschnitt%29.jpg',
  "miami": 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Villa_Vizcaya_20110228.jpg/1280px-Villa_Vizcaya_20110228.jpg',
  "new york": 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu_%28cropped%29.jpg/1280px-View_of_Empire_State_Building_from_Rockefeller_Center_New_York_City_dllu_%28cropped%29.jpg',
  // ── Cyprus ──
  "larnaca": 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Larnaca_01-2017_img27_Finikoudes.jpg/1280px-Larnaca_01-2017_img27_Finikoudes.jpg',
  "limassol": 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Skyscrapers_in_Limassol.jpg/1280px-Skyscrapers_in_Limassol.jpg',
  "paphos": 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Paphos_Marine%2C_Cyprus_-_panoramio.jpg/1280px-Paphos_Marine%2C_Cyprus_-_panoramio.jpg',
  // ── France ──
  "cannes": 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Cannes_from_Suquet_Tower_03.jpg/1280px-Cannes_from_Suquet_Tower_03.jpg',
  "nice": 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Promenade_des_Anglais_Nice_IMG_1255.jpg/1280px-Promenade_des_Anglais_Nice_IMG_1255.jpg',
  "paris": 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/La_Tour_Eiffel_vue_de_la_Tour_Saint-Jacques%2C_Paris_ao%C3%BBt_2014_%282%29.jpg/1280px-La_Tour_Eiffel_vue_de_la_Tour_Saint-Jacques%2C_Paris_ao%C3%BBt_2014_%282%29.jpg',
  // ── Argentina ──
  "buenos aires": 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Avenida_9_de_Julio%2C_Buenos_Aires_%2840089810910%29.jpg/1280px-Avenida_9_de_Julio%2C_Buenos_Aires_%2840089810910%29.jpg',
  // ── Austria ──
  "vienna": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Schoenbrunn_philharmoniker_2012.jpg/1280px-Schoenbrunn_philharmoniker_2012.jpg',
  // ── Canada ──
  "montreal": 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Montreal%2C_Quebec_skyline.jpg/1280px-Montreal%2C_Quebec_skyline.jpg',
  // ── Czech Republic ──
  "prague": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Prague_%286365119737%29.jpg/1280px-Prague_%286365119737%29.jpg',
  // ── Germany ──
  "berlin": 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Museumsinsel_Berlin_Juli_2021_1_%28cropped%29_b.jpg/1280px-Museumsinsel_Berlin_Juli_2021_1_%28cropped%29_b.jpg',
  // ── Hungary ──
  "budapest": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/View_from_Gell%C3%A9rt_Hill_to_the_Danube%2C_Hungary_-_Budapest_%2828493220635%29.jpg/1280px-View_from_Gell%C3%A9rt_Hill_to_the_Danube%2C_Hungary_-_Budapest_%2828493220635%29.jpg',
  // ── Ireland ──
  "dublin": 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Dublin_-_aerial_-_2025-07-07_01.jpg/1280px-Dublin_-_aerial_-_2025-07-07_01.jpg',
  // ── Italy ──
  "rome": 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Trevi_Fountain%2C_Rome%2C_Italy_2_-_May_2007.jpg/1280px-Trevi_Fountain%2C_Rome%2C_Italy_2_-_May_2007.jpg',
  // ── Morocco ──
  "marrakech": 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Pavillon_Menarag%C3%A4rten.jpg',
  // ── Netherlands ──
  "amsterdam": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Imagen_de_los_canales_conc%C3%A9ntricos_en_%C3%81msterdam.png/1280px-Imagen_de_los_canales_conc%C3%A9ntricos_en_%C3%81msterdam.png',
  // ── Portugal ──
  "porto": 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Puente_Don_Luis_I%2C_Oporto%2C_Portugal%2C_2012-05-09%2C_DD_13.JPG/1280px-Puente_Don_Luis_I%2C_Oporto%2C_Portugal%2C_2012-05-09%2C_DD_13.JPG',
  // ── Spain ──
  "barcelona": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Evening_light_over_Barcelona.jpg/1280px-Evening_light_over_Barcelona.jpg',
  // ── UAE ──
  "dubai": 'https://upload.wikimedia.org/wikipedia/en/thumb/c/c7/Burj_Khalifa_2021.jpg/1280px-Burj_Khalifa_2021.jpg',
  // ── United Kingdom ──
  "london": 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/London_Skyline_%28125508655%29.jpeg/1280px-London_Skyline_%28125508655%29.jpeg',
};

// Returns an expo-image compatible source:
// - local require() → number (for LOCAL_COUNTRY_IMAGES)
// - remote URL      → { uri: string }
export function getDestinationImageUrl(city: string, countryCode: string): any {
  const cc = (countryCode ?? '').toUpperCase();
  const key = (city ?? '').toLowerCase().trim();
  // 0. User-supplied city photo — must win over all remote city/country photos.
  if (key && LOCAL_CITY_IMAGES[key]) return LOCAL_CITY_IMAGES[key];
  // 1. City-specific photo — must win over the country photo so every city
  //    in a country list gets its own image
  if (key && CITY_IMAGES[key]) return { uri: CITY_IMAGES[key] };
  // 2. User-supplied local country photo — require() returns a number
  if (cc && LOCAL_COUNTRY_IMAGES[cc]) return LOCAL_COUNTRY_IMAGES[cc];
  // 3. City-level landmark (URL string)
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
