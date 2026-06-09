import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { Bookmark, ChevronRight, Clock, Navigation, Search, Sparkles, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { C, getDestinationImageUrl, HERO_IMAGES } from '@/constants/theme';
import ErrorState from '@/src/components/ErrorState';
import { DestinationCardSkeleton } from '@/src/components/Skeleton';
import { translateCity, translateCountry } from '@/src/i18n/geo';

const { width: W, height: H } = Dimensions.get('window');
const HERO_H = H * 0.52;
const POP_W  = W * 0.54;

const RECENT_KEY = 'recent_destinations';

interface Dest {
  id: number; name: string; city: string;
  country: string; countryCode: string;
  hasChildren?: boolean; distanceMeters?: number;
}

async function addRecent(d: Dest) {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list: Dest[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify([d, ...list.filter(x => x.id !== d.id)].slice(0, 8)));
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

const fmt = (m: number) => m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;

// Popular destinations to feature at top
const POPULAR_CITIES = ['Tel Aviv', 'Paris', 'New York', 'London', 'Buenos Aires', 'Amsterdam', 'Berlin', 'Miami'];

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [dests, setDests]       = useState<Dest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [refreshing, setRef]    = useState(false);
  const [recent, setRecent]     = useState<Dest[]>([]);
  const [search, setSearch]     = useState('');
  const [aiText, setAiText]     = useState('');
  const [aiBusy, setAiBusy]     = useState(false);
  const [chip, setChip]         = useState<any>(null);
  const [searchMode, setSearchMode] = useState<'none' | 'text' | 'ai'>('none');
  const [gps, setGps]           = useState<{ lat: number; lng: number } | null>(null);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [heroIdx, setHeroIdx]   = useState(0);
  const debRef = useRef<any>(null);

  const fetchDests = async (q?: string, coords?: { lat: number; lng: number }) => {
    setError(false);
    try {
      const loc = coords ?? gps;
      const params: any = q ? { q } : loc ? { lat: loc.lat, lng: loc.lng } : {};
      const res = await client.get('/destinations', { params });
      setDests(res.data);
    } catch { setError(true); } finally { setLoading(false); }
  };

  useEffect(() => { fetchDests(); loadRecent().then(setRecent); }, []);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        let coords: { lat: number; lng: number } | null = null;
        try {
          // Accuracy.Low = cell-tower triangulation: fast, works indoors, good enough for country-level sorting
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch {
          // Accept a cached position up to 30 minutes old
          const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });
          if (last) coords = { lat: last.coords.latitude, lng: last.coords.longitude };
        }
        if (coords) {
          setGps(coords);
          fetchDests(undefined, coords);
          // Reverse geocode to know which country the user is currently in
          try {
            const [place] = await Location.reverseGeocodeAsync(
              { latitude: coords.lat, longitude: coords.lng },
              { useGoogleMaps: false },
            );
            if (place?.isoCountryCode) setUserCountry(place.isoCountryCode.toUpperCase());
          } catch {}
        }
      } catch {}
    })();
  }, []);

  useEffect(() => () => { if (debRef.current) clearTimeout(debRef.current); }, []);

  useEffect(() => {
    const id = setInterval(() => setHeroIdx(i => (i + 1) % HERO_IMAGES.length), 4000);
    return () => clearInterval(id);
  }, []);

  const onAiChange = (v: string) => {
    setAiText(v);
    if (debRef.current) clearTimeout(debRef.current);
    if (!v.trim()) { setChip(null); return; }
    debRef.current = setTimeout(async () => {
      try { const r = await client.get('/search/classify', { params: { text: v.trim() } }); setChip(r.data.category ? r.data : null); } catch {}
    }, 400);
  };

  const doAi = async () => {
    const query = aiText.trim(); if (!query) return;
    setChip(null);
    try {
      setAiBusy(true);
      const body: any = { text: query };
      if (gps) { body.lat = gps.lat; body.lng = gps.lng; }
      const res = await client.post('/search', body);
      const { route, category, emoji, detectedCity, error } = res.data;

      if (error === 'low_confidence') {
        Alert.alert('לא הבנתי 🤔', 'נסה לכתוב בצורה ברורה יותר.\nלמשל: "מסעדה כשרה בתל אביב" או "מניין בירושלים"');
        return;
      }

      if (!route) {
        Alert.alert(
          `${emoji} זיהינו: ${category}`,
          'לא מצאנו יעד מתאים.\nנסה לכתוב למשל: "מסעדה כשרה בתל אביב"',
        );
        return;
      }

      const cityParam = detectedCity ? `${route.includes('?') ? '&' : '?'}city=${encodeURIComponent(detectedCity)}` : '';
      const fullRoute = route + cityParam;
      const qParam = category === 'restaurant' && query
        ? `${fullRoute.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}`
        : '';
      router.push((fullRoute + qParam) as any);
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לחפש כרגע, נסה שוב');
    } finally {
      setAiBusy(false);
    }
  };

  const go = (item: Dest) => {
    addRecent(item);
    setRecent(prev => [item, ...prev.filter(d => d.id !== item.id)].slice(0, 8));
    router.push((item.hasChildren ? `/destination/${item.id}/subdestinations` : `/destination/${item.id}`) as any);
  };

  // Debounced API search — fires when text search changes
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    if (searchMode !== 'text') return;
    debRef.current = setTimeout(() => {
      fetchDests(search.trim() || undefined, search.trim() ? undefined : gps ?? undefined);
    }, 300);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [search, searchMode]);

  const popular = dests.filter(d => POPULAR_CITIES.some(c => d.city.toLowerCase().includes(c.toLowerCase())));
  const hero = popular[0] || dests[0];
  const filteredDests = dests;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Sticky search bar — only shown when in text mode so it stays visible while scrolling */}
      {searchMode === 'text' && (
        <View style={s.stickySearchBar}>
          <Search size={16} color={C.navy} strokeWidth={2} />
          <TextInput
            style={s.heroSearchInput}
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            autoFocus
            returnKeyType="search"
          />
          <Pressable hitSlop={12} onPress={() => { setSearch(''); setSearchMode('none'); fetchDests(undefined, gps ?? undefined); }}>
            <X size={18} color="#6B7280" strokeWidth={2} />
          </Pressable>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRef(true); await fetchDests(); setRef(false); }} tintColor={C.gold} />}
      >

        {/* ── HERO ── */}
        {hero && (
          <View style={s.hero}>
            <Image
              source={HERO_IMAGES[heroIdx]}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={1000}
            />

            {/* Gradient overlays */}
            <View style={s.heroGradTop} />
            <View style={s.heroGradBottom} />

            {/* Top nav */}
            <View style={s.heroNav}>
              <View>
                <Text style={s.heroBrand}>JEWISH ON THE WAY</Text>
              </View>
              <Pressable style={s.savedBtn} onPress={() => router.push('/saved' as any)}>
                <Bookmark size={17} color="#fff" strokeWidth={2} />
              </Pressable>
            </View>

            {/* Carousel dots */}
            <View style={s.heroDots}>
              {HERO_IMAGES.map((_, i) => (
                <View key={i} style={[s.heroDot, i === heroIdx && s.heroDotActive]} />
              ))}
            </View>

            {/* Hero text */}
            <View style={s.heroContent}>
              <Text style={s.heroTagline}>{t('home.headline1')}</Text>
              <Text style={s.heroTagline2}>{t('home.headline2')}</Text>
              <Text style={s.heroSub}>{t('home.tagline')}</Text>

              {/* Search bar — glassmorphism */}
              {searchMode === 'none' && (
                <View style={s.heroSearch}>
                  <Pressable style={s.heroSearchInner} onPress={() => setSearchMode('text')}>
                    <Search size={16} color="rgba(255,255,255,0.7)" strokeWidth={2} />
                    <Text style={s.heroSearchPlaceholder}>{t('home.searchPlaceholder')}</Text>
                  </Pressable>
                  <Pressable style={s.heroAiBtn} onPress={() => setSearchMode('ai')}>
                    <Sparkles size={14} color={C.gold} strokeWidth={2} />
                    <Text style={s.heroAiBtnText}>AI</Text>
                  </Pressable>
                </View>
              )}

              {/* search bar in hero is hidden in text mode — sticky bar above handles it */}

              {searchMode === 'ai' && (
                <View style={s.heroSearchActive}>
                  <Sparkles size={16} color={C.gold} strokeWidth={2} />
                  <TextInput
                    style={s.heroSearchInput}
                    placeholder={t('home.aiPlaceholder')}
                    placeholderTextColor="#9CA3AF"
                    value={aiText}
                    onChangeText={onAiChange}
                    onSubmitEditing={doAi}
                    returnKeyType="search"
                    autoFocus
                  />
                  {aiBusy
                    ? <ActivityIndicator size="small" color={C.navy} />
                    : aiText
                      ? <Pressable style={s.aiGo} onPress={doAi}><Text style={s.aiGoText}>→</Text></Pressable>
                      : <Pressable hitSlop={8} onPress={() => { setAiText(''); setSearchMode('none'); setChip(null); }}><X size={16} color="#9CA3AF" strokeWidth={2} /></Pressable>
                  }
                </View>
              )}

              {chip && (
                <View style={s.chipResult}>
                  <Text style={s.chipResultText}>{chip.emoji}  {chip.category}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={s.body}>

          {/* ── POPULAR DESTINATIONS ── */}
          {!search && popular.length > 0 && (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>{t('home.popular')}</Text>
                <Pressable style={s.seeAll} onPress={() => {}}>
                  <Text style={s.seeAllText}>{t('home.seeAll')}</Text>
                  <ChevronRight size={14} color={C.navy} strokeWidth={2.5} />
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.popRow}>
                {popular.slice(0, 6).map(item => (
                  <PopularCard key={item.id} item={item} lang={lang} onPress={() => go(item)} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── RECENTLY VISITED ── */}
          {!search && recent.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('home.recentlyVisited')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentRow}>
                {recent.map(d => (
                  <View key={d.id} style={s.recentChip}>
                    <Pressable style={s.recentInner} onPress={() => go(d)}>
                      <Clock size={11} color={C.gold} strokeWidth={2.5} />
                      <Text style={s.recentText} numberOfLines={1}>{translateCity(d.city, lang)}</Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => { removeRecent(d.id); setRecent(p => p.filter(r => r.id !== d.id)); }}>
                      <X size={11} color="#D1D5DB" strokeWidth={2.5} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── ALL / SEARCH RESULTS ── */}
          <View style={s.section}>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>
                {search ? `${t('home.resultsFor')} "${search}"` : t('home.allDestinations')}
              </Text>
              {gps && !search && (
                <View style={s.gpsPill}>
                  <Navigation size={10} color={C.gold} strokeWidth={2.5} />
                  <Text style={s.gpsPillText}>{t('home.nearestFirst')}</Text>
                </View>
              )}
            </View>

            {loading ? (
              <View style={s.destGrid}>
                {[0,1,2,3,4,5].map(i => (
                  <DestinationCardSkeleton key={i} width={(W - 52) / 2} />
                ))}
              </View>
            ) : error ? (
              <ErrorState onRetry={() => fetchDests(search || undefined, gps ?? undefined)} />
            ) : (
              <View style={s.destGrid}>
                {filteredDests.map(item => (
                  <DestCard key={item.id} item={item} lang={lang} userCountry={userCountry} onPress={() => go(item)} />
                ))}
                {filteredDests.length === 0 && (
                  <Text style={s.empty}>{t('home.noResults')}</Text>
                )}
              </View>
            )}
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ── Popular card (horizontal scroll) ─────────────────────────────────────────
function PopularCard({ item, lang, onPress }: { item: Dest; lang: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [s.popCard, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
      onPress={onPress}
    >
      <Image source={getDestinationImageUrl(item.city, item.countryCode)}
        style={StyleSheet.absoluteFillObject} contentFit="cover" transition={400} />
      <View style={s.popGrad} />
      <View style={s.popContent}>
        <Text style={s.popCity}>{translateCity(item.city, lang)}</Text>
        <Text style={s.popCountry}>{translateCountry(item.countryCode, lang)}</Text>
      </View>
    </Pressable>
  );
}

// ── Destination card (2-col grid) ─────────────────────────────────────────────
function DestCard({ item, lang, userCountry, onPress }: { item: Dest; lang: string; userCountry: string | null; onPress: () => void }) {
  const W2 = (Dimensions.get('window').width - 52) / 2;
  const isHere = userCountry
    ? item.countryCode?.toUpperCase() === userCountry
    : item.distanceMeters !== undefined && Number(item.distanceMeters) < 50000;

  return (
    <Pressable
      style={({ pressed }) => [s.destCard, { width: W2 }, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
      onPress={onPress}
    >
      <Image source={getDestinationImageUrl(item.city, item.countryCode)}
        style={StyleSheet.absoluteFillObject} contentFit="cover" transition={300} />
      <View style={s.destGrad} />
      <View style={s.destBadge}><Text style={s.destBadgeText}>{item.countryCode}</Text></View>
      <View style={s.destContent}>
        <Text style={s.destCity} numberOfLines={1}>{translateCity(item.city, lang)}</Text>
        {isHere ? (
          <View style={s.destDist}>
            <Navigation size={9} color={C.goldBright} strokeWidth={2.5} />
            <Text style={s.destDistText}>מיקומך</Text>
          </View>
        ) : item.distanceMeters !== undefined && (
          <View style={s.destDist}>
            <Navigation size={9} color={C.goldBright} strokeWidth={2.5} />
            <Text style={s.destDistText}>{fmt(Number(item.distanceMeters))}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Hero
  hero: { height: HERO_H, justifyContent: 'flex-end' },
  heroGradTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 160,
    backgroundColor: 'rgba(5,10,30,0.50)',
  },
  heroGradBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 220,
    backgroundColor: 'rgba(5,10,30,0.75)',
  },

  heroNav: {
    position: 'absolute', top: Platform.OS === 'ios' ? 58 : 38,
    left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  heroBrand: { fontFamily: 'Inter-Bold', fontSize: 10, color: C.gold, letterSpacing: 2.5 },
  savedBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },

  heroDots: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingBottom: 12,
  },
  heroDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.40)',
  },
  heroDotActive: {
    width: 20, backgroundColor: C.gold,
  },

  heroContent: { paddingHorizontal: 22, paddingBottom: 28, gap: 4 },
  heroTagline:  { fontFamily: 'Inter-Black', fontSize: 36, color: '#fff', letterSpacing: -1, lineHeight: 40 },
  heroTagline2: { fontFamily: 'Inter-Black', fontSize: 36, color: C.gold, letterSpacing: -1, lineHeight: 40, marginBottom: 8 },
  heroSub:      { fontFamily: 'Inter-Medium', fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 18 },

  // Glassmorphism search
  heroSearch: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
    overflow: 'hidden',
  },
  heroSearchInner: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  heroSearchPlaceholder: { fontFamily: 'Inter-Regular', fontSize: 14, color: 'rgba(255,255,255,0.65)' },
  heroAiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14, paddingVertical: 14,
    borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.15)',
  },
  heroAiBtnText: { fontFamily: 'Inter-Bold', fontSize: 12, color: C.gold },

  heroSearchActive: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  stickySearchBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff',
    paddingTop: 52, paddingBottom: 12,
    paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 4,
  },
  heroSearchInput: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 15, color: C.textPrimary, padding: 0 },
  aiGo: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center' },
  aiGoText: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#fff' },
  chipResult: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginTop: 6,
  },
  chipResultText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: C.goldBright },

  // Body
  body: { backgroundColor: C.bg, paddingBottom: 20 },

  // Section
  section:    { paddingTop: 28, paddingHorizontal: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontFamily: 'Inter-ExtraBold', fontSize: 20, color: C.textPrimary, letterSpacing: -0.4 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.navy },
  gpsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.goldFaint, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
  },
  gpsPillText: { fontFamily: 'Inter-Bold', fontSize: 10, color: C.gold },
  loadingWrap: { height: 100, justifyContent: 'center', alignItems: 'center' },
  empty: { fontFamily: 'Inter-Regular', fontSize: 14, color: C.textMuted, textAlign: 'center', paddingVertical: 30 },

  // Popular horizontal cards
  popRow: { gap: 12, paddingRight: 4 },
  popCard: {
    width: POP_W, height: POP_W * 1.2,
    borderRadius: 20, overflow: 'hidden', backgroundColor: C.navy,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  popGrad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,10,30,0.45)',
  },
  popContent: { position: 'absolute', bottom: 18, left: 16 },
  popCity:    { fontFamily: 'Inter-Black', fontSize: 20, color: '#fff', letterSpacing: -0.4 },
  popCountry: { fontFamily: 'Inter-Medium', fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  // Recent chips
  recentRow: { gap: 8, paddingTop: 4 },
  recentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: 22,
    paddingLeft: 10, paddingRight: 8, paddingVertical: 7,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  recentInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  recentText:  { fontFamily: 'Inter-SemiBold', fontSize: 13, color: C.textPrimary, maxWidth: 90 },

  // Dest grid
  destGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  destCard: {
    height: 160, borderRadius: 20, overflow: 'hidden', backgroundColor: C.navy,
    shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  destGrad: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,30,0.42)' },
  destBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.40)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  destBadgeText: { fontFamily: 'Inter-Bold', fontSize: 9, color: '#fff', letterSpacing: 0.8 },
  destContent:   { position: 'absolute', bottom: 12, left: 12, right: 12 },
  destCity:      { fontFamily: 'Inter-ExtraBold', fontSize: 16, color: '#fff', letterSpacing: -0.2 },
  destDist:      { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  destDistText:  { fontFamily: 'Inter-Bold', fontSize: 10, color: C.goldBright },
});
