import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  AlertTriangle, ArrowLeft, ChevronRight, Clock, Info, MapPin,
  Navigation, Search, Sparkles, Utensils, X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import client, { logApiError } from '@/src/api/client';
import { C } from '@/constants/theme';
import ErrorState from '@/src/components/ErrorState';
import { RestaurantCardSkeleton } from '@/src/components/Skeleton';

interface Restaurant {
  id: number;
  name: string;
  restaurantType: string | null;
  kashrutLevel: string;
  address?: string;
  originalAddress?: string;
  openingHours?: string;
  distanceMeters?: number;
  destinationCity?: string;
  verificationStatus?: string;
  googleRating?: number | string | null;
  googleRatingCount?: number | null;
  googleMapsUri?: string | null;
  photoUrl?: string | null;
}

// ── Design tokens (muted modern palette) ──────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  meat:    C.typeMeat,
  dairy:   C.typeDairy,
  parve:   C.typeParve,
  pareve:  C.typeParve,
  unknown: '#9CA3AF',
};
const TYPE_BG: Record<string, string> = {
  meat:    C.typeMeatBg,
  dairy:   C.typeDairyBg,
  parve:   C.typeParveBg,
  pareve:  C.typeParveBg,
  unknown: '#F4F4F5',
};
const TYPE_LABEL: Record<string, string> = {
  meat: 'בשרי', dairy: 'חלבי', parve: 'פרווה', pareve: 'פרווה', unknown: 'כשר',
};
const KASHRUT: Record<string, { label: string; color: string; bg: string }> = {
  rabbinate: { label: 'רבנות', color: C.kashrutNeutral, bg: C.kashrutNeutralBg },
  mehadrin:  { label: 'מהדרין', color: C.kashrutGold,    bg: C.kashrutGoldBg },
  badatz:    { label: 'בד"ץ',  color: C.kashrutGold,    bg: C.kashrutGoldBg },
  unknown:   { label: 'כשר',   color: '#9CA3AF',        bg: '#F9FAFB' },
};

const TYPE_FILTERS    = ['all', 'meat', 'dairy', 'parve'];
const KASHRUT_FILTERS = ['all', 'rabbinate', 'mehadrin', 'badatz'];

const fmt = (m: number) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
const cap = (s: string | null | undefined) => s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown';
const firstParam = (value: string | string[] | undefined): string => Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

export default function RestaurantsScreen() {
  const params = useLocalSearchParams<{
    destinationId: string | string[];
    city?: string | string[];
    type?: string | string[];
    kashrut?: string | string[];
    fromParent?: string | string[];
    q?: string | string[];
    lat?: string | string[];
    lng?: string | string[];
  }>();
  const destinationId = firstParam(params.destinationId);
  const city = firstParam(params.city);
  const typeParam = firstParam(params.type);
  const kashrutParam = firstParam(params.kashrut);
  const fromParent = firstParam(params.fromParent);
  const qParam = firstParam(params.q);
  const latParam = firstParam(params.lat);
  const lngParam = firstParam(params.lng);
  const isCountryMode = fromParent === 'true';
  const { t } = useTranslation();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [total, setTotal]             = useState(0);
  const [offset, setOffset]           = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [typeFilter, setTypeFilter]       = useState(typeParam && TYPE_FILTERS.includes(typeParam) ? typeParam : 'all');
  const [kashrutFilter, setKashrutFilter] = useState(kashrutParam && KASHRUT_FILTERS.includes(kashrutParam) ? kashrutParam : 'all');
  const [search, setSearch] = useState(qParam ?? '');
  const [trigger, setTrigger] = useState(0);
  const [aiMode] = useState(true);
  const [aiMeta, setAiMeta] = useState<{ matchTier: number; message: string | null } | null>(null);
  const [lastAiQuery, setLastAiQuery] = useState('');
  // GPS: initialise from URL params (passed by home screen) so the first search already has coordinates.
  // The async location request below may later update to a more accurate value.
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(
    latParam && lngParam ? { lat: parseFloat(latParam), lng: parseFloat(lngParam) } : null,
  );
  const [aiChip, setAiChip]           = useState<{ category: string; emoji: string } | null>(null);
  const timeoutRef    = useRef<any>(null);
  const chipRef       = useRef<any>(null);
  const initialSearch = useRef(true);
  const prevGpsRef    = useRef<{ lat: number; lng: number } | null>(null);
  const cityLabel = city ? decodeURIComponent(city) : '';

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    })();
  }, []);

  // In AI mode with text, search is triggered explicitly via doAiSearch (not auto-debounce).
  // Exception 1: the very first load (qParam on mount) still runs to show initial results.
  // Exception 2: when GPS first becomes available after the initial (GPS-less) search,
  //   re-run so results are sorted by distance and distances are shown.
  useEffect(() => {
    const isFirst = initialSearch.current;
    if (isFirst) initialSearch.current = false;

    const gpsJustArrived = !isFirst && gps != null && prevGpsRef.current == null;
    prevGpsRef.current = gps;

    if (aiMode && search.trim() && !isFirst && !gpsJustArrived) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        setError(false);
        setErrorMessage(undefined);
        setLoading(true); setOffset(0);
        const params: Record<string, string> = isCountryMode
          ? { parentDestinationId: destinationId, offset: '0' }
          : { destinationId, offset: '0' };
        if (gps?.lat) { params.lat = String(gps.lat); params.lng = String(gps.lng); }

        let endpoint = '/restaurants';
        // Smart search runs only for a single city. A country (parent) has no numeric
        // destinationId, and /restaurants/search requires one (ParseIntPipe → 400).
        // In country mode we fall through to the plain list with type/kashrut filters.
        if (search.trim() && !isCountryMode) {
          endpoint = '/restaurants/search';
          params.q = search.trim();
          setLastAiQuery(search.trim());
          const res = await client.get(endpoint, { params });
          const { data: aiData, matchTier, message, total: aiTotal } = res.data;
          setRestaurants(Array.isArray(aiData) ? aiData : []);
          setAiMeta({ matchTier, message });
          setTotal(aiTotal ?? 0);
        } else {
          setAiMeta(null);
          if (typeFilter    && typeFilter    !== 'all') params.type    = typeFilter;
          if (kashrutFilter && kashrutFilter !== 'all') params.kashrut = kashrutFilter;
          const res = await client.get(endpoint, { params });
          const { data, total: t } = res.data;
          setRestaurants(Array.isArray(data) ? data : []);
          setTotal(t ?? 0);
        }
      } catch (err) {
        const info = logApiError('restaurants.load', err);
        setErrorMessage(info.userMessage);
        setError(true);
      } finally { setLoading(false); setRefreshing(false); }
    }, 300);
    // Don't cancel the initial timeout on cleanup — GPS arriving would wipe it
    return () => { if (!isFirst && timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [typeFilter, kashrutFilter, search, aiMode, gps, destinationId, trigger]);

  const onSearchChange = (v: string) => {
    setSearch(v);
    if (!aiMode) return;
    setAiChip(null);
    if (chipRef.current) clearTimeout(chipRef.current);
    if (!v.trim()) return;
    chipRef.current = setTimeout(async () => {
      try {
        const r = await client.get('/search/classify', { params: { text: v.trim() } });
        if (r.data.category) setAiChip(r.data);
      } catch {}
    }, 400);
  };

  const doAiSearch = async () => {
    const q = search.trim();
    if (!q) return;
    setAiChip(null);
    try {
      setError(false);
      setErrorMessage(undefined);
      setLoading(true);
      const body: any = { text: q };
      if (gps) { body.lat = gps.lat; body.lng = gps.lng; }
      const res = await client.post('/search', body);
      const { route, detectedCity, error } = res.data;

      // Navigate if: different category (synagogues etc.) OR same category but different city
      if (!error && route) {
        const isRestaurantRoute = route.includes('/restaurants/');
        const routeDestId = route.match(/\/restaurants\/(\d+)/)?.[1];
        const differentDest = routeDestId && routeDestId !== destinationId;

        if (!isRestaurantRoute || differentDest) {
          const sep = route.includes('?') ? '&' : '?';
          const cityPart = detectedCity ? `city=${encodeURIComponent(detectedCity)}&` : '';
          const shouldPassGps = route.includes('useUserGps=true');
          const gpsPart  = shouldPassGps && gps ? `&lat=${gps.lat}&lng=${gps.lng}` : '';
          router.push(`${route}${sep}${cityPart}q=${encodeURIComponent(q)}${gpsPart}` as any);
          return;
        }
      }

      // Same city or no city detected -> search within current destination.
      const params: Record<string, string> = isCountryMode
        ? { parentDestinationId: destinationId, offset: '0' }
        : { destinationId, offset: '0' };

      // Country mode: /restaurants/search needs a numeric destinationId (which a
      // country doesn't have) → use the plain country list with type/kashrut filters.
      if (isCountryMode) {
        setAiMeta(null);
        if (typeFilter    && typeFilter    !== 'all') params.type    = typeFilter;
        if (kashrutFilter && kashrutFilter !== 'all') params.kashrut = kashrutFilter;
        const res = await client.get('/restaurants', { params });
        const { data, total: t } = res.data;
        setRestaurants(Array.isArray(data) ? data : []);
        setTotal(t ?? 0);
        return;
      }

      if (gps?.lat) { params.lat = String(gps.lat); params.lng = String(gps.lng); }
      params.q = q;
      setLastAiQuery(q);
      const searchRes = await client.get('/restaurants/search', { params });
      const { data: aiData, matchTier, message, total: aiTotal } = searchRes.data;
      setRestaurants(Array.isArray(aiData) ? aiData : []);
      setAiMeta({ matchTier, message });
      setTotal(aiTotal ?? 0);
      setOffset(0);
    } catch (err) {
      const info = logApiError('restaurants.aiSearch', err);
      setErrorMessage(info.userMessage);
      setError(true);
    } finally { setLoading(false); }
  };

  const loadMore = async () => {
    if (loadingMore || search.trim()) return;
    const nextOffset = offset + 50;
    try {
      setLoadingMore(true);
      const params: Record<string, string> = isCountryMode
        ? { parentDestinationId: destinationId, offset: String(nextOffset) }
        : { destinationId, offset: String(nextOffset) };
      if (gps?.lat) { params.lat = String(gps.lat); params.lng = String(gps.lng); }
      if (typeFilter    !== 'all') params.type    = typeFilter;
      if (kashrutFilter !== 'all') params.kashrut = kashrutFilter;
      const res = await client.get('/restaurants', { params });
      // Offset pages can overlap (distance-sort ties / filter change mid-scroll)
      // — dedupe by id so FlatList keys stay unique.
      const page: Restaurant[] = Array.isArray(res.data.data) ? res.data.data : [];
      setRestaurants(p => {
        const seen = new Set(p.map(x => x.id));
        return [...p, ...page.filter(x => !seen.has(x.id))];
      });
      setOffset(nextOffset);
    } catch (err) {
      logApiError('restaurants.loadMore', err);
    } finally { setLoadingMore(false); }
  };

  const sendAiFeedback = (item: Restaurant) => {
    if (!lastAiQuery) return;
    client
      .post('/restaurants/search/feedback', {
        query: lastAiQuery,
        clickedRestaurantName: item.name,
        clickedRestaurantType: item.restaurantType,
        clickedRestaurantKashrut: item.kashrutLevel,
      })
      .catch(() => {});
  };

  const openDetail = (item: Restaurant) => {
    sendAiFeedback(item);
    router.push({
      pathname: `/restaurant/${item.id}` as any,
      params: {
        distance: item.distanceMeters ?? '',
        name: item.name,
        restaurantType: item.restaurantType ?? '',
        kashrutLevel: item.kashrutLevel ?? '',
        address: item.address ?? '',
        openingHours: item.openingHours ?? '',
      },
    });
  };

  const count = total || restaurants.length;

  return (
    <View style={s.root}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={20} color={C.navy} strokeWidth={2.5} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerEyebrow}>{t('nearby.restaurants')}</Text>
            <Text style={s.headerTitle} numberOfLines={1}>
              {cityLabel ? cityLabel : 'Restaurants'}
            </Text>
            <Text style={s.headerSub}>
              {loading ? t('restaurants.loading') : `${count} ${t('restaurants.title')}${gps ? `  ·  ${t('restaurants.sortedByDist')}` : ''}`}
            </Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={[s.searchBar, aiMode && s.searchBarAi]}>
          {aiMode
            ? <Sparkles size={16} color={C.gold} strokeWidth={2} />
            : <Search size={16} color={C.textMuted} strokeWidth={2} />
          }
          <TextInput
            style={s.searchInput}
            placeholder={aiMode ? 'מה תרצה לאכול? באיזו עיר?' : 'Search restaurants…'}
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={onSearchChange}
            onSubmitEditing={aiMode ? doAiSearch : undefined}
            returnKeyType={aiMode ? 'search' : 'done'}
          />
          {search.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setSearch('')}>
              <X size={15} color={C.textMuted} strokeWidth={2} />
            </Pressable>
          )}
          <View style={s.searchDivider} />
          <View style={[s.aiPill, s.aiPillOn]}>
            <Text style={[s.aiPillText, { color: C.navy }]}>AI</Text>
          </View>
        </View>
      </View>

      {/* AI mode chip hint + search button */}
      {aiMode && (aiChip || search.trim()) && (
        <View style={s.aiBar}>
          {aiChip && (
            <View style={s.chipHint}>
              <Sparkles size={12} color={C.gold} strokeWidth={2} />
              <Text style={s.chipHintText}>{aiChip.emoji} {aiChip.category}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Pressable style={s.searchBtn} onPress={doAiSearch}>
            <Search size={14} color="#fff" strokeWidth={2.5} />
            <Text style={s.searchBtnText}>חפש</Text>
          </Pressable>
        </View>
      )}

      {/* AI result quality banner */}
      {aiMeta?.message && (
        <View style={[s.metaBanner, aiMeta.matchTier >= 3 ? s.metaBannerWarn : s.metaBannerInfo]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {aiMeta.matchTier >= 3
              ? <AlertTriangle size={14} color="#92400E" strokeWidth={2} />
              : <Info size={14} color="#1e40af" strokeWidth={2} />
            }
            <Text style={s.metaBannerText}>{aiMeta.message}</Text>
          </View>
        </View>
      )}

      {/* ── Filters ── */}
      {!search.trim() && (
        <View style={s.filtersWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {TYPE_FILTERS.map(f => (
              <Pressable key={f} style={[s.chip, typeFilter === f && s.chipOn]} onPress={() => setTypeFilter(f)}>
                <Text style={[s.chipText, typeFilter === f && s.chipTextOn]}>
                  {f === 'all' ? t('restaurants.allTypes') : t(`restaurants.${f === 'parve' ? 'pareve' : f}`)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {KASHRUT_FILTERS.map(f => (
              <Pressable key={f} style={[s.chip, kashrutFilter === f && s.chipOn]} onPress={() => setKashrutFilter(f)}>
                <Text style={[s.chipText, kashrutFilter === f && s.chipTextOn]}>
                  {f === 'all' ? t('restaurants.allKashrut') : t(`restaurants.${f}`)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── List ── */}
      {loading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[0,1,2,3,4].map(i => <RestaurantCardSkeleton key={i} />)}
        </View>
      ) : error ? (
        <ErrorState message={errorMessage} onRetry={() => { setError(false); setErrorMessage(undefined); setTrigger(t => t + 1); }} />
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setError(false); setErrorMessage(undefined); setTrigger(t => t + 1); }} tintColor={C.gold} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={C.gold} style={{ margin: 20 }} /> : null}
          renderItem={({ item }) => <RestaurantCard item={item} onPress={() => openDetail(item)} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Utensils size={36} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={s.emptyText}>{t('restaurants.noResults')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Restaurant card ───────────────────────────────────────────────────────────
function RestaurantCard({ item, onPress }: { item: Restaurant; onPress: () => void }) {
  const typeColor = TYPE_COLOR[item.restaurantType ?? 'unknown'] ?? TYPE_COLOR.unknown;
  const typeLabel = TYPE_LABEL[item.restaurantType ?? 'unknown'] ?? 'Kosher';
  const kashrut   = KASHRUT[item.kashrutLevel] ?? KASHRUT.unknown;
  const isVerified = item.verificationStatus === 'verified';
  const rating = item.googleRating != null ? Number(item.googleRating) : null;
  const hasGoogleRating = isVerified && rating != null && Number.isFinite(rating);

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={onPress}
    >
      <View style={s.cardBody}>
        <View style={s.cardTop}>
          {item.photoUrl ? (
            <Image source={{ uri: item.photoUrl }} style={s.thumbnail} contentFit="cover" transition={180} />
          ) : (
            <View style={[s.typeIcon, { backgroundColor: TYPE_BG[item.restaurantType ?? 'unknown'] ?? TYPE_BG.unknown }]}>
              <Utensils size={16} color={typeColor} strokeWidth={2} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
            <View style={s.typeLabelRow}>
              <View style={[s.typeDot, { backgroundColor: typeColor }]} />
              <Text style={[s.cardType, { color: typeColor }]}>{typeLabel}</Text>
            </View>
            {hasGoogleRating && (
              <View style={s.ratingRow}>
                <Text style={s.ratingStar}>★</Text>
                <Text style={s.ratingScore}>{rating!.toFixed(1)}</Text>
                <Text style={s.ratingCount}>
                  {item.googleRatingCount ? `(${item.googleRatingCount} · Google)` : '(Google)'}
                </Text>
              </View>
            )}
          </View>
          <View style={[s.kashrutBadge, { backgroundColor: kashrut.bg }]}>
            <Text style={[s.kashrutText, { color: kashrut.color }]}>{kashrut.label}</Text>
          </View>
        </View>

        <View style={s.cardMeta}>
          {item.address && (
            <View style={s.metaRow}>
              <MapPin size={12} color="#9CA3AF" strokeWidth={2} />
              <Text style={s.metaText} numberOfLines={1}>{item.address}</Text>
            </View>
          )}
          {item.openingHours && (
            <View style={s.metaRow}>
              <Clock size={12} color="#9CA3AF" strokeWidth={2} />
              <Text style={s.metaText} numberOfLines={1}>{item.openingHours}</Text>
            </View>
          )}
          {item.destinationCity && (
            <View style={s.metaRow}>
              <Navigation size={12} color="#9CA3AF" strokeWidth={2} />
              <Text style={s.metaText}>{item.destinationCity}</Text>
            </View>
          )}
        </View>

        <View style={s.cardBottom}>
          {item.distanceMeters !== undefined && (
            <View style={s.distPill}>
              <Navigation size={10} color={C.gold} strokeWidth={2.5} />
              <Text style={s.distText}>{fmt(Number(item.distanceMeters))}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <ChevronRight size={16} color="#E5E7EB" strokeWidth={2.5} />
        </View>
      </View>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  header: {
    backgroundColor: C.cream,
    paddingTop: Platform.OS === 'ios' ? 58 : 38,
    paddingHorizontal: 20, paddingBottom: 18,
    gap: 16,
  },
  headerRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.card,
    shadowColor: C.cardShadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  headerEyebrow: {
    fontSize: 10,
    fontFamily: 'Inter-Bold', fontWeight: '700',
    color: C.goldEyebrow,
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 28, fontFamily: 'Inter-Black', fontWeight: '900', color: C.navy, letterSpacing: -0.6 },
  headerSub:   { fontSize: 13, color: C.textMuted, marginTop: 3, fontFamily: 'Inter-Medium', fontWeight: '500' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#ECE7DE',
    shadowColor: C.cardShadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchBarAi: { borderColor: C.goldBorder, backgroundColor: C.card },
  searchInput: { flex: 1, fontSize: 14, color: C.textPrimary, padding: 0 },
  searchDivider: { width: 1, height: 16, backgroundColor: '#EEE9E0' },
  aiPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: C.goldFaint,
  },
  aiPillOn:   { backgroundColor: C.gold },
  aiPillText: { fontSize: 11, fontFamily: 'Inter-ExtraBold', fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  aiBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.07)',
    paddingHorizontal: 16, paddingVertical: 8, gap: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)',
  },
  chipHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.goldFaint, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipHintText: { fontSize: 12, fontFamily: 'Inter-Bold', fontWeight: '700', color: C.gold },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.navy, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  searchBtnText: { fontSize: 13, fontFamily: 'Inter-Bold', fontWeight: '700', color: '#fff' },

  metaBanner:     { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  metaBannerInfo: { backgroundColor: '#e8f4fd', borderBottomColor: '#bee3f8' },
  metaBannerWarn: { backgroundColor: '#fff8e1', borderBottomColor: '#ffe082' },
  metaBannerText: { fontSize: 13, color: '#555' },

  filtersWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0EDE6' },
  filterRow:   { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#ECE7DE', backgroundColor: '#fff',
  },
  chipOn:     { borderColor: C.navy, backgroundColor: C.navy },
  chipText:   { fontSize: 13, fontFamily: 'Inter-SemiBold', fontWeight: '600', color: C.textSecondary },
  chipTextOn: { color: '#fff' },

  list: { padding: 16, gap: 10, paddingBottom: 40 },

  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
    shadowColor: C.cardShadow, shadowOpacity: 0.06, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
    borderWidth: 1,
    borderColor: '#F3EFE7',
  },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  cardBody:    { flex: 1, padding: 14, gap: 10 },

  cardTop:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  thumbnail: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#EEF2F6' },
  cardName: { fontSize: 16, fontFamily: 'Inter-Bold', fontWeight: '700', color: C.navy, letterSpacing: -0.1 },
  typeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  typeDot: { width: 7, height: 7, borderRadius: 4 },
  cardType: { fontSize: 12, fontFamily: 'Inter-SemiBold', fontWeight: '600', marginTop: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  ratingStar: { fontSize: 12.5, color: C.gold, fontFamily: 'Inter-Bold', fontWeight: '700' },
  ratingScore: { fontSize: 12.5, color: C.navy, fontFamily: 'Inter-Bold', fontWeight: '700' },
  ratingCount: { fontSize: 12, color: C.textMuted },
  kashrutBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  kashrutText:  { fontSize: 11, fontFamily: 'Inter-Bold', fontWeight: '700' },

  cardMeta:   { gap: 5 },
  metaRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText:   { fontSize: 12, color: '#9CA3AF', flex: 1 },

  cardBottom: { flexDirection: 'row', alignItems: 'center' },
  distPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(201,168,76,0.10)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
  },
  distText: { fontSize: 11, fontFamily: 'Inter-Bold', fontWeight: '700', color: C.gold },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, color: '#BBC3D4' },
});
