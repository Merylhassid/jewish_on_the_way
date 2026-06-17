import { SearchParserSource } from './search-feedback.entity';

export type SearchCategory =
  | 'restaurant'
  | 'synagogue'
  | 'minyan'
  | 'hosting'
  | 'destination'
  | 'unknown';

export type RestaurantType = 'meat' | 'dairy' | 'pareve';
export type KashrutLevel = 'rabbinate' | 'mehadrin' | 'badatz';
export type PriceLevel = 'cheap' | 'moderate' | 'expensive';
export type Denomination = 'ashkenaz' | 'sfarad' | 'chabad' | 'teimanim';
export type HostingMealOrStay = 'meal' | 'stay' | 'either';

export interface ParsedQuery {
  category: SearchCategory;
  categoryConfidence: number;
  destinationText: string | null;
  explicitDestination: boolean;
  useCurrentLocation: boolean;
  queryText: string | null;
  restaurant: {
    dish: string | null;
    cuisine: string | null;
    type: RestaurantType | null;
    kashrut: KashrutLevel | null;
    priceLevel: PriceLevel | null;
  };
  synagogue: {
    denomination: Denomination | null;
  };
  hosting: {
    shabbat: boolean | null;
    mealOrStay: HostingMealOrStay | null;
  };
}

export interface QueryParserResult {
  parsed: ParsedQuery;
  source: SearchParserSource;
  modelName: string;
  latencyMs: number;
}

export function emptyParsedQuery(): ParsedQuery {
  return {
    category: 'unknown',
    categoryConfidence: 0,
    destinationText: null,
    explicitDestination: false,
    useCurrentLocation: false,
    queryText: null,
    restaurant: {
      dish: null,
      cuisine: null,
      type: null,
      kashrut: null,
      priceLevel: null,
    },
    synagogue: {
      denomination: null,
    },
    hosting: {
      shabbat: null,
      mealOrStay: null,
    },
  };
}
