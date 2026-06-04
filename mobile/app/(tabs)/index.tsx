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
import { Bookmark, Clock, Navigation, Search, Sparkles, X } from 'lucide-react-native';
import client from '@/src/api/client';
import { C, getDestinationImageUrl } from '@/constants/theme';

const { width: W } = Dimensions.get('window');
const CARD_W = W * 0.62;
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

export default function HomeScreen() {
  const [dests, setDests]       = useState<Dest[]>([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRef]    = useState(false);
  const [recent, setRecent]     = useState<Dest[]>([]);
  const [aiMode, setAiMode]     = useState(false);
  const [aiText, setAiText]     = useState('');
  const [aiBusy, setAiBusy]     = useState(false);
  const [chip, setChip]         = useState<any>(null);
  const [gps, setGps]           = useState<{ lat: number; lng: number } | null>(null);
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

  const doAi = async () => {
    const t = aiText.trim(); if (!t) return;
    setChip(null);
    try {
      setAiBusy(true);
      const body: any = { text: t };
      if (gps) { body.lat = gps.lat; body.lng = gps.lng; }
      const res = await client.post('/search', body);
      const { route, detectedCity, error: e } = res.data;
      if (e === 'low_confidence') { Alert.alert('Not sure', 'Try: "kosher restaurant in Tel Aviv"'); return; }
      if (!detectedCity) { Alert.alert('No city', 'Try: "kosher restaurant in Tel Aviv"'); return; }
      router.push((route + `${route.includes('?') ? '&' : '?'}city=${encodeURIComponent(detectedCity)}`) as any);
    } catch { Alert.alert('Error', 'Try again'); } finally { setAiBusy(false); }
  };

  const go = (item: Dest) => {
    addRecent(item);
    setRecent(prev => [item, ...prev.filter(d => d.id !== item.id)].slice(0, 8));
    router.push((item.hasChildren ? `/destination/${item.id}/subdestinations` : `/destination/${item.id}`) as any);
  };

  const Header = (
    <View>
      {/* Recent */}
      {recent.length > 0 && !search && !aiMode && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>RECENTLY VISITED</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentRow}>
            {recent.map(d => (
              <View key={d.id} style={s.chip}>
                <Pressable style={s.chipInner} onPress={() => go(d)}>
                  <Clock size={11} color={C.gold} strokeWidth={2.5} />
                  <Text style={s.chipText} numberOfLines={1}>{d.city}</Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => { removeRecent(d.id); setRecent(p => p.filter(r => r.id !== d.id)); }}>
                  <X size={12} color="#C4CBD8" strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={s.listHeader}>
        <Text style={s.listLabel}>{search ? `"${search}"` : 'Destinations'}</Text>
        {gps && !search && (
          <View style={s.nearPill}>
            <Navigation size={10} color={C.gold} strokeWidth={2.5} />
            <Text style={s.nearText}>Nearest first</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* ── Top ── */}
      <View style={s.top}>
        <View style={s.topRow}>
          <View>
            <Text style={s.eyebrow}>JEWISH ON THE WAY</Text>
            <Text style={s.title}>Discover</Text>
          </View>
          <Pressable style={s.savedBtn} onPress={() => router.push('/saved' as any)}>
            <Bookmark size={17} color={C.navy} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Search */}
        {!aiMode ? (
          <Pressable style={s.searchBar} onPress={() => {}}>
            <Search size={16} color="#9CA3AF" strokeWidth={2} />
            <TextInput
              style={s.searchInput}
              placeholder="Search destinations…"
              placeholderTextColor="#C4CBD8"
              value={search}
              onChangeText={t => { setSearch(t); fetchDests(t || undefined); }}
            />
            {search ? (
              <Pressable hitSlop={8} onPress={() => { setSearch(''); fetchDests(); }}>
                <X size={15} color="#C4CBD8" strokeWidth={2} />
              </Pressable>
            ) : (
              <Pressable style={s.aiBtn} onPress={() => setAiMode(true)}>
                <Sparkles size={12} color="#fff" strokeWidth={2} />
                <Text style={s.aiBtnText}>AI</Text>
              </Pressable>
            )}
          </Pressable>
        ) : (
          <View style={s.aiBar}>
            <Sparkles size={15} color={C.gold} strokeWidth={2} />
            <TextInput
              style={s.searchInput}
              placeholder='"Kosher restaurant in Paris…"'
              placeholderTextColor="#C4CBD8"
              value={aiText}
              onChangeText={onAiChange}
              onSubmitEditing={doAi}
              returnKeyType="search"
              autoFocus
            />
            {aiBusy ? (
              <ActivityIndicator size="small" color={C.navy} />
            ) : aiText ? (
              <Pressable style={s.sendBtn} onPress={doAi}>
                <Text style={s.sendBtnText}>→</Text>
              </Pressable>
            ) : (
              <Pressable hitSlop={8} onPress={() => { setAiMode(false); setAiText(''); setChip(null); }}>
                <X size={15} color="#C4CBD8" strokeWidth={2} />
              </Pressable>
            )}
          </View>
        )}

        {chip && (
          <View style={s.chipResult}>
            <Text style={s.chipResultText}>{chip.emoji}  {chip.category}{chip.denomination ? `  ·  ${chip.denomEmoji} ${chip.denomLabel}` : ''}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : (
        <FlatList
          data={dests}
          keyExtractor={i => String(i.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRef(true); await fetchDests(search || undefined); setRef(false); }} tintColor={C.gold} />}
          ListHeaderComponent={Header}
          renderItem={({ item }) => <DestCard item={item} onPress={() => go(item)} />}
          ListEmptyComponent={<View style={s.center}><Text style={s.muted}>No destinations found</Text></View>}
        />
      )}
    </View>
  );
}

function DestCard({ item, onPress }: { item: Dest; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && { opacity: 0.9, transform: [{ scale: 0.986 }] }]}
      onPress={onPress}
    >
      <Image
        source={{ uri: getDestinationImageUrl(item.city, item.countryCode) }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={400}
      />
      {/* gradient */}
      <View style={s.cardGrad} />

      <View style={s.cardContent}>
        <View style={s.cardTop}>
          <View style={s.ccBadge}><Text style={s.ccText}>{item.countryCode}</Text></View>
        </View>
        <View style={s.cardBottom}>
          <View>
            <Text style={s.cardCity}>{item.city}</Text>
            <Text style={s.cardCountry}>{item.country}</Text>
          </View>
          {item.distanceMeters !== undefined && (
            <View style={s.distBadge}>
              <Navigation size={10} color={C.goldBright} strokeWidth={2.5} />
              <Text style={s.distText}>{fmt(Number(item.distanceMeters))}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  muted:  { fontFamily: 'Inter-Regular', fontSize: 14, color: '#BBC3D4' },
  list:   { paddingBottom: 40 },

  // Top
  top: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20, paddingBottom: 18,
    backgroundColor: '#fff', gap: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontFamily: 'Inter-Bold', fontSize: 10, color: C.gold, letterSpacing: 2.5, marginBottom: 3 },
  title:   { fontFamily: 'Inter-Black', fontSize: 38, color: '#0A0E1A', letterSpacing: -1.5, lineHeight: 40 },
  savedBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F9FAFB', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 11,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  aiBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F9FAFB', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 11,
    borderWidth: 1.5, borderColor: C.gold + '60',
  },
  searchInput: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 15, color: '#0A0E1A', padding: 0 },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#0A0E1A', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  aiBtnText: { fontFamily: 'Inter-Bold', fontSize: 11, color: '#fff', letterSpacing: 0.5 },
  sendBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' },
  sendBtnText: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#fff' },

  chipResult: {
    alignSelf: 'flex-start', backgroundColor: '#FEF9EC',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  chipResultText: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: '#92400E' },

  // Recent
  section:    { paddingTop: 24, paddingHorizontal: 20 },
  sectionLabel: { fontFamily: 'Inter-Bold', fontSize: 10, color: '#D1D5DB', letterSpacing: 2, marginBottom: 10 },
  recentRow:  { gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F9FAFB', borderRadius: 20,
    paddingLeft: 10, paddingRight: 8, paddingVertical: 7,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipText:  { fontFamily: 'Inter-SemiBold', fontSize: 13, color: '#374151', maxWidth: 90 },

  // List header
  listHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 14,
  },
  listLabel: { fontFamily: 'Inter-ExtraBold', fontSize: 20, color: '#0A0E1A', letterSpacing: -0.5 },
  nearPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF9EC', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  nearText: { fontFamily: 'Inter-Bold', fontSize: 10, color: C.gold },

  // Destination card
  card: {
    marginHorizontal: 20, marginBottom: 14,
    height: 200, borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#0A0E1A',
  },
  cardGrad: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,8,20,0.35)',
  },
  cardContent: { ...StyleSheet.absoluteFillObject, padding: 18, justifyContent: 'space-between' },
  cardTop:   { flexDirection: 'row', justifyContent: 'flex-end' },
  ccBadge: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  ccText:    { fontFamily: 'Inter-Bold', fontSize: 10, color: '#fff', letterSpacing: 1 },
  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  cardCity:    { fontFamily: 'Inter-Black', fontSize: 26, color: '#fff', letterSpacing: -0.8 },
  cardCountry: { fontFamily: 'Inter-Medium', fontSize: 13, color: 'rgba(255,255,255,0.60)', marginTop: 2 },
  distBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5,
  },
  distText: { fontFamily: 'Inter-Bold', fontSize: 11, color: C.goldBright },
});
