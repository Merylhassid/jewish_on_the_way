import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useTranslation } from 'react-i18next';
import client from '@/src/api/client';
import { C, getDestinationImageUrl } from '@/constants/theme';
import { translateCity, translateCountry } from '@/src/i18n/geo';


interface Destination {
  id: number; name: string; city: string;
  country: string; countryCode: string; description?: string;
  location?: { coordinates: [number, number] };
}

type ServiceKey = 'restaurants' | 'synagogues' | 'minyans' | 'hosting' | 'chat' | 'map';
const ACTIVE: ServiceKey[] = ['restaurants', 'synagogues', 'chat', 'minyans', 'hosting', 'map'];

const SERVICE_DEFS: { key: ServiceKey; tKey: string; subTKey: string; Icon: any; color: string; bg: string; }[] = [
  { key: 'restaurants', tKey: 'restaurants', subTKey: 'restaurantsSub', Icon: Utensils,      color: '#16A34A', bg: '#F0FDF4' },
  { key: 'synagogues',  tKey: 'synagogues',  subTKey: 'synagoguesSub',  Icon: Globe,         color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'minyans',     tKey: 'minyans',     subTKey: 'minyansSub',     Icon: Users,         color: '#D97706', bg: '#FFFBEB' },
  { key: 'hosting',     tKey: 'hosting',     subTKey: 'hostingSub',     Icon: Home,          color: '#DB2777', bg: '#FDF2F8' },
  { key: 'chat',        tKey: 'chat',        subTKey: 'chatSub',        Icon: MessageCircle, color: '#0891B2', bg: '#F0F9FF' },
  { key: 'map',         tKey: 'map',         subTKey: 'mapSub',         Icon: Map,           color: '#0F766E', bg: '#F0FDFA' },
];

export default function DestinationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [dest, setDest]         = useState<Destination | null>(null);
  const [loading, setLoading]   = useState(true);
  const [counts, setCounts]     = useState<{ restaurants: number; synagogues: number } | null>(null);
  const [searchText, setSearch]   = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    client.get(`/destinations/${id}`)
      .then(r => {
        setDest(r.data);
        // Fetch counts in background
        Promise.allSettled([
          client.get('/restaurants', { params: { destinationId: id } }),
          client.get('/synagogues',  { params: { destinationId: id } }),
        ]).then(([rRes, sRes]) => {
          const rData = rRes.status === 'fulfilled' ? rRes.value.data : null;
          const sData = sRes.status === 'fulfilled' ? sRes.value.data : null;
          // Handle both { total, data: [] } and plain array responses
          const rCount = rData?.total ?? rData?.data?.length ?? (Array.isArray(rData) ? rData.length : 0);
          const sCount = sData?.total ?? sData?.data?.length ?? (Array.isArray(sData) ? sData.length : 0);
          setCounts({ restaurants: rCount, synagogues: sCount });
        });
      })
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
  if (!dest)   return <View style={s.center}><Text style={s.muted}>{t('common.notFound')}</Text></View>;

  const img  = getDestinationImageUrl(dest.city, dest.countryCode);
  const city = encodeURIComponent(dest.city);

  const nav = (key: ServiceKey) => {
    if (!ACTIVE.includes(key)) return;
    if (key === 'restaurants') router.push(`/restaurants/${id}?city=${city}`);
    else if (key === 'synagogues') router.push(`/synagogues/${id}?city=${city}`);
    else if (key === 'chat')       router.push(`/chat/${id}?city=${city}`);
    else if (key === 'minyans')    router.push(`/minyans/${id}?city=${city}`);
    else if (key === 'hosting')    router.push(`/hosting/${id}?city=${city}`);
    else if (key === 'map') {
      const la = dest.location?.coordinates?.[1] ?? '';
      const lo = dest.location?.coordinates?.[0] ?? '';
      router.push(`/map/${id}?lat=${la}&lng=${lo}&name=${city}` as any);
    }
  };

  return (
    <View style={s.root}>
      {/* ── Hero ── */}
      <View style={s.hero}>
        <Image source={img} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={600} />
        <View style={s.heroScrimTop} />
        <View style={s.heroScrimBottom} />

        <Pressable style={s.back} onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={19} color="#fff" strokeWidth={2.5} />
        </Pressable>

        <View style={s.heroBadge}>
          <Text style={s.heroBadgeText}>{dest.countryCode}</Text>
        </View>

        <View style={s.heroText}>
          <Text style={s.heroCity}>{translateCity(dest.city, lang)}</Text>
          <Text style={s.heroCountry}>{translateCountry(dest.countryCode, lang)}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>

        {/* ── Stats row ── */}
        {counts !== null && (
          <View style={s.stats}>
            <StatPill label={t('restaurants.title')} value={counts.restaurants} color="#16A34A" />
            <StatPill label={t('synagogues.title')}  value={counts.synagogues}  color="#7C3AED" />
          </View>
        )}

        {/* ── AI search ── */}
        <View style={s.searchBar}>
          <Sparkles size={15} color={C.gold} strokeWidth={2} />
          <TextInput
            style={s.searchInput}
            placeholder={t('destination.askCity')}
            placeholderTextColor="#BBC3D4"
            value={searchText}
            onChangeText={setSearch}
            onSubmitEditing={doSearch}
            returnKeyType="search"
          />
          <Pressable
            style={[s.searchGo, (!searchText.trim() || searching) && s.searchGoOff]}
            onPress={doSearch}
            disabled={!searchText.trim() || searching}
          >
            {searching
              ? <ActivityIndicator size="small" color="#fff" />
              : <Search size={15} color="#fff" strokeWidth={2.5} />
            }
          </Pressable>
        </View>

        {/* ── Services label ── */}
        <Text style={s.exploreLabel}>{t('destination.explore')}</Text>

        {/* ── Service cards ── */}
        <View style={s.services}>
          {SERVICE_DEFS.map(svc => {
            const active = ACTIVE.includes(svc.key);
            return (
              <Pressable
                key={svc.key}
                style={({ pressed }) => [s.svc, !active && s.svcOff, pressed && active && s.svcPressed]}
                onPress={() => nav(svc.key)}
              >
                <View style={[s.svcIcon, { backgroundColor: active ? svc.bg : '#F9FAFB' }]}>
                  <svc.Icon size={22} color={active ? svc.color : '#D1D5DB'} strokeWidth={2} />
                </View>
                <View style={s.svcText}>
                  <Text style={[s.svcLabel, !active && s.svcLabelOff]}>{t(`destination.${svc.tKey}`)}</Text>
                  <Text style={s.svcSub}>{t(`destination.${svc.subTKey}`)}</Text>
                </View>
                {!active && <Text style={s.svcSoon}>{t('destination.comingSoon')}</Text>}
              </Pressable>
            );
          })}
        </View>

        {dest.description ? (
          <View style={s.descCard}>
            <Text style={s.descText}>{dest.description}</Text>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[s.statPill, { borderColor: color + '30', backgroundColor: color + '08' }]}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted:  { fontFamily: 'Inter-Regular', fontSize: 14, color: C.textMuted },

  // Hero
  hero: { height: 300 },
  heroScrimTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 120,
    backgroundColor: 'rgba(5,10,30,0.40)',
  },
  heroScrimBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 140,
    backgroundColor: 'rgba(5,10,30,0.65)',
  },
  back: {
    position: 'absolute', top: Platform.OS === 'ios' ? 58 : 40, left: 18,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroBadge: {
    position: 'absolute', top: Platform.OS === 'ios' ? 62 : 44, right: 18,
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderWidth: 1, borderColor: C.goldBorder,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  heroBadgeText: { fontFamily: 'Inter-Bold', fontSize: 10, color: C.goldBright, letterSpacing: 1.5 },
  heroText:    { position: 'absolute', bottom: 24, left: 22 },
  heroCity:    { fontFamily: 'Inter-Black', fontSize: 34, color: '#fff', letterSpacing: -0.8 },
  heroCountry: { fontFamily: 'Inter-Medium', fontSize: 14, color: 'rgba(255,255,255,0.60)', marginTop: 4 },

  // Body
  body: { paddingHorizontal: 20 },

  // Stats
  stats: { flexDirection: 'row', gap: 10, paddingTop: 18, paddingBottom: 4 },
  statPill: {
    flex: 1, borderWidth: 1, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center',
  },
  statValue: { fontFamily: 'Inter-Black', fontSize: 22, letterSpacing: -0.5 },
  statLabel: { fontFamily: 'Inter-Medium', fontSize: 11, color: C.textMuted, marginTop: 2 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 16, marginTop: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  searchInput: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: C.textPrimary, padding: 0 },
  searchGo: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: C.navy, justifyContent: 'center', alignItems: 'center',
  },
  searchGoOff: { backgroundColor: '#E5E7EB' },

  // Explore
  exploreLabel: {
    fontFamily: 'Inter-Bold', fontSize: 11, color: '#D1D5DB',
    letterSpacing: 2, marginTop: 26, marginBottom: 14,
  },

  // Services
  services: { gap: 10 },
  svc: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  svcOff:     { opacity: 0.45 },
  svcPressed: { opacity: 0.82, transform: [{ scale: 0.986 }] },
  svcIcon:    { width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  svcText:    { flex: 1 },
  svcLabel:   { fontFamily: 'Inter-SemiBold', fontSize: 15, color: C.textPrimary },
  svcLabelOff:{ color: '#D1D5DB' },
  svcSub:     { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, marginTop: 1 },
  svcSoon:    { fontFamily: 'Inter-Medium', fontSize: 11, color: '#BBC3D4' },

  // Description
  descCard: {
    marginTop: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  descText: { fontFamily: 'Inter-Regular', fontSize: 14, color: C.textSecondary, lineHeight: 22 },

  // Suggest a place
  suggestSection: { marginTop: 24 },
  suggestTitle: {
    fontFamily: 'Inter-Bold', fontSize: 11, color: '#D1D5DB',
    letterSpacing: 2, marginBottom: 10,
  },
  suggestRow: { flexDirection: 'row', gap: 10 },
  suggestBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  suggestBtnPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  suggestBtnText: { fontFamily: 'Inter-SemiBold', fontSize: 14 },
});
