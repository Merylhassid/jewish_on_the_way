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

// ── Destination landmark images ───────────────────────────────────────────────
// Curated by city name (lowercase). Unsplash CDN — free, no API key needed.
// Fallback: picsum.photos with city seed (always resolves, random beautiful photo).

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;

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
  'ko samui':       U('1506905925346-21bda4d32df4'), // tropical beach palm trees
  'koh samui':      U('1506905925346-21bda4d32df4'), // same photo, alt spelling
  'chiang mai':     U('1528181304800-259b08848526'), // Doi Suthep temple lanterns
  pattaya:          U('1559592413-7cbb3606b9af'),    // Pattaya bay / city lights
};

// Generic country fallback by country_code
const COUNTRY_FALLBACK: Record<string, string> = {
  IL: U('1544967082-d9d25d867d66'),  // Jerusalem
  FR: U('1499856845926-5d5b0ddd4c46'), // Eiffel Tower
  AE: U('1512453979798-5ea266f8880c'), // Dubai
  GB: U('1513635269975-59663e0ac1ad'), // London
  IT: U('1552832230-c0197dd311b5'),   // Rome
  ES: U('1539037116277-4db20889f2d4'), // Barcelona
  MA: U('1553603227-2358aabe821e'),   // Marrakech
  PT: U('1555881400-74d7acaacd8b'),   // Porto
  CZ: U('1541849546-216549ae216d'),   // Prague
  IE: U('1564959130747-897fb406b9af'), // Dublin
  CY: U('1516189994732-8f85f1e72b11'), // Cyprus
  US: U('1485739240762-91b0b37e2fd2'), // New York / USA
  TH: U('1528360983277-13d401cdc186'), // Thailand temples
};

export function getDestinationImageUrl(city: string, countryCode: string): string {
  const key = city.toLowerCase().trim();
  if (LANDMARK[key]) return LANDMARK[key];
  if (COUNTRY_FALLBACK[countryCode]) return COUNTRY_FALLBACK[countryCode];
  // Ultimate fallback: picsum.photos with seed — always resolves
  return `https://picsum.photos/seed/${encodeURIComponent(key)}/900/500`;
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
