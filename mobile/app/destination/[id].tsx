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
  ArrowLeft, Globe, Home, Map,
  MessageCircle, Search, Sparkles, Users, Utensils,
} from 'lucide-react-native';
import client from '@/src/api/client';
import { C, getDestinationImageUrl } from '@/constants/theme';

const { width: W } = Dimensions.get('window');

interface Destination {
  id: number; name: string; city: string;
  country: string; countryCode: string; description?: string;
  location?: { coordinates: [number, number] };
}

type ServiceKey = 'restaurants' | 'synagogues' | 'minyans' | 'hosting' | 'chat' | 'map';
const ACTIVE: ServiceKey[] = ['restaurants', 'synagogues', 'chat', 'minyans', 'hosting', 'map'];

export default function DestinationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [loading, setLoading]         = useState(true);
  const [searchText, setSearchText]   = useState('');
  const [searching, setSearching]     = useState(false);

  useEffect(() => {
    client.get(`/destinations/${id}`)
      .then(r => setDestination(r.data))
      .catch(() => { AsyncStorage.removeItem('lastDestinationId'); router.replace('/(tabs)'); })
      .finally(() => setLoading(false));
  }, [id]);

  const doSearch = async () => {
    if (!searchText.trim()) return;
    try {
      setSearching(true);
      const res = await client.post('/search', { text: searchText.trim(), destinationId: Number(id) });
      router.push(res.data.route as any);
    } catch { Alert.alert('Error', 'Search unavailable'); }
    finally { setSearching(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>;
  if (!destination) return <View style={s.center}><Text style={s.muted}>Not found</Text></View>;

  const img = getDestinationImageUrl(destination.city, destination.countryCode);
  const city = encodeURIComponent(destination.city);

  const go = (key: ServiceKey) => {
    if (!ACTIVE.includes(key)) return;
    if (key === 'restaurants') router.push(`/restaurants/${id}?city=${city}`);
    else if (key === 'synagogues') router.push(`/synagogues/${id}?city=${city}`);
    else if (key === 'chat')       router.push(`/chat/${id}?city=${city}`);
    else if (key === 'minyans')    router.push(`/minyans/${id}?city=${city}`);
    else if (key === 'hosting')    router.push(`/hosting/${id}?city=${city}`);
    else if (key === 'map') {
      const la = destination.location?.coordinates?.[1] ?? '';
      const lo = destination.location?.coordinates?.[0] ?? '';
      router.push(`/map/${id}?lat=${la}&lng=${lo}&name=${city}` as any);
    }
  };

  return (
    <ScrollView style={s.root} showsVerticalScrollIndicator={false} bounces>

      {/* ── Hero ── */}
      <View style={s.hero}>
        <Image source={{ uri: img }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={500} />
        <View style={s.heroScrim} />

        <Pressable style={s.back} onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={19} color="#fff" strokeWidth={2.5} />
        </Pressable>

        <View style={s.heroBadge}>
          <Text style={s.heroBadgeText}>{destination.countryCode}</Text>
        </View>

        <View style={s.heroText}>
          <Text style={s.heroCity}>{destination.city}</Text>
          <Text style={s.heroCountry}>{destination.country}</Text>
        </View>
      </View>

      {/* ── AI search ── */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Sparkles size={15} color={C.gold} strokeWidth={2} />
          <TextInput
            style={s.searchInput}
            placeholder="Ask anything about this city…"
            placeholderTextColor="#BBC3D4"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={doSearch}
            returnKeyType="search"
          />
          <Pressable
            style={[s.searchGo, (!searchText.trim() || searching) && { backgroundColor: '#E5E7EB' }]}
            onPress={doSearch}
            disabled={!searchText.trim() || searching}
          >
            {searching
              ? <ActivityIndicator size="small" color="#fff" />
              : <Search size={15} color="#fff" strokeWidth={2.5} />
            }
          </Pressable>
        </View>
      </View>

      {/* ── Bento grid ── */}
      <View style={s.bento}>

        {/* Row 1: Restaurants (large) + Synagogues (large) */}
        <View style={s.bentoRow}>
          <BentoCard
            label="Restaurants"
            sub="Kosher dining"
            Icon={Utensils}
            color="#fff"
            bg="#0C1E45"
            size="large"
            onPress={() => go('restaurants')}
          />
          <BentoCard
            label="Synagogues"
            sub="Shuls & times"
            Icon={Globe}
            color="#fff"
            bg="#7C3AED"
            size="large"
            onPress={() => go('synagogues')}
          />
        </View>

        {/* Row 2: three compact */}
        <View style={s.bentoRow}>
          <BentoCard
            label="Minyans"
            sub="Prayer groups"
            Icon={Users}
            color={C.navy}
            bg="#FEF3C7"
            size="small"
            onPress={() => go('minyans')}
          />
          <BentoCard
            label="Hosting"
            sub="Shabbat tables"
            Icon={Home}
            color="#fff"
            bg="#DB2777"
            size="small"
            onPress={() => go('hosting')}
          />
          <BentoCard
            label="Chat"
            sub="Community"
            Icon={MessageCircle}
            color="#fff"
            bg="#0891B2"
            size="small"
            onPress={() => go('chat')}
          />
        </View>

        {/* Row 3: Map (full width) */}
        <Pressable
          style={({ pressed }) => [s.mapCard, pressed && { opacity: 0.88 }]}
          onPress={() => go('map')}
        >
          <View style={s.mapIconWrap}>
            <Map size={22} color="#fff" strokeWidth={2} />
          </View>
          <View>
            <Text style={s.mapLabel}>Interactive Map</Text>
            <Text style={s.mapSub}>See all synagogues on the map</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={s.mapArrow}>
            <Text style={s.mapArrowText}>→</Text>
          </View>
        </Pressable>

      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ── Bento card component ──────────────────────────────────────────────────────
function BentoCard({
  label, sub, Icon, color, bg, size, onPress,
}: {
  label: string; sub: string; Icon: any;
  color: string; bg: string;
  size: 'large' | 'small';
  onPress: () => void;
}) {
  const isLarge = size === 'large';
  return (
    <Pressable
      style={({ pressed }) => [
        s.bentoCard,
        isLarge ? s.bentoLarge : s.bentoSmall,
        { backgroundColor: bg },
        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
      ]}
      onPress={onPress}
    >
      <View style={[s.bentoIconWrap, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
        <Icon size={isLarge ? 22 : 18} color={color} strokeWidth={2} />
      </View>
      <Text style={[s.bentoLabel, { color, fontSize: isLarge ? 15 : 13 }]}>{label}</Text>
      <Text style={[s.bentoSub, { color: color + 'AA', fontSize: isLarge ? 11 : 10 }]}>{sub}</Text>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F7F5F0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted:  { fontSize: 14, color: C.textMuted },

  hero:     { height: 280 },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,10,30,0.40)',
  },
  back: {
    position: 'absolute', top: Platform.OS === 'ios' ? 58 : 40, left: 18,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroBadge: {
    position: 'absolute', top: Platform.OS === 'ios' ? 62 : 44, right: 18,
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderWidth: 1, borderColor: 'rgba(201,168,76,0.5)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  heroBadgeText: { fontSize: 11, fontWeight: '800', color: C.goldBright, letterSpacing: 1.5 },
  heroText:    { position: 'absolute', bottom: 24, left: 22 },
  heroCity:    { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  heroCountry: { fontSize: 14, color: 'rgba(255,255,255,0.60)', marginTop: 3, fontWeight: '500' },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 14 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.textPrimary, padding: 0 },
  searchGo: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center',
  },

  // Bento
  bento:    { paddingHorizontal: 16, gap: 10 },
  bentoRow: { flexDirection: 'row', gap: 10 },

  bentoCard: {
    borderRadius: 20, padding: 16, justifyContent: 'flex-end',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  bentoLarge: { flex: 1, minHeight: 140 },
  bentoSmall: { flex: 1, minHeight: 110 },

  bentoIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  bentoLabel: { fontWeight: '800', letterSpacing: -0.2, marginBottom: 2 },
  bentoSub:   { fontWeight: '500' },

  // Map full-width card
  mapCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#0F766E', borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  mapIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  mapLabel:    { fontSize: 15, fontWeight: '800', color: '#fff' },
  mapSub:      { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  mapArrow:    { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  mapArrowText:{ fontSize: 18, color: '#fff', fontWeight: '700' },
});
