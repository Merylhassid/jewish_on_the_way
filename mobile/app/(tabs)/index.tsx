import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bookmark, ChevronRight, Clock, MapPin, Navigation, Search, Sparkles, X } from 'lucide-react-native';
import client from '@/src/api/client';
import { C, getDestinationImageUrl } from '@/constants/theme';

// ── Recent destinations storage ──────────────────────────────────────────────
const RECENT_KEY = 'recent_destinations';

async function addRecentDestination(dest: Destination) {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list: Destination[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(d => d.id !== dest.id);
    filtered.unshift(dest);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, 8)));
  } catch {}
}
async function loadRecentDestinations(): Promise<Destination[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
async function removeRecentDestination(id: number) {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list: Destination[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list.filter(d => d.id !== id)));
  } catch {}
}

interface Destination {
  id: number;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  hasChildren?: boolean;
  distanceMeters?: number;
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  if (km < 1) return `${Math.round(meters)}m`;
  if (km < 100) return `${km.toFixed(1)}km`;
  return `${Math.round(km).toLocaleString()}km`;
}

function navigate(item: Destination) {
  const path = item.hasChildren
    ? `/destination/${item.id}/subdestinations`
    : `/destination/${item.id}`;
  router.push(path as any);
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function DestinationsScreen() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [recentDests, setRecentDests]   = useState<Destination[]>([]);

  // AI search
  const [smartText, setSmartText] = useState('');
  const [smartBusy, setSmartBusy] = useState(false);
  const [aiMode, setAiMode]       = useState(false);
  const [liveChip, setLiveChip]   = useState<{ category: string; emoji: string; denomination: string | null; denomEmoji: string; denomLabel: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // GPS
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsReady, setGpsReady]     = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsReady(true);
      } catch {}
    })();
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const onSmartTextChange = (val: string) => {
    setSmartText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setLiveChip(null); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await client.get('/search/classify', { params: { text: val.trim() } });
        setLiveChip(res.data.category ? res.data : null);
      } catch {}
    }, 400);
  };

  const handleSmartSearch = async () => {
    const text = smartText.trim();
    if (!text) return;
    setLiveChip(null);
    try {
      setSmartBusy(true);
      const body: Record<string, any> = { text };
      if (userCoords) { body.lat = userCoords.lat; body.lng = userCoords.lng; }
      const res = await client.post('/search', body);
      const { route, category, emoji, detectedCity, error: err } = res.data;
      if (err === 'low_confidence') {
        Alert.alert('Not sure what you mean', 'Try writing: "kosher restaurant in Tel Aviv"');
        return;
      }
      if (!detectedCity) {
        Alert.alert(`${emoji} Found: ${category}`, 'No city detected. Try: "kosher restaurant in Tel Aviv"');
        return;
      }
      const cityParam = `${route.includes('?') ? '&' : '?'}city=${encodeURIComponent(detectedCity)}`;
      router.push((route + cityParam) as any);
    } catch {
      Alert.alert('Error', 'Search is unavailable, try again');
    } finally {
      setSmartBusy(false);
    }
  };

  const fetchDestinations = async (q?: string) => {
    try {
      setError(false);
      const params: any = {};
      if (q) params.q = q;
      if (userCoords && !q) { params.lat = userCoords.lat; params.lng = userCoords.lng; }
      const res = await client.get('/destinations', { params });
      setDestinations(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDestinations(search || undefined);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchDestinations();
    loadRecentDestinations().then(setRecentDests);
  }, []);

  const handleDestPress = (item: Destination) => {
    addRecentDestination(item);
    setRecentDests(prev => [item, ...prev.filter(d => d.id !== item.id)].slice(0, 8));
    navigate(item);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const ListHeader = (
    <View>
      {/* ── Recents ── */}
      {recentDests.length > 0 && !search && !aiMode && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>RECENTLY VISITED</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentRow}>
            {recentDests.map(d => (
              <View key={d.id} style={s.recentChip}>
                <Pressable style={s.recentChipInner} onPress={() => { navigate(d); }}>
                  <Clock size={12} color={C.gold} strokeWidth={2.5} />
                  <Text style={s.recentChipText} numberOfLines={1}>{d.city || d.name}</Text>
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    removeRecentDestination(d.id);
                    setRecentDests(prev => prev.filter(r => r.id !== d.id));
                  }}
                >
                  <X size={13} color="#BBC3D4" strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Section label ── */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionLabel}>
          {search ? `RESULTS FOR "${search.toUpperCase()}"` : 'ALL DESTINATIONS'}
        </Text>
        {gpsReady && !search && (
          <View style={s.gpsBadge}>
            <Navigation size={10} color={C.gold} strokeWidth={2.5} />
            <Text style={s.gpsBadgeText}>Near you</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={s.root}>

      {/* ── Sticky top bar ── */}
      <View style={s.topBar}>
        <View style={s.topBarRow}>
          <Text style={s.brand}>Jewish on the Way</Text>
          <Pressable style={s.savedBtn} onPress={() => router.push('/saved' as any)}>
            <Bookmark size={16} color={C.navy} strokeWidth={2} />
          </Pressable>
        </View>
        <Text style={s.heroTitle}>Discover Jewish Life{'\n'}Anywhere in the World</Text>

        {/* Search / AI toggle */}
        <View style={s.searchWrap}>
          {!aiMode ? (
            <View style={s.searchBar}>
              <Search size={17} color="#9CA3AF" strokeWidth={2} />
              <TextInput
                style={s.searchInput}
                placeholder="Search destinations…"
                placeholderTextColor="#BBC3D4"
                value={search}
                onChangeText={text => { setSearch(text); fetchDestinations(text || undefined); }}
                returnKeyType="search"
              />
              {search.length > 0 && (
                <Pressable onPress={() => { setSearch(''); fetchDestinations(); }} hitSlop={8}>
                  <X size={16} color="#BBC3D4" strokeWidth={2} />
                </Pressable>
              )}
              <View style={s.searchDivider} />
              <Pressable style={s.aiToggle} onPress={() => { setSearch(''); setAiMode(true); }}>
                <Sparkles size={16} color={C.gold} strokeWidth={2} />
                <Text style={s.aiToggleText}>AI</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.aiBar}>
              <Sparkles size={17} color={C.gold} strokeWidth={2} />
              <TextInput
                style={s.aiInput}
                placeholder='e.g. "Kosher restaurant in Tel Aviv"'
                placeholderTextColor="#BBC3D4"
                value={smartText}
                onChangeText={onSmartTextChange}
                onSubmitEditing={handleSmartSearch}
                returnKeyType="search"
                autoFocus
              />
              {smartBusy
                ? <ActivityIndicator size="small" color={C.navy} />
                : smartText.trim()
                  ? (
                    <Pressable style={s.aiGoBtn} onPress={handleSmartSearch}>
                      <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
                    </Pressable>
                  )
                  : (
                    <Pressable hitSlop={8} onPress={() => { setAiMode(false); setSmartText(''); setLiveChip(null); }}>
                      <X size={16} color="#BBC3D4" strokeWidth={2} />
                    </Pressable>
                  )
              }
            </View>
          )}
        </View>

        {/* AI live chip */}
        {liveChip && (
          <View style={s.liveChip}>
            <Text style={s.liveChipText}>
              {liveChip.emoji} {liveChip.category}
              {liveChip.denomination ? `  ·  ${liveChip.denomEmoji} ${liveChip.denomLabel}` : ''}
            </Text>
          </View>
        )}
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : error ? (
        <View style={s.center}>
          <MapPin size={40} color="#E5E7EB" strokeWidth={1.5} />
          <Text style={s.errorText}>Could not load destinations</Text>
          <Pressable style={s.retryBtn} onPress={() => { setLoading(true); fetchDestinations(); }}>
            <Text style={s.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={destinations}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
          ListHeaderComponent={ListHeader}
          renderItem={({ item }) => (
            <DestinationCard item={item} onPress={() => handleDestPress(item)} />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <MapPin size={32} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={s.emptyText}>No destinations found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Destination card ──────────────────────────────────────────────────────────
function DestinationCard({ item, onPress }: { item: Destination; onPress: () => void }) {
  const imageUrl = getDestinationImageUrl(item.city, item.countryCode);

  return (
    <Pressable style={({ pressed }) => [s.card, pressed && s.cardPressed]} onPress={onPress}>
      <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={400} />
      {/* gradient */}
      <View style={s.cardGradientTop} />
      <View style={s.cardGradientBottom} />

      {/* country badge */}
      <View style={s.countryBadge}>
        <Text style={s.countryBadgeText}>{item.countryCode}</Text>
      </View>

      {/* text */}
      <View style={s.cardContent}>
        <Text style={s.cardCity} numberOfLines={1}>{item.city}</Text>
        <Text style={s.cardCountry}>{item.country}</Text>
        {item.distanceMeters !== undefined && (
          <View style={s.distRow}>
            <Navigation size={11} color={C.goldBright} strokeWidth={2} />
            <Text style={s.distText}>{formatDistance(Number(item.distanceMeters))}</Text>
          </View>
        )}
      </View>

      {/* arrow */}
      <View style={s.cardArrow}>
        <ChevronRight size={20} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  // Top bar
  topBar: {
    backgroundColor: C.navy,
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  topBarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  brand:    { fontSize: 11, fontWeight: '700', color: C.gold, letterSpacing: 2 },
  savedBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroTitle: {
    fontSize: 26, fontWeight: '800', color: '#fff',
    lineHeight: 32, marginBottom: 18, letterSpacing: -0.3,
  },

  // Search
  searchWrap: { gap: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  searchInput: {
    flex: 1, fontSize: 15, color: C.textPrimary,
    padding: 0,
  },
  searchDivider: { width: 1, height: 18, backgroundColor: '#E5E7EB' },
  aiToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 4 },
  aiToggleText: { fontSize: 12, fontWeight: '800', color: C.gold, letterSpacing: 0.5 },

  aiBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 2, borderColor: C.gold,
  },
  aiInput: { flex: 1, fontSize: 15, color: C.textPrimary, padding: 0 },
  aiGoBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center',
  },

  liveChip: {
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.18)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  liveChipText: { fontSize: 12, fontWeight: '700', color: C.goldBright },

  // List
  list: { paddingBottom: 32 },

  // Recents
  section: { paddingTop: 20, paddingHorizontal: 20 },
  recentRow: { paddingTop: 10, gap: 8, paddingBottom: 4 },
  recentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 20,
    paddingLeft: 10, paddingRight: 8, paddingVertical: 7,
    borderWidth: 1, borderColor: '#EDE8DC',
    shadowColor: C.navy, shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  recentChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recentChipText: { fontSize: 13, fontWeight: '600', color: C.textPrimary, maxWidth: 100 },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#BBC3D4', letterSpacing: 1.5 },
  gpsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
  },
  gpsBadgeText: { fontSize: 10, fontWeight: '700', color: C.gold },

  // Destination card
  card: {
    marginHorizontal: 20, marginBottom: 14,
    height: 180, borderRadius: 20, overflow: 'hidden',
    backgroundColor: C.navy,
    shadowColor: '#000', shadowOpacity: 0.14,
    shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  cardPressed:  { opacity: 0.92, transform: [{ scale: 0.985 }] },
  cardGradientTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  cardGradientBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
    backgroundColor: 'rgba(5,10,30,0.72)',
  },
  countryBadge: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  countryBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  cardContent: { position: 'absolute', bottom: 16, left: 18 },
  cardCity:    { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  cardCountry: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 1, fontWeight: '500' },
  distRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  distText:    { fontSize: 12, color: C.goldBright, fontWeight: '600' },
  cardArrow:   { position: 'absolute', bottom: 20, right: 18 },

  // Empty / error
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, color: C.textMuted },
  errorText: { fontSize: 14, color: C.textMuted },
  retryBtn: {
    marginTop: 4, backgroundColor: C.navy, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
