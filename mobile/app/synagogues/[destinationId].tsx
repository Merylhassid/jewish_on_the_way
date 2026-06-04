import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, Platform,
  Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { ArrowLeft, ChevronRight, Globe, MapPin, Navigation, Phone } from 'lucide-react-native';
import client from '@/src/api/client';
import { C } from '@/constants/theme';
import { calculateHaversineDistance, formatDistance } from '@/src/utils/distance';

interface Synagogue {
  id: number; name: string; address?: string;
  phone?: string; website?: string; denomination?: string;
  location?: { coordinates: [number, number] };
  distanceMeters?: number;
}

const DENOM: Record<string, { label: string; color: string; bg: string }> = {
  ashkenaz: { label: 'Ashkenaz', color: '#3B4FC8', bg: '#EEF2FF' },
  sfarad:   { label: 'Sfarad',   color: '#0F766E', bg: '#F0FDFA' },
  chabad:   { label: "Chabad",   color: '#C2410C', bg: '#FFF7ED' },
  teimanim: { label: 'Teimanim', color: '#15803D', bg: '#F0FDF4' },
};

const ASHKENAZ = ['אשכנז','אשכנזי','ליטאי','ashkenaz','ashkenazi','orthodox'];
const SFARAD   = ['ספרד','ספרדי','עדות המזרח','מרוקאי','sfarad','mizrahi'];
const CHABAD   = ['חב"ד','חסידי','chabad','hasidic'];
const TEIMANIM = ['תימן','תימני','שאמי','בלאדי','teimanim','yemenite'];

function getDenomKey(d?: string | null) {
  if (!d) return null;
  const l = d.toLowerCase();
  if (ASHKENAZ.some(v => l.includes(v.toLowerCase()))) return 'ashkenaz';
  if (SFARAD.some(v   => l.includes(v.toLowerCase()))) return 'sfarad';
  if (CHABAD.some(v   => l.includes(v.toLowerCase()))) return 'chabad';
  if (TEIMANIM.some(v => l.includes(v.toLowerCase()))) return 'teimanim';
  return null;
}

export default function SynagoguesScreen() {
  const { destinationId, denomination, city } =
    useLocalSearchParams<{ destinationId: string; denomination?: string; city?: string }>();

  const [synagogues, setSynagogues] = useState<Synagogue[]>([]);
  const [total, setTotal]           = useState(0);
  const [offset, setOffset]         = useState(0);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [trigger, setTrigger]       = useState(0);
  const [gps, setGps]               = useState<{ lat: number; lng: number } | null>(null);
  const cityLabel = city ? decodeURIComponent(city) : '';

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

  useEffect(() => {
    if (!destinationId) return;
    setOffset(0);
    (async () => {
      try {
        if (!refreshing) setLoading(true);
        const params: any = { destinationId, offset: '0' };
        if (denomination) params.denomination = denomination;
        if (gps) { params.lat = String(gps.lat); params.lng = String(gps.lng); }
        const res = await client.get('/synagogues', { params });
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : (raw?.data ?? []);
        setSynagogues(list);
        setTotal(raw?.total ?? list.length);
      } catch {} finally { setLoading(false); setRefreshing(false); }
    })();
  }, [destinationId, denomination, gps, trigger]);

  const loadMore = async () => {
    if (loadingMore) return;
    const next = offset + 50;
    try {
      setLoadingMore(true);
      const params: any = { destinationId, offset: String(next) };
      if (denomination) params.denomination = denomination;
      if (gps) { params.lat = String(gps.lat); params.lng = String(gps.lng); }
      const res = await client.get('/synagogues', { params });
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : (raw?.data ?? []);
      setSynagogues(p => [...p, ...list]);
      setOffset(next);
    } catch {} finally { setLoadingMore(false); }
  };

  const count = total || synagogues.length;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <Pressable style={s.back} onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={20} color="#fff" strokeWidth={2.5} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>{cityLabel || 'Synagogues'}</Text>
            <Text style={s.headerSub}>
              {loading ? 'Loading…' : `${count} synagogue${count !== 1 ? 's' : ''}${gps ? '  ·  sorted by distance' : ''}`}
            </Text>
          </View>
        </View>

        {denomination && DENOM[denomination] && (
          <Pressable
            style={[s.denomBanner, { backgroundColor: DENOM[denomination].bg }]}
            onPress={() => router.replace(`/synagogues/${destinationId}` as any)}
          >
            <Text style={[s.denomLabel, { color: DENOM[denomination].color }]}>
              {DENOM[denomination].label} · Tap to clear filter
            </Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>
      ) : (
        <FlatList
          data={synagogues}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTrigger(t => t + 1); }} tintColor={C.gold} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={C.gold} style={{ margin: 20 }} /> : null}
          renderItem={({ item }) => <SynagogueCard item={item} gps={gps} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Globe size={36} color="#E5E7EB" strokeWidth={1.5} />
              <Text style={s.emptyText}>No synagogues found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function SynagogueCard({ item, gps }: { item: Synagogue; gps: { lat: number; lng: number } | null }) {
  const denomKey = getDenomKey(item.denomination);
  const denom    = denomKey ? DENOM[denomKey] : null;

  const dist = item.distanceMeters !== undefined
    ? item.distanceMeters
    : (gps && item.location?.coordinates
        ? calculateHaversineDistance(gps.lat, gps.lng, item.location.coordinates[1], item.location.coordinates[0])
        : null);

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && { opacity: 0.86, transform: [{ scale: 0.985 }] }]}
      onPress={() => router.push(`/synagogue/${item.id}`)}
    >
      {/* Purple left accent */}
      <View style={s.cardAccent} />

      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <View style={[s.cardIcon, { backgroundColor: '#F5F3FF' }]}>
            <Globe size={18} color="#7C3AED" strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
            {denom && (
              <View style={[s.denomPill, { backgroundColor: denom.bg }]}>
                <Text style={[s.denomPillText, { color: denom.color }]}>{denom.label}</Text>
              </View>
            )}
          </View>
          {dist !== null && (
            <View style={s.distBadge}>
              <Navigation size={10} color={C.gold} strokeWidth={2.5} />
              <Text style={s.distText}>{formatDistance(dist)}</Text>
            </View>
          )}
        </View>

        {item.address && (
          <View style={s.metaRow}>
            <MapPin size={12} color="#9CA3AF" strokeWidth={2} />
            <Text style={s.metaText} numberOfLines={1}>{item.address}</Text>
          </View>
        )}

        {(item.phone || item.website) && (
          <View style={s.actions}>
            {item.phone && (
              <Pressable style={s.actionBtn} onPress={() => Linking.openURL(`tel:${item.phone}`).catch(() => {})}>
                <Phone size={13} color="#6B7280" strokeWidth={2} />
                <Text style={s.actionText}>Call</Text>
              </Pressable>
            )}
            {item.website && (
              <Pressable style={s.actionBtn} onPress={() => { const u = item.website!.startsWith('http') ? item.website! : 'https://' + item.website!; Linking.openURL(u).catch(() => {}); }}>
                <Globe size={13} color="#6B7280" strokeWidth={2} />
                <Text style={s.actionText}>Website</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      <ChevronRight size={16} color="#E5E7EB" strokeWidth={2.5} style={{ alignSelf: 'center', marginRight: 14 }} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: C.navy,
    paddingTop: Platform.OS === 'ios' ? 58 : 38,
    paddingHorizontal: 20, paddingBottom: 16, gap: 12,
  },
  headerRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  back: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontFamily: 'Inter-ExtraBold', fontSize: 20, color: '#fff', letterSpacing: -0.3 },
  headerSub:   { fontFamily: 'Inter-Regular', fontSize: 12, color: 'rgba(255,255,255,0.50)', marginTop: 2 },

  denomBanner: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  denomLabel:  { fontFamily: 'Inter-SemiBold', fontSize: 13 },

  list: { padding: 16, gap: 10, paddingBottom: 40 },

  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardAccent: { width: 4, backgroundColor: '#7C3AED' },
  cardBody:   { flex: 1, padding: 14, gap: 8 },

  cardTop:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIcon:  { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardName:  { fontFamily: 'Inter-Bold', fontSize: 15, color: C.textPrimary, letterSpacing: -0.1, flex: 1 },

  denomPill:     { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 3 },
  denomPillText: { fontFamily: 'Inter-SemiBold', fontSize: 11 },

  distBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.goldFaint, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4,
  },
  distText:  { fontFamily: 'Inter-Bold', fontSize: 11, color: C.gold },

  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted, flex: 1 },

  actions:   { flexDirection: 'row', gap: 8, marginTop: 2 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F9FAFB', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  actionText: { fontFamily: 'Inter-Medium', fontSize: 12, color: '#6B7280' },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#BBC3D4' },
});
