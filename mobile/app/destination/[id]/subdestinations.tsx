import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform,
  Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { ArrowLeft, ChevronRight, MapPin, Search } from 'lucide-react-native';
import client from '@/src/api/client';
import { C, getDestinationImageUrl } from '@/constants/theme';

interface Destination {
  id: number; name: string; city: string;
  country: string; countryCode: string;
}

export default function SubdestinationsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [parent, setParent]   = useState<Destination | null>(null);
  const [cities, setCities]   = useState<Destination[]>([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);

  const fetch = async (q?: string) => {
    try {
      const params: any = { parentId: String(id) };
      if (q) params.q = q;
      const res = await client.get('/destinations', { params });
      setCities(res.data);
    } catch {}
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([
      client.get(`/destinations/${id}`),
      client.get('/destinations', { params: { parentId: String(id) } }),
    ])
      .then(([p, c]) => { setParent(p.data); setCities(c.data); })
      .catch(() => router.replace('/(tabs)'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={C.gold} /></View>;

  return (
    <View style={s.root}>
      {/* Hero */}
      {parent && (
        <View style={s.hero}>
          <Image
            source={{ uri: getDestinationImageUrl(parent.city, parent.countryCode) }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={500}
          />
          <View style={s.heroScrim} />

          <Pressable style={s.back} onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft size={19} color="#fff" strokeWidth={2.5} />
          </Pressable>

          <View style={s.heroBadge}>
            <Text style={s.heroBadgeText}>{parent.countryCode}</Text>
          </View>

          <View style={s.heroText}>
            <Text style={s.heroTitle}>{parent.country}</Text>
            <Text style={s.heroSub}>{cities.length} destination{cities.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}

      {/* Search */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Search size={16} color="#9CA3AF" strokeWidth={2} />
          <TextInput
            style={s.searchInput}
            placeholder="Search cities…"
            placeholderTextColor="#BBC3D4"
            value={search}
            onChangeText={t => { setSearch(t); fetch(t || undefined); }}
          />
        </View>
      </View>

      {/* List */}
      <FlatList
        data={cities}
        keyExtractor={i => String(i.id)}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [s.card, pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}
            onPress={() => router.push(`/destination/${item.id}`)}
          >
            <View style={s.cardImg}>
              <Image
                source={{ uri: getDestinationImageUrl(item.city, item.countryCode) }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                transition={300}
              />
              <View style={s.cardImgScrim} />
            </View>
            <View style={s.cardInfo}>
              <Text style={s.cardCity}>{item.city}</Text>
              <View style={s.cardMeta}>
                <MapPin size={11} color="#9CA3AF" strokeWidth={2} />
                <Text style={s.cardCountry}>{item.country}</Text>
              </View>
            </View>
            <ChevronRight size={18} color="#D1D5DB" strokeWidth={2.5} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <MapPin size={32} color="#E5E7EB" strokeWidth={1.5} />
            <Text style={s.emptyText}>No cities found</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero:      { height: 240 },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,30,0.55)' },
  back: {
    position: 'absolute', top: Platform.OS === 'ios' ? 58 : 40, left: 18,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroBadge: {
    position: 'absolute', top: Platform.OS === 'ios' ? 62 : 44, right: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1, borderColor: C.goldBorder,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  heroBadgeText: { fontFamily: 'Inter-Bold', fontSize: 10, color: C.goldBright, letterSpacing: 1.5 },
  heroText:  { position: 'absolute', bottom: 24, left: 22 },
  heroTitle: { fontFamily: 'Inter-Black', fontSize: 32, color: '#fff', letterSpacing: -0.6 },
  heroSub:   { fontFamily: 'Inter-Medium', fontSize: 13, color: 'rgba(255,255,255,0.60)', marginTop: 4 },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 14, color: C.textPrimary, padding: 0 },

  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 18, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardImg: {
    width: 60, height: 60, borderRadius: 14, overflow: 'hidden', backgroundColor: C.navy,
  },
  cardImgScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,10,30,0.15)' },
  cardInfo:   { flex: 1 },
  cardCity:   { fontFamily: 'Inter-Bold', fontSize: 16, color: C.textPrimary },
  cardMeta:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  cardCountry:{ fontFamily: 'Inter-Regular', fontSize: 12, color: C.textMuted },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 14, color: '#BBC3D4' },
});
