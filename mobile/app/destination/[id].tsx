import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ArrowLeft, ChevronRight, Coffee, Globe, Home,
  Map, MessageCircle, Search, Sparkles, Users, Utensils,
} from 'lucide-react-native';
import client from '@/src/api/client';
import { C, getDestinationImageUrl } from '@/constants/theme';

const { width: W } = Dimensions.get('window');
const TILE_W = (W - 52) / 2;

interface Destination {
  id: number; name: string; city: string;
  country: string; countryCode: string; description?: string;
  location?: { coordinates: [number, number] };
}

type ServiceKey = 'restaurants' | 'synagogues' | 'minyans' | 'hosting' | 'chat' | 'map';

const SERVICES: {
  key: ServiceKey; label: string; sub: string;
  Icon: any; color: string; bg: string;
}[] = [
  { key: 'restaurants', label: 'Restaurants', sub: 'Kosher dining',       Icon: Utensils,       color: '#059669', bg: '#F0FDF4' },
  { key: 'synagogues',  label: 'Synagogues',  sub: 'Shuls & times',      Icon: Globe,           color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'minyans',     label: 'Minyans',     sub: 'Prayer groups',       Icon: Users,           color: '#D97706', bg: '#FFFBEB' },
  { key: 'hosting',     label: 'Hosting',     sub: 'Shabbat tables',      Icon: Home,            color: '#DB2777', bg: '#FDF2F8' },
  { key: 'chat',        label: 'Chat',        sub: 'Traveler community',  Icon: MessageCircle,   color: '#0891B2', bg: '#F0F9FF' },
  { key: 'map',         label: 'Map',         sub: 'All places',          Icon: Map,             color: '#0F766E', bg: '#F0FDFA' },
];

const ACTIVE: ServiceKey[] = ['restaurants', 'synagogues', 'chat', 'minyans', 'hosting', 'map'];

export default function DestinationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [loading, setLoading]         = useState(true);
  const [searchText, setSearchText]   = useState('');
  const [searching, setSearching]     = useState(false);

  useEffect(() => {
    client.get(`/destinations/${id}`)
      .then(res => setDestination(res.data))
      .catch(() => { AsyncStorage.removeItem('lastDestinationId'); router.replace('/(tabs)'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    try {
      setSearching(true);
      const res = await client.post('/search', { text: searchText.trim(), destinationId: Number(id) });
      const { route } = res.data;
      router.push(route as any);
    } catch { Alert.alert('Error', 'Search unavailable, try again'); }
    finally { setSearching(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>;
  if (!destination) return <View style={s.center}><Text style={s.muted}>Not found</Text></View>;

  const imageUrl = getDestinationImageUrl(destination.city, destination.countryCode);

  const nav = (svc: ServiceKey) => {
    const city = encodeURIComponent(destination.city);
    if (svc === 'restaurants') router.push(`/restaurants/${id}?city=${city}`);
    else if (svc === 'synagogues') router.push(`/synagogues/${id}?city=${city}`);
    else if (svc === 'chat')       router.push(`/chat/${id}?city=${city}`);
    else if (svc === 'minyans')    router.push(`/minyans/${id}?city=${city}`);
    else if (svc === 'hosting')    router.push(`/hosting/${id}?city=${city}`);
    else if (svc === 'map') {
      const la = destination.location?.coordinates?.[1] ?? '';
      const lo = destination.location?.coordinates?.[0] ?? '';
      router.push(`/map/${id}?lat=${la}&lng=${lo}&name=${city}` as any);
    }
  };

  return (
    <View style={s.root}>

      {/* ── Hero ── */}
      <View style={s.hero}>
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={600} />
        <View style={s.heroGradient} />

        {/* Back */}
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={20} color="#fff" strokeWidth={2.5} />
        </Pressable>

        {/* Country badge */}
        <View style={s.ccBadge}>
          <Text style={s.ccText}>{destination.countryCode}</Text>
        </View>

        {/* City info */}
        <View style={s.heroContent}>
          <Text style={s.heroCity}>{destination.city}</Text>
          <Text style={s.heroCountry}>{destination.country}</Text>
          {destination.description ? (
            <Text style={s.heroDesc} numberOfLines={2}>{destination.description}</Text>
          ) : null}
        </View>
      </View>

      {/* ── Search ── */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Sparkles size={16} color={C.gold} strokeWidth={2} />
          <TextInput
            style={s.searchInput}
            placeholder="Ask AI anything about this city…"
            placeholderTextColor="#BBC3D4"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <Pressable
            style={[s.searchBtn, (!searchText.trim() || searching) && s.searchBtnOff]}
            onPress={handleSearch}
            disabled={!searchText.trim() || searching}
          >
            {searching
              ? <ActivityIndicator size="small" color="#fff" />
              : <Search size={16} color="#fff" strokeWidth={2.5} />
            }
          </Pressable>
        </View>
      </View>

      {/* ── Service tiles ── */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
        <Text style={s.sectionLabel}>EXPLORE</Text>

        <View style={s.grid}>
          {SERVICES.map(svc => {
            const active = ACTIVE.includes(svc.key);
            return (
              <Pressable
                key={svc.key}
                style={({ pressed }) => [
                  s.tile,
                  { backgroundColor: active ? svc.bg : '#F9F9F9' },
                  !active && s.tileDim,
                  pressed && active && s.tilePressed,
                ]}
                onPress={() => active && nav(svc.key)}
              >
                <View style={[s.tileIcon, { backgroundColor: active ? svc.color + '18' : '#E5E7EB' }]}>
                  <svc.Icon size={26} color={active ? svc.color : '#BBC3D4'} strokeWidth={1.8} />
                </View>
                <Text style={[s.tileLabel, !active && s.tileLabelDim]}>{svc.label}</Text>
                <Text style={[s.tileSub, !active && s.tileSubDim]}>
                  {active ? svc.sub : 'Coming soon'}
                </Text>
                {active && (
                  <View style={[s.tileArrow, { backgroundColor: svc.color + '15' }]}>
                    <ChevronRight size={14} color={svc.color} strokeWidth={2.5} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F7F5F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted:  { fontSize: 14, color: C.textMuted },

  // Hero
  hero: { height: 300, justifyContent: 'flex-end' },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Simulated gradient via multiple overlays
  },
  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 58 : 40, left: 18,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  ccBadge: {
    position: 'absolute', top: Platform.OS === 'ios' ? 62 : 44, right: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  ccText:   { fontSize: 11, fontWeight: '800', color: C.goldBright, letterSpacing: 1.5 },
  heroContent: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 22, paddingBottom: 28,
    backgroundColor: 'rgba(5,10,30,0.55)',
  },
  heroCity:    { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  heroCountry: { fontSize: 14, color: 'rgba(255,255,255,0.60)', fontWeight: '500', marginBottom: 6 },
  heroDesc:    { fontSize: 13, color: 'rgba(255,255,255,0.50)', lineHeight: 19 },

  // Search
  searchWrap: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#F7F5F0' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.textPrimary, padding: 0 },
  searchBtn: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center',
  },
  searchBtnOff: { backgroundColor: '#E5E7EB' },

  // Grid
  body:         { paddingHorizontal: 20, paddingBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#BBC3D4', letterSpacing: 2, marginBottom: 14 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  tile: {
    width: TILE_W, borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
    minHeight: 150,
  },
  tileDim:     { opacity: 0.5 },
  tilePressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },

  tileIcon: {
    width: 50, height: 50, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  tileLabel:    { fontSize: 15, fontWeight: '800', color: C.textPrimary, marginBottom: 3 },
  tileLabelDim: { color: '#BBC3D4' },
  tileSub:      { fontSize: 12, color: C.textSecondary, lineHeight: 17, flex: 1 },
  tileSubDim:   { color: '#D1D5DB' },
  tileArrow: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'flex-end', marginTop: 10,
  },
});
