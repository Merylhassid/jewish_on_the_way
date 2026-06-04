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
import {
  ArrowLeft, ChevronRight, Clock, MapPin,
  Navigation, Search, Sparkles, Utensils, X,
} from 'lucide-react-native';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

interface Restaurant {
  id: number;
  name: string;
  restaurantType: string | null;
  kashrutLevel: string;
  address?: string;
  openingHours?: string;
  distanceMeters?: number;
  destinationCity?: string;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = {
  meat:    '#DC2626',
  dairy:   '#2563EB',
  parve:   '#059669',
  pareve:  '#059669',
  unknown: '#9CA3AF',
};
const TYPE_LABEL: Record<string, string> = {
  meat: 'Meat', dairy: 'Dairy', parve: 'Pareve', pareve: 'Pareve', unknown: 'Kosher',
};
const KASHRUT: Record<string, { label: string; color: string; bg: string }> = {
  rabbinate: { label: 'Rabbinate', color: '#6B7280', bg: '#F3F4F6' },
  mehadrin:  { label: 'Mehadrin',  color: '#2563EB', bg: '#EFF6FF' },
  badatz:    { label: 'Badatz',    color: '#059669', bg: '#F0FDF4' },
  unknown:   { label: 'Kosher',    color: '#9CA3AF', bg: '#F9FAFB' },
};

const TYPE_FILTERS    = ['all', 'meat', 'dairy', 'parve'];
const KASHRUT_FILTERS = ['all', 'rabbinate', 'mehadrin', 'badatz'];

const fmt = (m: number) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
const cap = (s: string | null | undefined) => s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown';

export default function RestaurantsScreen() {
  const { destinationId, city, type: typeParam, kashrut: kashrutParam, fromParent } =
    useLocalSearchParams<{ destinationId: string; city?: string; type?: string; kashrut?: string; fromParent?: string }>();
  const isCountryMode = fromParent === 'true';

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [total, setTotal]             = useState(0);
  const [offset, setOffset]           = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [typeFilter, setTypeFilter]   = useState(typeParam && TYPE_FILTERS.includes(typeParam) ? typeParam : 'all');
  const [kFilter, setKFilter]         = useState(kashrutParam && KASHRUT_FILTERS.includes(kashrutParam) ? kashrutParam : 'all');
  const [search, setSearch]           = useState('');
  const [aiMode, setAiMode]           = useState(false);
  const [lastAiQuery, setLastAiQuery] = useState('');
  const [gps, setGps]                 = useState<{ lat: number; lng: number } | null>(null);
  const timeoutRef = useRef<any>(null);
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

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true); setOffset(0);
        const params: Record<string, string> = isCountryMode
          ? { parentDestinationId: destinationId, offset: '0' }
          : { destinationId, offset: '0' };
        if (gps?.lat) { params.lat = String(gps.lat); params.lng = String(gps.lng); }

        if (aiMode && search.trim()) {
          params.q = search.trim();
          setLastAiQuery(search.trim());
          const res = await client.get('/restaurants/search', { params });
          setRestaurants(Array.isArray(res.data) ? res.data : []);
          setTotal(0);
        } else {
          if (typeFilter !== 'all') params.type = typeFilter;
          if (kFilter !== 'all')    params.kashrut = kFilter;
          if (search)               params.q = search;
          const res = await client.get('/restaurants', { params });
          const { data, total: t } = res.data;
          setRestaurants(Array.isArray(data) ? data : []);
          setTotal(t ?? 0);
        }
      } catch {} finally { setLoading(false); setRefreshing(false); }
    }, 300);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [typeFilter, kFilter, search, aiMode, gps, destinationId]);

  const loadMore = async () => {
    if (loadingMore || aiMode) return;
    const next = offset + 50;
    try {
      setLoadingMore(true);
      const params: Record<string, string> = isCountryMode
        ? { parentDestinationId: destinationId, offset: String(next) }
        : { destinationId, offset: String(next) };
      if (gps?.lat) { params.lat = String(gps.lat); params.lng = String(gps.lng); }
      if (typeFilter !== 'all') params.type = typeFilter;
      if (kFilter !== 'all')    params.kashrut = kFilter;
      if (search)               params.q = search;
      const res = await client.get('/restaurants', { params });
      setRestaurants(p => [...p, ...(Array.isArray(res.data.data) ? res.data.data : [])]);
      setOffset(next);
    } catch {} finally { setLoadingMore(false); }
  };

  const sendFeedback = (item: Restaurant) => {
    if (!aiMode || !lastAiQuery) return;
    client.post('/restaurants/search/feedback', {
      query: lastAiQuery,
      clickedRestaurantName: item.name,
      clickedRestaurantType: item.restaurantType,
      clickedRestaurantKashrut: item.kashrutLevel,
    }).catch(() => {});
  };

  const openDetail = (item: Restaurant) => {
    sendFeedback(item);
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
            <ArrowLeft size={20} color="#fff" strokeWidth={2.5} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>
              {cityLabel ? cityLabel : 'Restaurants'}
            </Text>
            <Text style={s.headerSub}>
              {loading ? 'Loading…' : `${count} kosher restaurant${count !== 1 ? 's' : ''}${gps ? '  ·  sorted by distance' : ''}`}
            </Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={[s.searchBar, aiMode && s.searchBarAi]}>
          {aiMode
            ? <Sparkles size={16} color={C.gold} strokeWidth={2} />
            : <Search size={16} color="rgba(255,255,255,0.5)" strokeWidth={2} />
          }
          <TextInput
            style={s.searchInput}
            placeholder={aiMode ? '"Badatz steak" or "dairy near me"…' : 'Search restaurants…'}
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable hitSlop={8} onPress={() => setSearch('')}>
              <X size={15} color="rgba(255,255,255,0.5)" strokeWidth={2} />
            </Pressable>
          )}
          <View style={s.searchDivider} />
          <Pressable style={[s.aiPill, aiMode && s.aiPillOn]} onPress={() => { setAiMode(v => !v); setSearch(''); }}>
            <Sparkles size={12} color={aiMode ? C.navy : '#fff'} strokeWidth={2} />
            <Text style={[s.aiPillText, aiMode && { color: C.navy }]}>AI</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Filters ── */}
      {!aiMode && (
        <View style={s.filtersWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {TYPE_FILTERS.map(f => (
              <Pressable key={f} style={[s.chip, typeFilter === f && s.chipOn]} onPress={() => setTypeFilter(f)}>
                <Text style={[s.chipText, typeFilter === f && s.chipTextOn]}>
                  {f === 'all' ? 'All types' : cap(f)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {KASHRUT_FILTERS.map(f => (
              <Pressable key={f} style={[s.chip, kFilter === f && s.chipOn]} onPress={() => setKFilter(f)}>
                <Text style={[s.chipText, kFilter === f && s.chipTextOn]}>
                  {f === 'all' ? 'All kashrut' : cap(f)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── List ── */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); }} tintColor={C.gold} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={C.gold} style={{ margin: 20 }} /> : null}
          renderItem={({ item }) => <RestaurantCard item={item} onPress={() => openDetail(item)} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Utensils size={36} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={s.emptyText}>No restaurants found</Text>
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

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      onPress={onPress}
    >
      {/* Left accent */}
      <View style={[s.cardAccent, { backgroundColor: typeColor }]} />

      <View style={s.cardBody}>
        {/* Top row */}
        <View style={s.cardTop}>
          <View style={[s.typeIcon, { backgroundColor: typeColor + '15' }]}>
            <Utensils size={16} color={typeColor} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
            <Text style={[s.cardType, { color: typeColor }]}>{typeLabel}</Text>
          </View>
          <View style={[s.kashrutBadge, { backgroundColor: kashrut.bg }]}>
            <Text style={[s.kashrutText, { color: kashrut.color }]}>{kashrut.label}</Text>
          </View>
        </View>

        {/* Meta */}
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

        {/* Distance + arrow */}
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
  root:   { flex: 1, backgroundColor: '#F7F5F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  // Header
  header: {
    backgroundColor: C.navy,
    paddingTop: Platform.OS === 'ios' ? 58 : 38,
    paddingHorizontal: 20, paddingBottom: 16,
    gap: 14,
  },
  headerRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontWeight: '500' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  searchBarAi: { borderColor: C.gold + '60', backgroundColor: 'rgba(201,168,76,0.08)' },
  searchInput: { flex: 1, fontSize: 14, color: '#fff', padding: 0 },
  searchDivider: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.15)' },
  aiPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  aiPillOn: { backgroundColor: C.gold },
  aiPillText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  // Filters
  filtersWrap: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0EDE6' },
  filterRow:   { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff',
  },
  chipOn:      { borderColor: C.navy, backgroundColor: C.navy },
  chipText:    { fontSize: 13, fontWeight: '600', color: C.textSecondary },
  chipTextOn:  { color: '#fff' },

  // List
  list: { padding: 16, gap: 10, paddingBottom: 40 },

  // Card
  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  cardAccent:  { width: 4 },
  cardBody:    { flex: 1, padding: 14, gap: 10 },

  cardTop:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.1 },
  cardType: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  kashrutBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  kashrutText:  { fontSize: 11, fontWeight: '700' },

  cardMeta: { gap: 5 },
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: '#9CA3AF', flex: 1 },

  cardBottom: { flexDirection: 'row', alignItems: 'center' },
  distPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(201,168,76,0.10)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4,
  },
  distText: { fontSize: 11, fontWeight: '700', color: C.gold },

  // Empty
  empty:     { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, color: '#BBC3D4' },
});
