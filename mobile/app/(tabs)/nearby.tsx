import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

interface NearbyRestaurant {
  id: number; name: string; address?: string;
  kashrutLevel: string; restaurantType: string | null;
  distanceMeters: number; city?: string; country?: string;
}
interface NearbySynagogue {
  id: number; name: string; address?: string;
  denomination?: string; distanceMeters: number;
}

const KASHRUT_COLOR: Record<string, string> = {
  rabbinate: '#6B7280', mehadrin: '#2563EB', badatz: '#059669',
};

function formatDist(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function NearbyScreen() {
  const [restaurants, setRestaurants] = useState<NearbyRestaurant[]>([]);
  const [synagogues,  setSynagogues]  = useState<NearbySynagogue[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [locError,    setLocError]    = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocError(true); setLoading(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = pos.coords;
      const [r, s] = await Promise.allSettled([
        client.get('/restaurants/nearby', { params: { lat, lng, limit: 8 } }),
        client.get('/synagogues/nearby',  { params: { lat, lng, limit: 5 } }),
      ]);
      if (r.status === 'fulfilled') setRestaurants(r.value.data);
      if (s.status === 'fulfilled') setSynagogues(s.value.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={C.gold} />
      <Text style={s.loadText}>Finding places near you…</Text>
    </View>
  );

  if (locError) return (
    <View style={s.center}>
      <MaterialIcons name="location-off" size={48} color={C.textMuted} />
      <Text style={s.loadText}>Location permission required</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <MaterialIcons name="near-me" size={22} color={C.gold} />
        <Text style={s.headerTitle}>Near Me</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {restaurants.length > 0 && (
          <>
            <Text style={s.section}>🍽️ Kosher Restaurants</Text>
            {restaurants.map(r => (
              <Pressable key={r.id} style={s.card} onPress={() => router.push(`/restaurant/${r.id}` as any)}>
                <View style={[s.iconBox, { backgroundColor: 'rgba(201,168,76,0.12)' }]}>
                  <MaterialIcons name="restaurant" size={20} color={C.gold} />
                </View>
                <View style={s.cardBody}>
                  <Text style={s.cardName}>{r.name}</Text>
                  {r.city && <Text style={s.cardSub}>{r.city}</Text>}
                </View>
                <View style={s.right}>
                  {r.kashrutLevel && (
                    <View style={[s.badge, { backgroundColor: KASHRUT_COLOR[r.kashrutLevel] ?? '#6B7280' }]}>
                      <Text style={s.badgeText}>{r.kashrutLevel}</Text>
                    </View>
                  )}
                  <Text style={s.dist}>{formatDist(r.distanceMeters)}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {synagogues.length > 0 && (
          <>
            <Text style={[s.section, { marginTop: 20 }]}>🕍 Synagogues</Text>
            {synagogues.map(s2 => (
              <Pressable key={s2.id} style={s.card} onPress={() => router.push(`/synagogue/${s2.id}` as any)}>
                <View style={[s.iconBox, { backgroundColor: 'rgba(124,58,237,0.10)' }]}>
                  <MaterialIcons name="account-balance" size={20} color="#7C3AED" />
                </View>
                <View style={s.cardBody}>
                  <Text style={s.cardName}>{s2.name}</Text>
                  {s2.address && <Text style={s.cardSub} numberOfLines={1}>{s2.address}</Text>}
                </View>
                <Text style={s.dist}>{formatDist(s2.distanceMeters)}</Text>
              </Pressable>
            ))}
          </>
        )}

        {restaurants.length === 0 && synagogues.length === 0 && (
          <View style={s.center}>
            <MaterialIcons name="search-off" size={48} color={C.textMuted} />
            <Text style={s.loadText}>No places found nearby</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadText: { fontSize: 15, color: C.textMuted, textAlign: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.navy, paddingTop: 56, paddingBottom: 18, paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  body: { padding: 16, gap: 10 },
  section: { fontSize: 13, fontWeight: '800', color: C.textSecondary, marginBottom: 2 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    shadowColor: C.navy, shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  iconBox:  { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  cardSub:  { fontSize: 12, color: C.textMuted, marginTop: 2 },
  right:    { alignItems: 'flex-end', gap: 4 },
  badge:    { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:{ fontSize: 9, fontWeight: '700', color: '#fff', textTransform: 'capitalize' },
  dist:     { fontSize: 12, fontWeight: '700', color: C.gold },
});
