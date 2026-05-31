import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import client from '@/src/api/client';
import { C } from '@/constants/theme';

interface SavedRestaurant {
  id: number; name: string; address?: string;
  kashrutLevel: string; restaurantType: string | null;
  destination: { id: number; city: string } | null;
}
interface SavedSynagogue {
  id: number; name: string; address?: string; denomination?: string;
}

const KASHRUT_COLOR: Record<string, string> = {
  rabbinate: '#6B7280', mehadrin: '#2563EB', badatz: '#059669', unknown: '#6B7280',
};

export default function SavedScreen() {
  const [restaurants, setRestaurants] = useState<SavedRestaurant[]>([]);
  const [synagogues, setSynagogues] = useState<SavedSynagogue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/favorites')
      .then(r => { setRestaurants(r.data.restaurants); setSynagogues(r.data.synagogues); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>Saved Places</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.gold} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          {restaurants.length === 0 && synagogues.length === 0 && (
            <View style={s.empty}>
              <MaterialIcons name="favorite-border" size={48} color={C.textMuted} />
              <Text style={s.emptyText}>No saved places yet</Text>
              <Text style={s.emptySubText}>Tap the ♡ on any restaurant or synagogue</Text>
            </View>
          )}

          {restaurants.length > 0 && (
            <>
              <Text style={s.section}>Restaurants ({restaurants.length})</Text>
              {restaurants.map(r => (
                <Pressable
                  key={r.id}
                  style={s.card}
                  onPress={() => router.push(`/restaurant/${r.id}` as any)}
                >
                  <View style={s.cardIcon}>
                    <MaterialIcons name="restaurant" size={20} color={C.gold} />
                  </View>
                  <View style={s.cardBody}>
                    <Text style={s.cardName}>{r.name}</Text>
                    {r.destination && <Text style={s.cardSub}>{r.destination.city}</Text>}
                  </View>
                  <View style={[s.badge, { backgroundColor: KASHRUT_COLOR[r.kashrutLevel] ?? '#6B7280' }]}>
                    <Text style={s.badgeText}>{r.kashrutLevel}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {synagogues.length > 0 && (
            <>
              <Text style={[s.section, restaurants.length > 0 && { marginTop: 24 }]}>
                Synagogues ({synagogues.length})
              </Text>
              {synagogues.map(s2 => (
                <Pressable
                  key={s2.id}
                  style={s.card}
                  onPress={() => router.push(`/synagogue/${s2.id}` as any)}
                >
                  <View style={[s.cardIcon, { backgroundColor: 'rgba(124,58,237,0.10)' }]}>
                    <MaterialIcons name="account-balance" size={20} color="#7C3AED" />
                  </View>
                  <View style={s.cardBody}>
                    <Text style={s.cardName}>{s2.name}</Text>
                    {s2.address && <Text style={s.cardSub} numberOfLines={1}>{s2.address}</Text>}
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.navy, paddingTop: 56, paddingBottom: 18, paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  body: { padding: 18, gap: 10 },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 18, fontWeight: '700', color: C.textSecondary },
  emptySubText: { fontSize: 14, color: C.textMuted, textAlign: 'center' },

  section: { fontSize: 12, fontWeight: '800', color: C.textMuted, letterSpacing: 1, marginBottom: 4 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 14, padding: 14,
    shadowColor: C.navy, shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(201,168,76,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardBody: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  cardSub:  { fontSize: 12, color: C.textMuted, marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff', textTransform: 'capitalize' },
});
