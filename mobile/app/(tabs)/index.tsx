import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bookmark, ChevronRight, Clock, Navigation, Search, Sparkles, Star, X } from 'lucide-react-native';
import client from '@/src/api/client';
import { C, getDestinationImageUrl } from '@/constants/theme';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 52) / 2;   // two-column grid
const HERO_H = W * 0.62;        // featured hero height

const RECENT_KEY = 'recent_destinations';
async function addRecent(dest: Dest) {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list: Dest[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify([dest, ...list.filter(d => d.id !== dest.id)].slice(0, 8)));
  } catch {}
}
async function loadRecent(): Promise<Dest[]> {
  try { const r = await AsyncStorage.getItem(RECENT_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
async function removeRecent(id: number) {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list: Dest[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(list.filter(d => d.id !== id)));
  } catch {}
}

interface Dest {
  id: number; name: string; city: string;
  country: string; countryCode: string;
  hasChildren?: boolean; distanceMeters?: number;
}

const fmt = (m: number) => m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;

const FEATURED = ['Tel Aviv', 'Paris', 'New York', 'London', 'Dubai', 'Barcelona'];

export default function HomeScreen() {
  const [dests, setDests]         = useState<Dest[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRef]      = useState(false);
  const [recent, setRecent]       = useState<Dest[]>([]);
  const [aiMode, setAiMode]       = useState(false);
  const [aiText, setAiText]       = useState('');
  const [aiBusy, setAiBusy]       = useState(false);
  const [chip, setChip]           = useState<any>(null);
  const [gps, setGps]             = useState<{ lat: number; lng: number } | null>(null);
  const debRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {}
    })();
  }, []);

  const fetchDests = async (q?: string) => {
    try {
      const params: any = q ? { q } : gps ? { lat: gps.lat, lng: gps.lng } : {};
      const res = await client.get('/destinations', { params });
      setDests(res.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchDests(); loadRecent().then(setRecent); }, []);
  useEffect(() => () => { if (debRef.current) clearTimeout(debRef.current); }, []);

  const onAiChange = (v: string) => {
    setAiText(v);
    if (debRef.current) clearTimeout(debRef.current);
    if (!v.trim()) { setChip(null); return; }
    debRef.current = setTimeout(async () => {
      try { const r = await client.get('/search/classify', { params: { text: v.trim() } }); setChip(r.data.category ? r.data : null); } catch {}
    }, 400);
  };

  const doAiSearch = async () => {
    const text = aiText.trim(); if (!text) return;
    setChip(null);
    try {
      setAiBusy(true);
      const body: any = { text };
      if (gps) { body.lat = gps.lat; body.lng = gps.lng; }
      const res = await client.post('/search', body);
      const { route, detectedCity, error: e } = res.data;
      if (e === 'low_confidence') { Alert.alert('Not sure', 'Try: "kosher restaurant in Tel Aviv"'); return; }
      if (!detectedCity) { Alert.alert('No city detected', 'Try: "kosher restaurant in Tel Aviv"'); return; }
      router.push((route + `${route.includes('?') ? '&' : '?'}city=${encodeURIComponent(detectedCity)}`) as any);
    } catch { Alert.alert('Error', 'Try again'); } finally { setAiBusy(false); }
  };

  const go = (item: Dest) => {
    addRecent(item);
    setRecent(prev => [item, ...prev.filter(d => d.id !== item.id)].slice(0, 8));
    router.push((item.hasChildren ? `/destination/${item.id}/subdestinations` : `/destination/${item.id}`) as any);
  };

  // featured = dests filtered to known cities, or first 6
  const featured = dests.filter(d => FEATURED.some(f => d.city.toLowerCase().includes(f.toLowerCase()))).slice(0, 6);
  const hero = featured[0] || dests[0];

  const Header = (
    <View>
      {/* ── Hero card ── */}
      {!search && !aiMode && hero && (
        <Pressable style={s.hero} onPress={() => go(hero)}>
          <Image source={{ uri: getDestinationImageUrl(hero.city, hero.countryCode) }}
            style={StyleSheet.absoluteFillObject} contentFit="cover" transition={600} />
          <View style={s.heroOverlay} />
          <View style={s.heroContent}>
            <View style={s.heroTopRow}>
              <View style={s.featuredPill}>
                <Star size={10} color={C.gold} strokeWidth={2.5} fill={C.gold} />
                <Text style={s.featuredText}>Featured</Text>
              </View>
            </View>
            <Text style={s.heroCity}>{hero.city}</Text>
            <Text style={s.heroCountry}>{hero.country}</Text>
            <View style={s.heroExplore}>
              <Text style={s.heroExploreText}>Explore</Text>
              <ChevronRight size={14} color={C.gold} strokeWidth={2.5} />
            </View>
          </View>
        </Pressable>
      )}

      {/* ── Recent ── */}
      {recent.length > 0 && !search && !aiMode && (
        <View style={{ marginBottom: 6 }}>
          <View style={s.rowHeader}>
            <Text style={s.rowLabel}>RECENTLY VISITED</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentRow}>
            {recent.map(d => (
              <View key={d.id} style={s.recentChip}>
                <Pressable style={s.recentInner} onPress={() => go(d)}>
                  <Clock size={11} color={C.gold} strokeWidth={2.5} />
                  <Text style={s.recentText} numberOfLines={1}>{d.city}</Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => { removeRecent(d.id); setRecent(p => p.filter(r => r.id !== d.id)); }}>
                  <X size={12} color="#C4CBD8" strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Grid label ── */}
      <View style={s.rowHeader}>
        <Text style={s.rowLabel}>{search ? `"${search.toUpperCase()}"` : 'ALL DESTINATIONS'}</Text>
        {gps && !search && (
          <View style={s.gpsPill}>
            <Navigation size={10} color={C.gold} strokeWidth={2.5} />
            <Text style={s.gpsText}>Sorted by distance</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* ── Top nav ── */}
      <View style={s.nav}>
        <View>
          <Text style={s.navEyebrow}>JEWISH ON THE WAY</Text>
          <Text style={s.navTitle}>Discover</Text>
        </View>
        <Pressable style={s.savedBtn} onPress={() => router.push('/saved' as any)}>
          <Bookmark size={18} color={C.navy} strokeWidth={2} />
        </Pressable>
      </View>

      {/* ── Search bar ── */}
      <View style={s.searchWrap}>
        {!aiMode ? (
          <View style={s.searchBar}>
            <Search size={16} color="#9CA3AF" strokeWidth={2} />
            <TextInput
              style={s.searchInput}
              placeholder="Search destinations…"
              placeholderTextColor="#C4CBD8"
              value={search}
              onChangeText={t => { setSearch(t); fetchDests(t || undefined); }}
            />
            {search ? (
              <Pressable onPress={() => { setSearch(''); fetchDests(); }} hitSlop={8}>
                <X size={15} color="#C4CBD8" strokeWidth={2} />
              </Pressable>
            ) : (
              <Pressable style={s.aiPill} onPress={() => setAiMode(true)}>
                <Sparkles size={12} color="#fff" strokeWidth={2} />
                <Text style={s.aiPillText}>AI</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={s.aiBar}>
            <Sparkles size={15} color={C.gold} strokeWidth={2} />
            <TextInput
              style={s.searchInput}
              placeholder='"Kosher restaurant in Tel Aviv…"'
              placeholderTextColor="#C4CBD8"
              value={aiText}
              onChangeText={onAiChange}
              onSubmitEditing={doAiSearch}
              returnKeyType="search"
              autoFocus
            />
            {aiBusy ? (
              <ActivityIndicator size="small" color={C.navy} />
            ) : aiText ? (
              <Pressable style={s.sendBtn} onPress={doAiSearch}>
                <ChevronRight size={16} color="#fff" strokeWidth={2.5} />
              </Pressable>
            ) : (
              <Pressable hitSlop={8} onPress={() => { setAiMode(false); setAiText(''); setChip(null); }}>
                <X size={15} color="#C4CBD8" strokeWidth={2} />
              </Pressable>
            )}
          </View>
        )}
        {chip && (
          <View style={s.chip}>
            <Text style={s.chipText}>{chip.emoji}  {chip.category}{chip.denomination ? `  ·  ${chip.denomEmoji} ${chip.denomLabel}` : ''}</Text>
          </View>
        )}
      </View>

      {/* ── Content ── */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : (
        <FlatList
          data={dests}
          keyExtractor={i => String(i.id)}
          numColumns={2}
          columnWrapperStyle={s.row}
          contentContainerStyle={s.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRef(true); await fetchDests(search || undefined); setRef(false); }} tintColor={C.gold} />}
          ListHeaderComponent={Header}
          renderItem={({ item }) => <GridCard item={item} onPress={() => go(item)} />}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No destinations found</Text></View>}
        />
      )}
    </View>
  );
}

// ── Grid card ─────────────────────────────────────────────────────────────────
function GridCard({ item, onPress }: { item: Dest; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [s.gridCard, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]} onPress={onPress}>
      <Image source={{ uri: getDestinationImageUrl(item.city, item.countryCode) }}
        style={StyleSheet.absoluteFillObject} contentFit="cover" transition={400} />
      <View style={s.gridOverlay} />
      <View style={s.gridBadge}><Text style={s.gridBadgeText}>{item.countryCode}</Text></View>
      <View style={s.gridContent}>
        <Text style={s.gridCity} numberOfLines={1}>{item.city}</Text>
        {item.distanceMeters !== undefined && (
          <View style={s.gridDist}>
            <Navigation size={9} color={C.goldBright} strokeWidth={2.5} />
            <Text style={s.gridDistText}>{fmt(Number(item.distanceMeters))}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F5F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  muted: { fontSize: 14, color: '#BBC3D4' },

  // Nav
  nav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 58 : 38,
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: '#F7F5F0',
  },
  navEyebrow: { fontSize: 10, fontWeight: '700', color: C.gold, letterSpacing: 2.5, marginBottom: 2 },
  navTitle:   { fontSize: 30, fontWeight: '800', color: C.navy, letterSpacing: -0.8 },
  savedBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },

  // Search
  searchWrap: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 14 : 11,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  aiBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 18,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 14 : 11,
    borderWidth: 1.5, borderColor: C.gold,
    shadowColor: C.gold, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.textPrimary, padding: 0 },
  aiPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.navy, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  aiPillText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  sendBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center',
  },
  chip: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.3)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: C.gold },

  // Hero
  hero: {
    marginHorizontal: 20, marginBottom: 20,
    height: HERO_H, borderRadius: 24, overflow: 'hidden',
    backgroundColor: C.navy,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,30,0.42)' },
  heroContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 22 },
  heroTopRow:  { marginBottom: 'auto' as any, position: 'absolute', top: 18, left: 22 },
  featuredPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  featuredText: { fontSize: 11, fontWeight: '700', color: C.goldBright, letterSpacing: 0.5 },
  heroCity:    { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -0.8, lineHeight: 40 },
  heroCountry: { fontSize: 14, color: 'rgba(255,255,255,0.65)', marginBottom: 14, fontWeight: '500' },
  heroExplore: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroExploreText: { fontSize: 13, fontWeight: '700', color: C.gold, letterSpacing: 0.3 },

  // Recents
  recentRow: { paddingHorizontal: 20, gap: 8 },
  recentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 22,
    paddingLeft: 10, paddingRight: 8, paddingVertical: 7,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  recentInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  recentText:  { fontSize: 13, fontWeight: '600', color: C.textPrimary, maxWidth: 90 },

  // Row headers
  rowHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12,
  },
  rowLabel: { fontSize: 11, fontWeight: '800', color: '#BBC3D4', letterSpacing: 1.8 },
  gpsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(201,168,76,0.10)',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
  },
  gpsText: { fontSize: 10, fontWeight: '700', color: C.gold },

  // Grid
  grid: { paddingBottom: 40 },
  row:  { paddingHorizontal: 20, gap: 12, marginBottom: 12 },
  gridCard: {
    width: CARD_W, height: CARD_W * 1.15,
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: C.navy,
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  gridOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,30,0.50)' },
  gridBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  gridBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },
  gridContent:   { position: 'absolute', bottom: 12, left: 12, right: 12 },
  gridCity:      { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  gridDist:      { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  gridDistText:  { fontSize: 11, color: C.goldBright, fontWeight: '600' },
});
